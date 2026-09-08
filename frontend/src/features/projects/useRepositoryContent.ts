import { useRef, useState } from "react";
import { mergeGalleryImages, readmeImage, readmeImages, type RepoGalleryImage } from "./readmeGallery";
import type { GithubRepo } from "./repoTypes";

/**
 * Repository README and gallery content.
 *
 * A repository's README is fetched once and reused: the promise itself is
 * cached, so two surfaces asking at the same moment share one request rather
 * than racing. Gallery discovery merges the repository's own image listing with
 * the images referenced by its README.
 *
 * Every failure degrades rather than throwing - the portfolio renders from
 * checked-in fallback data, and live repository content is enhancement.
 */
export function useRepositoryContent() {
  const [readmeMarkdown, setReadmeMarkdown] = useState<Record<string, string>>({});
  const [repoImages, setRepoImages] = useState<Record<string, string>>({});
  const [repoGalleries, setRepoGalleries] = useState<Record<string, RepoGalleryImage[]>>({});
  const [loadingGalleries, setLoadingGalleries] = useState<string[]>([]);
  const readmeRequests = useRef<Map<string, Promise<string>>>(new Map());
  const galleryRequests = useRef<Map<string, Promise<RepoGalleryImage[]>>>(new Map());

  const loadReadme = (repo: GithubRepo) => {
    const cached = readmeRequests.current.get(repo.name);
    if (cached) return cached;

    const request = (async () => {
      if (window.location.protocol === "file:") return "";

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(`/api/github/readme/${encodeURIComponent(repo.name)}`, {
          headers: { Accept: "text/markdown, text/plain;q=0.9" },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return "";
        const contentType = response.headers.get("content-type") || "";
        const markdown = await response.text();
        // Never accept a repository-list JSON response as README content.
        if (/application\/json/i.test(contentType) || /^\s*\[\s*\{/.test(markdown)) return "";

        setReadmeMarkdown(current => ({ ...current, [repo.name]: markdown }));
        setRepoImages(current => ({ ...current, [repo.name]: readmeImage(markdown, repo) }));
        return markdown;
      } catch {
        setReadmeMarkdown(current => ({ ...current, [repo.name]: "" }));
        setRepoImages(current => ({ ...current, [repo.name]: "" }));
        return "";
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    readmeRequests.current.set(repo.name, request);
    return request;
  };

  const loadGallery = (repo: GithubRepo) => {
    const cached = galleryRequests.current.get(repo.name);
    if (cached) return cached;

    const request = (async () => {
      setLoadingGalleries(current => current.includes(repo.name) ? current : [...current, repo.name]);
      try {
        let repositoryImages: RepoGalleryImage[] = [];
        if (window.location.protocol !== "file:") {
          const response = await fetch(`/api/github/images/${encodeURIComponent(repo.name)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (response.ok) {
            const payload = await response.json() as RepoGalleryImage[];
            if (Array.isArray(payload)) repositoryImages = payload.filter(image => image && typeof image.url === "string" && typeof image.path === "string");
          }
        }

        const markdown = readmeMarkdown[repo.name] !== undefined ? readmeMarkdown[repo.name] : await loadReadme(repo);
        const fromReadme = markdown ? readmeImages(markdown, repo) : [];
        const merged = mergeGalleryImages(repositoryImages, fromReadme);
        setRepoGalleries(current => ({ ...current, [repo.name]: merged }));
        if (merged.length) setRepoImages(current => current[repo.name] ? current : ({ ...current, [repo.name]: merged[0].url }));
        return merged;
      } catch {
        const markdown = readmeMarkdown[repo.name] || "";
        const fromReadme = markdown ? readmeImages(markdown, repo) : [];
        setRepoGalleries(current => ({ ...current, [repo.name]: fromReadme }));
        return fromReadme;
      } finally {
        setLoadingGalleries(current => current.filter(name => name !== repo.name));
      }
    })();

    galleryRequests.current.set(repo.name, request);
    return request;
  };

  return { loadReadme, loadGallery, loadingGalleries, readmeMarkdown, repoGalleries, repoImages };
}
