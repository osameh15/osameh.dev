export type EngineeringNote = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  tags: string[];
  /** Repository names this note is actually about. Manual and authoritative. */
  relatedProjects?: string[];
  /** Client case-study ids this note is actually about. */
  relatedCaseStudies?: string[];
};

/**
 * Newest first. This array is the authoritative order for the index, adjacency,
 * the Command Palette and the Terminal, so a new note is authored at the top
 * rather than sorted at runtime - one order, visible in the diff.
 */
export const engineeringNotes: EngineeringNote[] = [
  {
    slug: "architecting-hirava-recruitment-marketplace",
    title: "Architecting Hirava: A Two-Sided Recruitment Marketplace in Nuxt 4 Compatibility Mode",
    summary: "Structuring a frontend around two participants — companies and recruiters — while the Go backend it will talk to does not exist yet, without letting the browser become the system of record.",
    publishedAt: "2026-09-14",
    updatedAt: "2026-09-14",
    readingMinutes: 7,
    tags: ["Architecture", "Nuxt", "Frontend", "Product Engineering"],
    relatedCaseStudies: ["hirava"],
  },
  {
    slug: "designing-trust-into-hiring-workflows",
    title: "Designing trust into hiring workflows",
    summary: "Recruiter scoring, candidate caps, verification and transparent pipelines — what a frontend can model, and what a backend has to guarantee before any of it is a promise.",
    publishedAt: "2026-09-14",
    updatedAt: "2026-09-14",
    readingMinutes: 8,
    tags: ["Architecture", "Marketplace", "Trust", "Recruitment"],
    relatedCaseStudies: ["hirava"],
  },
  {
    slug: "repository-driven-portfolio",
    title: "Turning a portfolio into a repository-driven system",
    summary: "How portfolio.json, a same-origin GitHub proxy, metadata caching, and graceful fallbacks turn project pages into repository-owned product surfaces.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 7,
    tags: ["Architecture", "GitHub", "React", "PHP"],
    relatedProjects: ["osameh.dev"],
  },
  {
    slug: "pinned-ftps-deployments",
    title: "Deploying over FTPS when the certificate chain is not trusted",
    summary: "A practical certificate-pinning workflow that verifies the server before credentials are used, without weakening the deployment model.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 6,
    tags: ["CI/CD", "Security", "GitHub Actions", "FTPS"],
    relatedProjects: ["osameh.dev"],
  },
  {
    slug: "safe-github-source-explorer",
    title: "Designing a safe source explorer for public repositories",
    summary: "The constraints behind a browser-based repository tree: allowlists, binary filtering, file-size limits, server-side tokens, caching, and useful loading states.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 8,
    tags: ["Security", "GitHub API", "UX", "Caching"],
    relatedProjects: ["osameh.dev"],
  },
  {
    slug: "shared-hosting-cache-strategy",
    title: "A practical cache strategy for Vite on shared hosting",
    summary: "Why hashed assets should be immutable while HTML, build metadata, and service workers stay revalidated — especially behind a CDN.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 5,
    tags: ["Vite", "CDN", "Caching", "Performance"],
  },
];

/**
 * Previous/Next neighbours for a Note.
 *
 * `engineeringNotes` above is the single authoritative order - the same array
 * the Notes index renders and the Command Palette, Terminal and context menus
 * already read. Adjacency is derived from it rather than from filenames, URLs
 * or a second ordering table, so reordering one list reorders everything.
 *
 * The first Note has no previous and the last has no next; those sides are
 * `null` and must render no navigation action at all, not a disabled control.
 */
export function adjacentNotes(slug: string): { previous: EngineeringNote | null; next: EngineeringNote | null } {
  const index = engineeringNotes.findIndex(note => note.slug === slug);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: engineeringNotes[index - 1] ?? null,
    next: engineeringNotes[index + 1] ?? null,
  };
}
