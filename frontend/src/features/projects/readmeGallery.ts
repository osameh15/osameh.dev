// README rendering tools and repository gallery discovery.
//
// Asset URLs are normalized exactly once by the shared core; see
// lib/githubAssetUrlCore.js for why double encoding breaks images.

import { encodePathSegments, normalizeReadmeAssetUrl } from "../../lib/githubAssetUrlCore.js";
import type { GithubRepo } from "./repoTypes";

export const GITHUB_OWNER = "osameh15";

/** Repository identity for README asset resolution. */

export const readmeRepoRef = (repo: GithubRepo) => ({ owner: GITHUB_OWNER, repoName: repo.name, defaultBranch: repo.default_branch });

export type MarkdownTools = {
  marked: typeof import("marked").marked;
  DOMPurify: typeof import("dompurify").default;
};

let markdownToolsPromise: Promise<MarkdownTools> | null = null;

export function getMarkdownTools() {
  if (!markdownToolsPromise) {
    markdownToolsPromise = Promise.all([import("marked"), import("dompurify")])
      .then(([markedModule, domPurifyModule]) => ({
        marked: markedModule.marked,
        DOMPurify: domPurifyModule.default,
      }));
  }
  return markdownToolsPromise;
}

export type RepoGalleryImage = {
  path: string;
  url: string;
  name: string;
  source?: "repository" | "readme";
};

export function readmeImages(markdown: string, repo: GithubRepo): RepoGalleryImage[] {
  if (!markdown.trim()) return [];
  const badImage = /(shields\.io|badge|travis|codecov|workflow\/status|license|licence|mit[-_ ]?(?:logo|badge)|copyright)/i;
  const projectImage = /(screenshot|screen[-_ ]?shot|preview|demo|showcase|interface|dashboard|form[-_ ]?management|app[-_ ]?screen|ui[-_ ]|docs\/screenshots|images?\/)/i;
  const candidates: { alt: string; source: string }[] = [];

  const markdownImage = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of markdown.matchAll(markdownImage)) {
    candidates.push({ alt: match[1] || "", source: match[2] || match[3] || "" });
  }

  const documentNode = new DOMParser().parseFromString(markdown, "text/html");
  documentNode.querySelectorAll("img").forEach(image => {
    candidates.push({ alt: image.getAttribute("alt") || "", source: image.getAttribute("src") || "" });
  });

  const seenSource = new Set<string>();
  const seenUrl = new Set<string>();
  const usable = candidates
    .filter(image => image.source && !badImage.test(image.alt + " " + image.source))
    .filter(image => {
      const key = image.source.trim();
      if (!key || seenSource.has(key)) return false;
      seenSource.add(key);
      return true;
    })
    .sort((a, b) => Number(projectImage.test(b.alt + " " + b.source)) - Number(projectImage.test(a.alt + " " + a.source)));

  const images: RepoGalleryImage[] = [];
  for (const candidate of usable) {
    const normalized = normalizeReadmeAssetUrl(candidate.source, readmeRepoRef(repo));
    if (!normalized || seenUrl.has(normalized)) continue;
    seenUrl.add(normalized);
    const rawPath = candidate.source.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/^\/+/, "");
    const fallbackName = rawPath.split("/").filter(Boolean).pop() || candidate.alt || "README image";
    images.push({ path: rawPath || candidate.alt || fallbackName, url: normalized, name: candidate.alt || fallbackName, source: "readme" });
  }
  return images;
}

export function readmeImage(markdown: string, repo: GithubRepo) {
  return readmeImages(markdown, repo)[0]?.url || "";
}

export function mergeGalleryImages(...groups: RepoGalleryImage[][]) {
  const seen = new Set<string>();
  const merged: RepoGalleryImage[] = [];
  for (const group of groups) {
    for (const image of group) {
      if (!image.url || seen.has(image.url)) continue;
      seen.add(image.url);
      merged.push(image);
    }
  }
  return merged;
}

export async function renderMarkdown(markdown: string, repo: GithubRepo) {
  const { marked, DOMPurify } = await getMarkdownTools();
  const parsed = marked.parse(markdown, { gfm: true, breaks: false }) as string;
  const sanitized = DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "srcset"],
  });
  const documentNode = new DOMParser().parseFromString(sanitized, "text/html");

  documentNode.querySelectorAll("img").forEach(image => {
    const safeSource = normalizeReadmeAssetUrl(image.getAttribute("src") || "", readmeRepoRef(repo));
    if (!safeSource) image.remove();
    else {
      image.src = safeSource;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
    }
  });

  documentNode.querySelectorAll("a").forEach(link => {
    const href = (link.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#")) return;
    if (/^mailto:/i.test(href) || /^https:\/\//i.test(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      const clean = href.replace(/^\.\//, "").replace(/^\//, "");
      link.href = `https://github.com/${GITHUB_OWNER}/${encodeURIComponent(repo.name)}/blob/${encodePathSegments(repo.default_branch)}/${clean}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return;
    }
    link.removeAttribute("href");
  });

  return DOMPurify.sanitize(documentNode.body.innerHTML, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "loading", "decoding", "referrerpolicy"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "srcset"],
  });
}
