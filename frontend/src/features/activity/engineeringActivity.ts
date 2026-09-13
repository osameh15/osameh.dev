// The engineering timeline.
//
// GitHub's event feed alone answers "did Osameh push?", not "what has Osameh
// been building?" - the Raven audit found eight events, all from one repository,
// six of them "Pushed 1 commit(s)", with two genuine releases carrying no more
// weight than a one-commit push.
//
// This merges the high-signal records the portfolio already owns - published
// releases and Engineering Notes - with GitHub's feed, and orders them by a
// fixed priority. Nothing here scores a commit's importance: judging whether an
// arbitrary commit mattered is not something to guess at, so pushes simply rank
// below records that are meaningful by construction.
//
// No new source, no polling, no persistence.

import { changelog } from "../../data/portfolioData";
import { engineeringNotes } from "../notes/notesData";
import { RELEASE_DATES } from "../../generated/releaseDates";

export type ActivitySource = "release" | "note" | "github";

export type EngineeringActivity = {
  id: string;
  type: "release" | "note" | "github-release" | "push";
  title: string;
  detail: string;
  date: string;
  href?: string;
  /** Internal destinations open through the SPA; GitHub links leave the site. */
  external: boolean;
  source: ActivitySource;
  /** Lower sorts first when two events share a date. */
  priority: number;
};

export type GithubActivityItem = {
  id: string;
  type: string;
  repo: string;
  message: string;
  created_at: string;
  url: string;
};

const PRIORITY = { release: 1, note: 2, githubRelease: 3, push: 4 };

/** Release dates come from the generated map, authored once in docs/CHANGELOG.md. */

/**
 * A GitHub ReleaseEvent usually describes a release this portfolio already
 * documents. Matching is by version/tag taken from the event text, never by
 * fuzzy title comparison.
 */
function versionFromEvent(item: GithubActivityItem): string | null {
  const match = /\b(\d+\.\d+\.\d+)\b/.exec(`${item.message} ${item.url}`);
  return match ? match[1] : null;
}

export function buildEngineeringTimeline(
  githubItems: GithubActivityItem[],
  options: { limit?: number } = {},
): EngineeringActivity[] {
  const limit = options.limit ?? 8;
  const timeline: EngineeringActivity[] = [];
  const knownVersions = new Set<string>();

  // 1. Published portfolio releases - the portfolio's own authoritative record.
  for (const release of changelog) {
    knownVersions.add(release.version);
    const date = RELEASE_DATES[release.version] || null;
    if (!date) continue;
    timeline.push({
      id: `release:${release.version}`,
      type: "release",
      title: `v${release.version} — ${release.title}`,
      detail: "Portfolio release",
      date,
      external: false,
      source: "release",
      priority: PRIORITY.release,
    });
  }

  // 2. Engineering Notes, which already carry publication dates.
  for (const note of engineeringNotes) {
    timeline.push({
      id: `note:${note.slug}`,
      type: "note",
      title: note.title,
      detail: "Engineering note",
      date: note.publishedAt,
      href: `/notes/${encodeURIComponent(note.slug)}`,
      external: false,
      source: "note",
      priority: PRIORITY.note,
    });
  }

  // 3. GitHub. A release event already documented locally is dropped rather than
  //    shown twice; pushes stay, ranked below everything meaningful.
  //
  //    Two deterministic keys, in order. The version/tag is preferred, but the
  //    activity payload often carries no tag - GitHub reports "Published a
  //    release" with a bare repository URL - so the date of a release this
  //    portfolio already documents is the fallback. Still deterministic, and
  //    the local record stays authoritative either way. No title matching.
  const localReleaseDates = new Set(
    [...knownVersions].map(version => RELEASE_DATES[version]).filter(Boolean),
  );
  for (const item of githubItems) {
    const date = (item.created_at || "").slice(0, 10);
    if (!date) continue;
    const isRelease = item.type === "ReleaseEvent";
    if (isRelease) {
      const version = versionFromEvent(item);
      if (version && knownVersions.has(version)) continue;
      if (!version && localReleaseDates.has(date)) continue;
    }
    timeline.push({
      id: `github:${item.id}`,
      type: isRelease ? "github-release" : "push",
      title: item.repo,
      detail: item.message,
      date,
      href: item.url,
      external: true,
      source: "github",
      priority: isRelease ? PRIORITY.githubRelease : PRIORITY.push,
    });
  }

  // Newest first; then by priority so a release outranks a push on the same day;
  // then by id so the order never depends on source ordering.
  const ordered = timeline.sort((a, b) => b.date.localeCompare(a.date) || a.priority - b.priority || a.id.localeCompare(b.id));

  // A timeline of nothing but releases is as unhelpful as one of nothing but
  // pushes: this portfolio ships often, so without a cap the newest releases
  // fill every slot and the notes never appear. Each source gets a ceiling,
  // then anything still unfilled is taken in order, so the result is a genuine
  // mix without ever reordering by anything other than the rule above.
  const CEILING: Record<ActivitySource, number> = { release: 4, note: 3, github: 3 };
  const used: Record<ActivitySource, number> = { release: 0, note: 0, github: 0 };
  const picked: EngineeringActivity[] = [];
  for (const item of ordered) {
    if (picked.length >= limit) break;
    if (used[item.source] >= CEILING[item.source]) continue;
    used[item.source] += 1;
    picked.push(item);
  }
  for (const item of ordered) {
    if (picked.length >= limit) break;
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.sort((a, b) => b.date.localeCompare(a.date) || a.priority - b.priority || a.id.localeCompare(b.id));
}
