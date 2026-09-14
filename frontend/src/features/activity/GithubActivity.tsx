// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. v5.6.0 Raven turned it from a raw GitHub feed into an engineering
// timeline: the portfolio's own releases and notes rank above repository pushes,
// and a GitHub outage no longer empties the section, because the local records
// are still there.

import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, ExternalLink, GitBranch, LoaderCircle, Tag } from "lucide-react";
import { notify } from "../../lib/toast";
import { buildEngineeringTimeline, type EngineeringActivity, type GithubActivityItem } from "./engineeringActivity";

const ICON = { release: Tag, "github-release": Tag, note: BookOpen, push: GitBranch } as const;

export function GithubActivity({ onOpenNote }: { onOpenNote?: (slug: string) => void }) {
  const [githubItems, setGithubItems] = useState<GithubActivityItem[]>([]);
  // GitHub is one source among several, so its state is tracked separately from
  // the timeline itself: losing it degrades the section instead of emptying it.
  const [githubState, setGithubState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let live = true;
    fetch("/api/github/activity", { headers: { Accept: "application/json" } })
      .then(response => { if (!response.ok) throw new Error("activity"); return response.json(); })
      .then(data => { if (live) { setGithubItems(Array.isArray(data) ? data : []); setGithubState("ready"); } })
      .catch(() => {
        if (!live) return;
        setGithubState("error");
        notify("GitHub activity is temporarily unavailable. Project data will keep using the cached fallback.", "warning", 4200);
      });
    return () => { live = false; };
  }, []);

  const timeline = buildEngineeringTimeline(githubItems);
  const loading = githubState === "loading" && !timeline.length;

  const entry = (item: EngineeringActivity) => {
    const Icon = ICON[item.type];
    const body = (
      <>
        <span className="activity-node" data-activity-type={item.type}><Icon size={14} /></span>
        <div>
          <b>{item.title}</b>
          <p>{item.detail}</p>
          <small>{new Date(`${item.date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</small>
        </div>
        {item.external ? <ExternalLink size={14} /> : <ArrowUpRight size={14} />}
      </>
    );

    if (!item.href) return <div className="activity-entry" key={item.id} data-activity-source={item.source}>{body}</div>;
    if (item.external) {
      return <a className="activity-entry" key={item.id} data-activity-source={item.source} href={item.href} target="_blank" rel="noreferrer">{body}</a>;
    }
    // Internal destinations keep the editor-tab lifecycle on a plain left click
    // while modified and middle clicks stay with the browser.
    return (
      <a
        className="activity-entry"
        key={item.id}
        data-activity-source={item.source}
        href={item.href}
        onClick={event => {
          if (!onOpenNote || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (!item.href?.startsWith("/notes/")) return;
          event.preventDefault();
          onOpenNote(decodeURIComponent(item.href.replace("/notes/", "")));
        }}
      >
        {body}
      </a>
    );
  };

  return <section id="activity" className="activity-feed section-pad">
    <div className="section-heading"><span>05</span><div><p>ENGINEERING.ACTIVITY</p><h2>Recent engineering activity.</h2></div><a href="https://github.com/osameh15" target="_blank" rel="noreferrer" className="section-link">Open GitHub <ArrowUpRight size={15} /></a></div>
    {loading ? <div className="repo-status"><LoaderCircle className="spin" size={18} /> Reading recent activity…</div> : <div className="activity-timeline">
      {timeline.length ? timeline.map(entry) : <p className="muted-card">No recent engineering activity.</p>}
      {githubState === "error" && <p className="muted-card activity-degraded"><GitBranch size={16} /> Repository activity from GitHub is temporarily unavailable. Releases and notes above are unaffected.</p>}
    </div>}
  </section>;
}
