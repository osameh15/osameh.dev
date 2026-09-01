import { caseStudyFor, type RepoLike } from "./portfolioData";

export type PortfolioChallenge = {
  title: string;
  description: string;
  resolution: string;
};

export type ArchitectureNode = {
  id: string;
  label: string;
  type: string;
};

export type ArchitectureEdge = {
  from: string;
  to: string;
  label?: string;
};

export type PortfolioMetadata = {
  $schema?: string;
  schemaVersion: string;
  project: {
    slug: string;
    name: string;
    tagline: string;
    summary: string;
    type: string;
    lifecycle: string;
    featured: boolean;
    featuredOrder: number;
    legacy: boolean;
  };
  ownership: {
    role: string;
    collaboration: string;
    organization?: string | null;
    responsibilities: string[];
  };
  links: {
    repository?: string | null;
    live?: string | null;
    demo?: string | null;
    documentation?: string | null;
    package?: string | null;
  };
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
    license?: string | null;
  };
  stack: {
    languages: string[];
    frameworks: string[];
    libraries: string[];
    platforms: string[];
    databases: string[];
    tooling: string[];
    concepts: string[];
  };
  caseStudy: {
    problem: string;
    solution: string;
    highlights: string[];
    challenges: PortfolioChallenge[];
    results: string[];
  };
  architecture: {
    summary: string;
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  media: {
    cover?: { strategy?: string; path?: string | null; alt?: string };
    gallery?: {
      autoDiscover?: boolean;
      include?: string[];
      exclude?: string[];
      extensions?: string[];
      preferred?: string[];
    };
    screenshots?: unknown[];
  };
  sourceExplorer: {
    enabled: boolean;
    maxFileSizeKb: number;
    exclude: string[];
    entryPoints?: string[];
  };
  recruiter: {
    headline: string;
    skillsDemonstrated: string[];
    talkingPoints: string[];
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
};

export type MetadataResponse = {
  found: boolean;
  repo: string;
  metadata?: PortfolioMetadata;
};

export type SourceTreeFile = {
  path: string;
  name: string;
  size: number;
  language: string;
};

export type SourceTreePayload = {
  repo: string;
  branch: string;
  entryPoints: string[];
  maxFileSizeKb: number;
  truncated?: boolean;
  files: SourceTreeFile[];
};

export type ProjectMetricsPayload = {
  repo: string;
  default_branch: string;
  size_kb: number;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage?: string | null;
  license?: { spdx: string; name: string } | null;
  languages: { name: string; bytes: number; percent: number }[];
  latest_release?: { tag: string; name: string; published_at: string; url: string; prerelease: boolean } | null;
};

export type SourceFilePayload = {
  repo: string;
  branch: string;
  path: string;
  name: string;
  size: number;
  language: string;
  content: string;
  html_url: string;
};

function cleanList(values: unknown, fallback: string[] = []) {
  if (!Array.isArray(values)) return fallback;
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function normalizePortfolioMetadata(input: unknown, repo: RepoLike): PortfolioMetadata | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<PortfolioMetadata>;
  if (!value.project || !value.repository || !value.caseStudy || !value.architecture) return null;
  const project = value.project as PortfolioMetadata["project"];
  const repository = value.repository as PortfolioMetadata["repository"];
  const caseStudy = value.caseStudy as PortfolioMetadata["caseStudy"];
  const architecture = value.architecture as PortfolioMetadata["architecture"];
  const sourceExplorer = (value.sourceExplorer || {}) as PortfolioMetadata["sourceExplorer"];
  const recruiter = (value.recruiter || {}) as PortfolioMetadata["recruiter"];
  const stack = (value.stack || {}) as PortfolioMetadata["stack"];
  const ownership = (value.ownership || {}) as PortfolioMetadata["ownership"];
  const links = (value.links || {}) as PortfolioMetadata["links"];
  const seo = (value.seo || {}) as PortfolioMetadata["seo"];

  return {
    $schema: typeof value.$schema === "string" ? value.$schema : undefined,
    schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion : "1.0.0",
    project: {
      slug: project.slug || repo.name,
      name: project.name || repo.name,
      tagline: project.tagline || repo.description || `${repo.name} project`,
      summary: project.summary || repo.description || `${repo.name} is a public software project.`,
      type: project.type || "Software project",
      lifecycle: project.lifecycle || "maintained",
      featured: Boolean(project.featured),
      featuredOrder: Number.isFinite(Number(project.featuredOrder)) ? Number(project.featuredOrder) : 999,
      legacy: Boolean(project.legacy),
    },
    ownership: {
      role: ownership.role || "Software Developer",
      collaboration: ownership.collaboration || "solo",
      organization: ownership.organization ?? null,
      responsibilities: cleanList(ownership.responsibilities),
    },
    links: {
      repository: links.repository || `https://github.com/osameh15/${repo.name}`,
      live: links.live || null,
      demo: links.demo || null,
      documentation: links.documentation || null,
      package: links.package || null,
    },
    repository: {
      owner: repository.owner || "osameh15",
      name: repository.name || repo.name,
      defaultBranch: repository.defaultBranch || repo.default_branch || "main",
      license: repository.license ?? null,
    },
    stack: {
      languages: cleanList(stack.languages, repo.language ? [repo.language] : []),
      frameworks: cleanList(stack.frameworks),
      libraries: cleanList(stack.libraries),
      platforms: cleanList(stack.platforms),
      databases: cleanList(stack.databases),
      tooling: cleanList(stack.tooling),
      concepts: cleanList(stack.concepts, repo.topics),
    },
    caseStudy: {
      problem: caseStudy.problem || "",
      solution: caseStudy.solution || "",
      highlights: cleanList(caseStudy.highlights),
      challenges: Array.isArray(caseStudy.challenges)
        ? caseStudy.challenges.filter((challenge): challenge is PortfolioChallenge => Boolean(challenge && typeof challenge === "object" && "title" in challenge))
        : [],
      results: cleanList(caseStudy.results),
    },
    architecture: {
      summary: architecture.summary || "",
      nodes: Array.isArray(architecture.nodes) ? architecture.nodes.filter((node): node is ArchitectureNode => Boolean(node && typeof node === "object" && "id" in node && "label" in node)) : [],
      edges: Array.isArray(architecture.edges) ? architecture.edges.filter((edge): edge is ArchitectureEdge => Boolean(edge && typeof edge === "object" && "from" in edge && "to" in edge)) : [],
    },
    media: value.media || { screenshots: [] },
    sourceExplorer: {
      enabled: sourceExplorer.enabled !== false,
      maxFileSizeKb: Number(sourceExplorer.maxFileSizeKb || 300),
      exclude: cleanList(sourceExplorer.exclude),
      entryPoints: cleanList(sourceExplorer.entryPoints),
    },
    recruiter: {
      headline: recruiter.headline || project.tagline || repo.description || repo.name,
      skillsDemonstrated: cleanList(recruiter.skillsDemonstrated),
      talkingPoints: cleanList(recruiter.talkingPoints),
    },
    seo: {
      title: seo.title || `${repo.name} — Osameh Irandoust`,
      description: seo.description || project.summary || repo.description || repo.name,
      keywords: cleanList(seo.keywords, [repo.language || "software", ...repo.topics].filter(Boolean) as string[]),
    },
  };
}

export function fallbackPortfolioMetadata(repo: RepoLike): PortfolioMetadata {
  const study = caseStudyFor(repo);
  const language = repo.language || "Software";
  return {
    schemaVersion: "fallback",
    project: {
      slug: repo.name,
      name: repo.name,
      tagline: repo.description || `${repo.name} public project`,
      summary: repo.description || `A public ${language} project maintained on GitHub.`,
      type: "Software project",
      lifecycle: "maintained",
      featured: false,
      featuredOrder: 999,
      legacy: false,
    },
    ownership: {
      role: "Software Developer",
      collaboration: "solo",
      organization: null,
      responsibilities: [],
    },
    links: {
      repository: `https://github.com/osameh15/${repo.name}`,
      live: null,
      demo: null,
      documentation: null,
      package: null,
    },
    repository: {
      owner: "osameh15",
      name: repo.name,
      defaultBranch: repo.default_branch || "main",
      license: null,
    },
    stack: {
      languages: repo.language ? [repo.language] : [],
      frameworks: [], libraries: [], platforms: [], databases: [], tooling: [], concepts: repo.topics,
    },
    caseStudy: {
      problem: study.problem,
      solution: study.solution,
      highlights: study.architecture,
      challenges: study.challenges.map((item, index) => ({ title: `Engineering challenge ${index + 1}`, description: item, resolution: "Addressed through project-specific design and implementation decisions." })),
      results: study.results,
    },
    architecture: {
      summary: study.architecture.join(" · "),
      nodes: study.architecture.map((label, index) => ({ id: `layer-${index + 1}`, label, type: index === 0 ? "client" : "service" })),
      edges: study.architecture.slice(1).map((_, index) => ({ from: `layer-${index + 1}`, to: `layer-${index + 2}`, label: "flows to" })),
    },
    media: { screenshots: [] },
    sourceExplorer: { enabled: true, maxFileSizeKb: 300, exclude: [], entryPoints: ["README.md"] },
    recruiter: {
      headline: repo.description || `${repo.name} public software project`,
      skillsDemonstrated: [language, ...repo.topics].filter(Boolean).slice(0, 7),
      talkingPoints: ["Public source available on GitHub", `Default branch: ${repo.default_branch || "main"}`],
    },
    seo: {
      title: `${repo.name} — Osameh Irandoust`,
      description: repo.description || `${repo.name} public software project`,
      keywords: [language, ...repo.topics].filter(Boolean),
    },
  };
}

export async function fetchPortfolioMetadata(repo: RepoLike): Promise<PortfolioMetadata> {
  if (typeof window !== "undefined" && window.location.protocol === "file:") return fallbackPortfolioMetadata(repo);
  try {
    const response = await fetch(`/api/github/meta/${encodeURIComponent(repo.name)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("metadata");
    const payload = await response.json() as MetadataResponse;
    const normalized = normalizePortfolioMetadata(payload.metadata, repo);
    return normalized || fallbackPortfolioMetadata(repo);
  } catch {
    return fallbackPortfolioMetadata(repo);
  }
}
