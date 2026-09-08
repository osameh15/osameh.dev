// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { Code2, X } from "lucide-react";
import { useModalDialog } from "../../lib/modalScroll";
import type { RepoLike } from "../../data/portfolioData";

export function ProjectCompare({ repos, onClose }: { repos: RepoLike[]; onClose: () => void }) {
  const dialogRef = useModalDialog<HTMLElement>(repos.length === 2, onClose);
  if (repos.length !== 2) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="advanced-modal compare-modal" role="dialog" aria-modal="true" aria-label="Compare projects" onMouseDown={e => e.stopPropagation()}><header><div><Code2 size={17} /><span>compare-projects.diff</span></div><button onClick={onClose} aria-label="Close project comparison"><X size={17} /></button></header><div className="modal-scroll-viewport"><div className="modal-content"><div className="compare-grid"><div className="compare-labels"><span>Project</span><span>Language</span><span>Stars</span><span>Forks</span><span>Last update</span><span>Topics</span><span>Summary</span></div>{repos.map(repo => <article key={repo.id}><h3>{repo.name}</h3><b>{repo.language || "Mixed"}</b><b>{repo.stargazers_count}</b><b>{repo.forks_count}</b><b>{new Date(repo.updated_at).toLocaleDateString()}</b><div className="compare-tags">{repo.topics.slice(0, 5).map(topic => <span key={topic}>{topic}</span>)}</div><p>{repo.description || "No public description."}</p></article>)}</div></div></div></section></div>;
}
