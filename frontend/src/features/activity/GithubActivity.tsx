// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, GitBranch, LoaderCircle } from "lucide-react";
import { notify } from "../../lib/toast";

type ActivityItem = { id: string; type: string; repo: string; message: string; created_at: string; url: string };

export function GithubActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let live = true;
    fetch("/api/github/activity", { headers: { Accept: "application/json" } })
      .then(response => { if (!response.ok) throw new Error("activity"); return response.json(); })
      .then(data => { if (live) { setItems(Array.isArray(data) ? data.slice(0, 8) : []); setState("ready"); } })
      .catch(() => {
        if (!live) return;
        setState("error");
        notify("GitHub activity is temporarily unavailable. Project data will keep using the cached fallback.", "warning", 4200);
      });
    return () => { live = false; };
  }, []);
  return <section id="activity" className="activity-feed section-pad">
    <div className="section-heading"><span>05</span><div><p>GITHUB.ACTIVITY</p><h2>Recent repository activity.</h2></div><a href="https://github.com/osameh15" target="_blank" rel="noreferrer" className="section-link">Open GitHub <ArrowUpRight size={15} /></a></div>
    {state === "loading" ? <div className="repo-status"><LoaderCircle className="spin" size={18} /> Reading public activity…</div> : state === "error" ? <div className="muted-card"><GitBranch size={18} /> Recent activity is temporarily unavailable.</div> : <div className="activity-timeline">
      {items.length ? items.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><span className="activity-node"><GitBranch size={14} /></span><div><b>{item.repo}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("en", { month: "short", day: "numeric", year: "numeric" })}</small></div><ExternalLink size={14} /></a>) : <p className="muted-card">No public repository activity in the last 30 days.</p>}
    </div>}
  </section>;
}
