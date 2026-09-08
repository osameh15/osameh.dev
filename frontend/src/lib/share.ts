// Native share with a clipboard fallback. Extracted during the v5.3.0
// architecture refactor; behavior is unchanged.

import { trackEvent } from "./analytics";
import { notify } from "./toast";
import type { RepoLike } from "../data/portfolioData";

export async function shareProject(repo: RepoLike) {
  const url = `${window.location.origin}/projects/${encodeURIComponent(repo.name)}`;
  const data = { title: `${repo.name} - Osameh Irandoust`, text: repo.description || `Explore ${repo.name} on osameh.dev`, url };
  if (navigator.share) {
    try {
      await navigator.share(data);
      trackEvent("project_share", repo.name);
      notify(`${repo.name} shared successfully.`, "success");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    trackEvent("project_share_copy", repo.name);
    notify("Project link copied to clipboard.", "success");
    return true;
  } catch {
    notify("This browser blocked the share and clipboard actions.", "error");
    return false;
  }
}
