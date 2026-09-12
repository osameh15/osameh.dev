// "Continue exploring" — deterministic related content.
//
// The portfolio already knows how its content connects: notes name the
// repositories they are about, client case studies name their projects, and
// every repository publishes a canonical technology stack. This derives three
// suggestions from that, with a fixed priority and no fuzzy scoring.
//
// There is no personalization, no randomness and no "recommended for you". The
// same input always produces the same output, which is what makes it testable.

import { canonicalKeysFor } from "./technology";

export type RelatedKind = "project" | "note" | "case-study";

export type RelatedItem = {
  kind: RelatedKind;
  id: string;
  title: string;
  hint: string;
  href: string;
  /** Why this appeared. Rendered, so the connection is never mysterious. */
  reason: string;
  /** Lower sorts first. Mirrors the documented priority order. */
  rank: number;
};

export type RelatedSource = {
  projects: { name: string; title: string; hint: string; technologies: string[] }[];
  notes: { slug: string; title: string; hint: string; tags: string[]; relatedProjects?: string[]; relatedCaseStudies?: string[] }[];
  caseStudies: { id: string; title: string; hint: string; stack: string[]; relatedProjects?: string[]; relatedNotes?: string[] }[];
};

/**
 * Priority, highest first:
 *   1 explicit manual relationship
 *   2 same project / repository
 *   3 explicit case-study relationship
 *   4 shared canonical technology
 *   5 adjacent note order
 */
const RANK = { explicit: 1, sameProject: 2, caseStudy: 3, sharedTechnology: 4, adjacent: 5 };

export const MAX_RELATED = 3;

const projectItem = (project: RelatedSource["projects"][number], reason: string, rank: number): RelatedItem => ({
  kind: "project", id: project.name, title: project.title, hint: project.hint,
  href: `/projects/${encodeURIComponent(project.name)}`, reason, rank,
});
const noteItem = (note: RelatedSource["notes"][number], reason: string, rank: number): RelatedItem => ({
  kind: "note", id: note.slug, title: note.title, hint: note.hint,
  href: `/notes/${encodeURIComponent(note.slug)}`, reason, rank,
});
const caseStudyItem = (study: RelatedSource["caseStudies"][number], reason: string, rank: number): RelatedItem => ({
  kind: "case-study", id: study.id, title: study.title, hint: study.hint,
  href: `/case-studies/${encodeURIComponent(study.id)}`, reason, rank,
});

/**
 * Stable ordering, then a diversity pass: with equal rank, prefer covering more
 * than one content type, because three variations of the same thing is a worse
 * answer than a project plus a note. Relevance still wins over variety - a
 * higher-ranked item is never displaced by a lower-ranked one of another type.
 */
function finalize(candidates: RelatedItem[]): RelatedItem[] {
  const seen = new Set<string>();
  const unique = candidates
    .filter(item => {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));

  const picked: RelatedItem[] = [];
  const kinds = new Set<RelatedKind>();
  for (const item of unique) {
    if (picked.length >= MAX_RELATED) break;
    if (kinds.has(item.kind) && unique.some(other => !kinds.has(other.kind) && !picked.includes(other) && other.rank <= item.rank)) continue;
    picked.push(item);
    kinds.add(item.kind);
  }
  for (const item of unique) {
    if (picked.length >= MAX_RELATED) break;
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.slice(0, MAX_RELATED);
}

/** Related content for a project page. */
export function relatedToProject(repoName: string, source: RelatedSource): RelatedItem[] {
  const project = source.projects.find(item => item.name === repoName);
  const keys = project ? canonicalKeysFor(project.technologies) : [];
  const candidates: RelatedItem[] = [];

  for (const note of source.notes) {
    if ((note.relatedProjects || []).includes(repoName)) candidates.push(noteItem(note, "Written about this project", RANK.explicit));
  }
  for (const study of source.caseStudies) {
    if ((study.relatedProjects || []).includes(repoName)) candidates.push(caseStudyItem(study, "Client work built on this project", RANK.caseStudy));
  }
  for (const other of source.projects) {
    if (other.name === repoName) continue;
    const shared = canonicalKeysFor(other.technologies).filter(key => keys.includes(key));
    if (shared.length) candidates.push(projectItem(other, `Shares ${shared.length} technology${shared.length > 1 ? " areas" : ""}`, RANK.sharedTechnology));
  }
  return finalize(candidates);
}

/** Related content for an engineering note. `adjacentSlug` is the next note in order. */
export function relatedToNote(slug: string, source: RelatedSource, adjacentSlug?: string): RelatedItem[] {
  const note = source.notes.find(item => item.slug === slug);
  if (!note) return [];
  const candidates: RelatedItem[] = [];

  for (const name of note.relatedProjects || []) {
    const project = source.projects.find(item => item.name === name);
    if (project) candidates.push(projectItem(project, "This note is about it", RANK.explicit));
  }
  for (const id of note.relatedCaseStudies || []) {
    const study = source.caseStudies.find(item => item.id === id);
    if (study) candidates.push(caseStudyItem(study, "Discussed in this note", RANK.caseStudy));
  }
  const tagKeys = canonicalKeysFor(note.tags);
  for (const other of source.notes) {
    if (other.slug === slug) continue;
    const shared = canonicalKeysFor(other.tags).filter(key => tagKeys.includes(key));
    if (shared.length) candidates.push(noteItem(other, "Shares a topic", RANK.sharedTechnology));
  }
  if (adjacentSlug) {
    const next = source.notes.find(item => item.slug === adjacentSlug);
    if (next) candidates.push(noteItem(next, "Next note", RANK.adjacent));
  }
  return finalize(candidates);
}

/** Related content for a client case study. */
export function relatedToCaseStudy(id: string, source: RelatedSource): RelatedItem[] {
  const study = source.caseStudies.find(item => item.id === id);
  if (!study) return [];
  const candidates: RelatedItem[] = [];

  for (const name of study.relatedProjects || []) {
    const project = source.projects.find(item => item.name === name);
    if (project) candidates.push(projectItem(project, "Built for this engagement", RANK.explicit));
  }
  for (const slug of study.relatedNotes || []) {
    const note = source.notes.find(item => item.slug === slug);
    if (note) candidates.push(noteItem(note, "Written about this engagement", RANK.explicit));
  }
  const keys = canonicalKeysFor(study.stack);
  for (const project of source.projects) {
    const shared = canonicalKeysFor(project.technologies).filter(key => keys.includes(key));
    if (shared.length) candidates.push(projectItem(project, "Shares a technology", RANK.sharedTechnology));
  }
  return finalize(candidates);
}
