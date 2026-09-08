// The editor-tab model.
//
// One ordered collection is the single source of truth for every closable
// tab. Home is implicit, always first, and never stored here.

import type { GithubRepo } from "../features/projects/repoTypes";

// Shared editor-tab model. Every tab-backed view uses one lifecycle: activating a
// tab never removes another, closing the active tab activates the tab to its
// left, and each tab knows which Home section it came from so returning Home
// restores the right place.
export const HOME_TAB_ID = "home";

export type EditorTab =
  | { id: string; kind: "project"; repo: GithubRepo; title: string; path: string; homeSection: string }
  | { id: string; kind: "note"; slug: string; title: string; path: string; homeSection: string };

export const projectTabId = (repo: GithubRepo) => `project:${repo.id}`;

export const noteTabId = (slug: string) => `note:${slug}`;

export const projectTab = (repo: GithubRepo): EditorTab => ({
  id: projectTabId(repo), kind: "project", repo,
  title: `${repo.name}.md`, path: `/projects/${encodeURIComponent(repo.name)}`, homeSection: "/projects",
});

export const noteTab = (slug: string): EditorTab => ({
  id: noteTabId(slug), kind: "note", slug,
  title: `${slug}.md`, path: `/notes/${encodeURIComponent(slug)}`, homeSection: "/notes",
});

/** Tab activated when `closingId` is closed: the one immediately to its left, or Home. */

export function tabAfterClose(tabs: EditorTab[], closingId: string): EditorTab | null {
  const index = tabs.findIndex(tab => tab.id === closingId);
  return index > 0 ? tabs[index - 1] : null;
}
