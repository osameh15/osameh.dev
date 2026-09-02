export type EngineeringNote = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  tags: string[];
};

export const engineeringNotes: EngineeringNote[] = [
  {
    slug: "repository-driven-portfolio",
    title: "Turning a portfolio into a repository-driven system",
    summary: "How portfolio.json, a same-origin GitHub proxy, metadata caching, and graceful fallbacks turn project pages into repository-owned product surfaces.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 7,
    tags: ["Architecture", "GitHub", "React", "PHP"],
  },
  {
    slug: "pinned-ftps-deployments",
    title: "Deploying over FTPS when the certificate chain is not trusted",
    summary: "A practical certificate-pinning workflow that verifies the server before credentials are used, without weakening the deployment model.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 6,
    tags: ["CI/CD", "Security", "GitHub Actions", "FTPS"],
  },
  {
    slug: "safe-github-source-explorer",
    title: "Designing a safe source explorer for public repositories",
    summary: "The constraints behind a browser-based repository tree: allowlists, binary filtering, file-size limits, server-side tokens, caching, and useful loading states.",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    readingMinutes: 8,
    tags: ["Security", "GitHub API", "UX", "Caching"],
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
