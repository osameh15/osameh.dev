"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle, ArrowUpRight, Braces, BriefcaseBusiness as Linkedin, Camera as Instagram,
  Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Code2, Command, Copy, Download, ExternalLink, FileCode2,
  FolderOpen, GitBranch as Github, GitFork as Gitlab, Home as HomeIcon, Link2, Mail, MapPin, Menu,
  CornerDownLeft, Info, ListTree, LoaderCircle, Maximize2, MessageCircle, Minimize2, PanelBottom, RefreshCw,
  Image as ImageIcon, LayoutGrid, Monitor, Moon, Package, Search, Send, ServerCog, Star, Sun, Terminal, Type, X, Zap,
} from "lucide-react";
import { BUILD_DISPLAY, BUILD_ID, BUILD_TIME, BUILD_VERSION } from "./generated/build";
import { BuildInfoModal, ChangelogSection, ContactForm, GithubActivity, NowSection, ProjectCompare, PwaInstallControl, ResumeViewer, ShortcutGuide, SystemDiagnostics, shareProject, trackEvent } from "./AdvancedUI";
import type { ToastKind, ToastPayload } from "./toast";
import { FeaturedProjects, ProjectArchitecture, ProjectCaseStudyV3, ProjectMetadataPanel, ProjectMetrics, ProjectQuickAccess, ProjectSourceExplorer, RecruiterMode } from "./ProjectIntelligence";
import { fetchPortfolioMetadata, type PortfolioMetadata } from "./projectMetadata";
import { EngineeringNotesSection, EngineeringNoteView } from "./EngineeringNotes";
import { engineeringNotes } from "./notesData";

type ThemePreference = "dark" | "light" | "system";
type FontPreference = "inter" | "mono" | "humanist" | "serif";
type CodeLanguage = "typescript" | "cpp" | "csharp" | "java" | "go" | "python" | "php";

const codeProfiles: Record<CodeLanguage, { label: string; file: string; projects: string; stack: string; open: string; close: string; comment: string }> = {
  typescript: { label: "TypeScript", file: "home.tsx", projects: "projects.ts", stack: "stack.ts", open: "const engineer = {", close: "};", comment: "// based in Tehran, working globally" },
  cpp: { label: "C++", file: "main.cpp", projects: "projects.cpp", stack: "stack.cpp", open: "auto engineer = Engineer{", close: "};", comment: "// based in Tehran, working globally" },
  csharp: { label: "C#", file: "Portfolio.cs", projects: "Projects.cs", stack: "Stack.cs", open: "var engineer = new Engineer {", close: "};", comment: "// based in Tehran, working globally" },
  java: { label: "Java", file: "Portfolio.java", projects: "Projects.java", stack: "Stack.java", open: "Engineer engineer = new Engineer() {{", close: "}};", comment: "// based in Tehran, working globally" },
  go: { label: "Go", file: "main.go", projects: "projects.go", stack: "stack.go", open: "engineer := Engineer{", close: "}", comment: "// based in Tehran, working globally" },
  python: { label: "Python", file: "portfolio.py", projects: "projects.py", stack: "stack.py", open: "engineer = {", close: "}", comment: "# based in Tehran, working globally" },
  php: { label: "PHP", file: "index.php", projects: "projects.php", stack: "stack.php", open: "$engineer = [", close: "];", comment: "// based in Tehran, working globally" },
};

const contactFiles: Record<CodeLanguage, string> = {
  typescript: "send-message.ts",
  cpp: "send_message.cpp",
  csharp: "SendMessage.cs",
  java: "SendMessage.java",
  go: "send_message.go",
  python: "send_message.py",
  php: "send-message.php",
};

const fontOptions: { id: FontPreference; label: string; sample: string }[] = [
  { id: "inter", label: "Inter / System", sample: "Aa" },
  { id: "mono", label: "Developer Mono", sample: "{}" },
  { id: "humanist", label: "Humanist", sample: "Ag" },
  { id: "serif", label: "Editorial Serif", sample: "Ss" },
];

type GithubRepo = {
  id: number; name: string; description: string | null; language: string | null;
  topics: string[]; stargazers_count: number; forks_count: number; archived: boolean;
  updated_at: string; fork: boolean; default_branch: string;
};

const fallbackRepos: GithubRepo[] = [
  { id: 111, name: "osameh.dev", description: "An IDE-inspired, repository-driven software engineering portfolio with secure GitHub integration and automated deployment.", language: "TypeScript", topics: ["react", "typescript", "php", "devops", "portfolio"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-09-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 101, name: "toast-notifications", description: "A beautiful, zero-dependency toast notification module for Nuxt 3 and 4.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 1, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 102, name: "confirm-dialogs", description: "Promise-based confirmation dialogs for Nuxt 3 and 4 with accessible RTL support.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 103, name: "input-dialog", description: "A clean input prompt module for fast user interactions in Nuxt applications.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 107, name: "Form-Management", description: "A zero-dependency drag-and-drop form builder and renderer for Nuxt 3 and Nuxt 4.", language: "TypeScript", topics: ["nuxt", "vue", "typescript", "form-builder"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-08-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 104, name: "Mizekar", description: "A modern fullscreen Windows folder manager with full Persian language support.", language: "C#", topics: ["dotnet", "wpf", "windows"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 108, name: "YariZan", description: "A modern Persian launcher for educational mini-games for grades 1–6.", language: "C#", topics: ["dotnet", "education", "games"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-07-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 105, name: "Dialysis", description: "An Android application that helps dialysis patients with monitoring and reminders.", language: "Java", topics: ["android", "health"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "master" },
  { id: 106, name: "ArappMain", description: "An Android rating and review application.", language: "Kotlin", topics: ["android", "kotlin"], stargazers_count: 2, forks_count: 1, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 109, name: "ArappMainBack-End", description: "The backend and supporting web application for the Arapp platform.", language: "PHP", topics: ["php", "backend", "web"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-03-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 110, name: "ArappOfficialSite", description: "The official web experience for the Arapp project.", language: "PHP", topics: ["php", "web"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-03-01T00:00:00Z", fork: false, default_branch: "master" },
];

const npmPackages: Record<string, string> = {
  "toast-notifications": "nuxt-toast-notification",
  "confirm-dialogs": "nuxt-confirm-dialog",
  "input-dialog": "nuxt-input-dialog",
  "Form-Management": "nuxt-form-management",
};

const npmUrl = (repoName: string) => npmPackages[repoName]
  ? `https://www.npmjs.com/package/${npmPackages[repoName]}`
  : "";

type SearchResult = { label: string; path: string; kind: "section" | "project" };

type ContextMenuState = {
  x: number;
  y: number;
  repoName?: string;
  imageUrl?: string;
  imageIndex?: number;
  linkUrl?: string;
  linkLabel?: string;
  selection?: string;
};

type PaletteCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: "home" | "code" | "about" | "experience" | "contact" | "terminal" | "theme" | "github" | "linkedin" | "copy" | "build" | "hire";
  action: () => void;
};

const sections: SearchResult[] = [
  { label: "Home", path: "/home", kind: "section" },
  { label: "About me", path: "/about", kind: "section" },
  { label: "Projects", path: "/projects", kind: "section" },
  { label: "Experience", path: "/experience", kind: "section" },
  { label: "Now", path: "/now", kind: "section" },
  { label: "Changelog", path: "/changelog", kind: "section" },
  { label: "Contact", path: "/contact", kind: "section" },
  { label: "Engineering Notes", path: "/notes", kind: "section" },
];

const GITHUB_OWNER = "osameh15";

function encodePathSegments(value: string) {
  return value.split("/").filter(Boolean).map(segment => encodeURIComponent(segment)).join("/");
}

function normalizeReadmeAssetUrl(source: string, repo: GithubRepo) {
  const value = source.replace(/&amp;/g, "&").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("//")) return "https:" + value;

  if (/^https:\/\//i.test(value)) {
    // GitHub blob links are HTML pages, not image resources. Convert the common form to raw content.
    const blob = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
    if (blob && blob[1].toLowerCase() === GITHUB_OWNER.toLowerCase() && blob[2].toLowerCase() === repo.name.toLowerCase()) {
      return `https://raw.githubusercontent.com/${encodeURIComponent(blob[1])}/${encodeURIComponent(blob[2])}/${encodePathSegments(blob[3])}/${encodePathSegments(blob[4])}`;
    }

    // Repair legacy malformed raw.githubusercontent.com paths that omit owner/repo/branch.
    try {
      const absolute = new URL(value);
      if (absolute.hostname.toLowerCase() === "raw.githubusercontent.com") {
        const parts = absolute.pathname.split("/").filter(Boolean);
        const alreadyCanonical = parts.length >= 4 && parts[0].toLowerCase() === GITHUB_OWNER.toLowerCase() && parts[1].toLowerCase() === repo.name.toLowerCase();
        if (!alreadyCanonical && parts.length) {
          return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${encodeURIComponent(repo.name)}/${encodePathSegments(repo.default_branch)}/${encodePathSegments(parts.join("/"))}`;
        }
      }
    } catch {
      return "";
    }
    return value;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";

  const clean = value.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/^\/+/, "");
  if (!clean) return "";
  const base = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${encodeURIComponent(repo.name)}/${encodePathSegments(repo.default_branch)}/`;
  try {
    return new URL(clean, base).href;
  } catch {
    return "";
  }
}

type MarkdownTools = {
  marked: typeof import("marked").marked;
  DOMPurify: typeof import("dompurify").default;
};

let markdownToolsPromise: Promise<MarkdownTools> | null = null;

function getMarkdownTools() {
  if (!markdownToolsPromise) {
    markdownToolsPromise = Promise.all([import("marked"), import("dompurify")])
      .then(([markedModule, domPurifyModule]) => ({
        marked: markedModule.marked,
        DOMPurify: domPurifyModule.default,
      }));
  }
  return markdownToolsPromise;
}

type RepoGalleryImage = {
  path: string;
  url: string;
  name: string;
  source?: "repository" | "readme";
};

function readmeImages(markdown: string, repo: GithubRepo): RepoGalleryImage[] {
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
    const normalized = normalizeReadmeAssetUrl(candidate.source, repo);
    if (!normalized || seenUrl.has(normalized)) continue;
    seenUrl.add(normalized);
    const rawPath = candidate.source.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/^\/+/, "");
    const fallbackName = rawPath.split("/").filter(Boolean).pop() || candidate.alt || "README image";
    images.push({ path: rawPath || candidate.alt || fallbackName, url: normalized, name: candidate.alt || fallbackName, source: "readme" });
  }
  return images;
}

function readmeImage(markdown: string, repo: GithubRepo) {
  return readmeImages(markdown, repo)[0]?.url || "";
}

function mergeGalleryImages(...groups: RepoGalleryImage[][]) {
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

async function renderMarkdown(markdown: string, repo: GithubRepo) {
  const { marked, DOMPurify } = await getMarkdownTools();
  const parsed = marked.parse(markdown, { gfm: true, breaks: false }) as string;
  const sanitized = DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "srcset"],
  });
  const documentNode = new DOMParser().parseFromString(sanitized, "text/html");

  documentNode.querySelectorAll("img").forEach(image => {
    const safeSource = normalizeReadmeAssetUrl(image.getAttribute("src") || "", repo);
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

const roles = [
  { years: "Apr 2026 — Present", company: "Navatel", role: "Software Engineer", detail: "Building and improving production software as part of Navatel’s engineering team." },
  { years: "2017 — Present", company: "Independent / Freelance", role: "Freelance Software Developer", detail: "Delivering end-to-end client work across full-stack web applications, backend services, WordPress solutions, custom themes and plugins, automation, integrations, deployment, and long-term maintenance. I enjoy taking freelance projects from requirements and architecture through implementation, launch, optimization, and support." },
  { years: "2024 — 2026", company: "Fluxudio", role: "Software Engineer", detail: "Scalable .NET and Ruby services, Nuxt applications, ELK observability, Docker, and AI-assisted workflows." },
  { years: "2021 — 2024", company: "Datall", role: "Full Stack Developer", detail: "High-performance C++/Qt systems, PostgreSQL and Cassandra optimization, architecture built for reliability." },
  { years: "2019 — 2021", company: "Arrap Startup", role: "Android Developer", detail: "End-to-end Android products with Java and Kotlin, backed by Laravel, MySQL, and Python automation." },
];

const skills = [
  ["Frontend", "Nuxt 3 / 4", "Vue", "TypeScript", "JavaScript"],
  ["Backend", "C# / .NET", "Laravel / PHP", "Ruby", "REST APIs"],
  ["Desktop & Systems", "C++", "Qt / QML", "WPF", ".NET 8"],
  ["Mobile & Games", "Android", "Java", "Kotlin", "Unity"],
  ["Data & DevOps", "PostgreSQL", "MySQL", "Cassandra", "Docker", "ELK Stack"],
  ["Tooling", "Linux", "Python", "Vitest", "GitHub Actions", "Git"],
];

function skillSource(language: CodeLanguage) {
  const values = skills.map(([group, ...items]) => ({ group, items }));
  if (language === "python") return ["class OsamehStack:", ...values.map(({ group, items }) => `    ${group.toLowerCase().replace(/[^a-z]+/g, "_")} = [${items.map(item => `\"${item}\"`).join(", ")}]`)];
  if (language === "php") return ["<?php", "$stack = [", ...values.map(({ group, items }) => `  '${group}' => [${items.map(item => `'${item}'`).join(", ")}],`), "];" ];
  if (language === "cpp") return ["struct OsamehStack {", ...values.map(({ group, items }) => `  vector<string> ${group.toLowerCase().replace(/[^a-z]+/g, "_")} { ${items.map(item => `\"${item}\"`).join(", ")} };`), "};" ];
  if (language === "csharp") return ["public sealed class OsamehStack", "{", ...values.map(({ group, items }) => `  public string[] ${group.replace(/[^a-zA-Z]+/g, "")} => [${items.map(item => `\"${item}\"`).join(", ")}];`), "}" ];
  if (language === "java") return ["public final class OsamehStack {", ...values.map(({ group, items }) => `  List<String> ${group.toLowerCase().replace(/[^a-z]+/g, "_")} = List.of(${items.map(item => `\"${item}\"`).join(", ")});`), "}" ];
  if (language === "go") return ["var osamehStack = map[string][]string{", ...values.map(({ group, items }) => `  \"${group}\": {${items.map(item => `\"${item}\"`).join(", ")}},`), "}" ];
  return ["const osamehStack = {", ...values.map(({ group, items }) => `  ${group.toLowerCase().replace(/[^a-z]+/g, "_")}: [${items.map(item => `\"${item}\"`).join(", ")}],`), "};" ];
}

type ToastState = { message: string; kind: ToastKind } | null;

function BrandMark() {
  return <div className="brand-mark" aria-label="Osameh Irandoust"><span>OI</span><i /></div>;
}


const heroStackByLanguage: Record<CodeLanguage, string[]> = {
  typescript: ["TypeScript", "React", "Vite", "Nuxt", "Node.js", "GitHub Actions"],
  cpp: ["C++", "Qt / QML", "CMake", "Linux", "PostgreSQL", "Systems"],
  csharp: [".NET", "ASP.NET", "WPF", "EF Core", "PostgreSQL", "Docker"],
  java: ["Java", "Android", "REST APIs", "MySQL", "Gradle", "Linux"],
  go: ["Go", "REST APIs", "PostgreSQL", "Docker", "Linux", "Observability"],
  python: ["Python", "Automation", "FastAPI", "PostgreSQL", "Linux", "AI workflows"],
  php: ["PHP", "Laravel", "MySQL", "WordPress", "REST APIs", "Linux"],
};

function AnimatedHeroMetric({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    let frame = 0;
    let observer: IntersectionObserver | null = null;
    let started = false;

    const run = () => {
      if (started) return;
      started = true;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        displayRef.current = value;
        setDisplay(value);
        return;
      }
      const start = performance.now();
      const startValue = displayRef.current;
      const duration = 760;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = Math.round(startValue + (value - startValue) * eased);
        displayRef.current = next;
        setDisplay(next);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          run();
          observer?.disconnect();
        }
      }, { threshold: .35 });
      observer.observe(node);
    } else run();

    return () => {
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [value]);

  return <div ref={rootRef}><strong>{display}{suffix}</strong><span>{label}</span></div>;
}

function HeroShowcase({ codeLanguage, repoCount }: { codeLanguage: CodeLanguage; repoCount: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stack = heroStackByLanguage[codeLanguage];
  const languageLabel = codeProfiles[codeLanguage].label;

  const resetParallax = () => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty("--hero-rotate-x", "0deg");
    node.style.setProperty("--hero-rotate-y", "0deg");
    node.style.setProperty("--hero-shift-x", "0px");
    node.style.setProperty("--hero-shift-y", "0px");
  };

  const updateParallax = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width) - .5;
    const y = (event.clientY - rect.top) / Math.max(1, rect.height) - .5;
    node.style.setProperty("--hero-rotate-y", `${x * 5.5}deg`);
    node.style.setProperty("--hero-rotate-x", `${y * -3.5}deg`);
    node.style.setProperty("--hero-shift-x", `${x * 7}px`);
    node.style.setProperty("--hero-shift-y", `${y * 5}px`);
  };

  return <div ref={rootRef} className="hero-showcase" aria-label="Engineering snapshot" onPointerMove={updateParallax} onPointerLeave={resetParallax}>
    <div className="showcase-grid">
      <article className="showcase-card showcase-card-primary">
        <header><p>ENGINEERING SNAPSHOT</p><span>Live focus</span></header>
        <h3>Systems thinking with product-level polish.</h3>
        <div className="showcase-pipeline"><span>Discover</span><i /><span>Architect</span><i /><span>Build</span><i /><span>Deploy</span></div>
        <div className="showcase-signal-list">
          <div><b>Primary lanes</b><span>.NET APIs · Nuxt products · C++ / Qt systems</span></div>
          <div><b>Delivery style</b><span>From repo design and debugging to production release and maintenance</span></div>
          <div><b>Current mode</b><span>Engineering clean, reliable software with a strong UX layer</span></div>
        </div>
      </article>

      <article className="showcase-card showcase-card-metrics">
        <header><p>IMPACT MAP</p><span>Live counters</span></header>
        <div className="showcase-metrics">
          <AnimatedHeroMetric value={4} suffix="+" label="years shipping production software" />
          <AnimatedHeroMetric value={Math.max(repoCount, 10)} suffix="+" label="public repositories curated in the portfolio" />
          <AnimatedHeroMetric value={3} label="core modes: backend, full-stack, systems" />
        </div>
      </article>

      <article className="showcase-card showcase-card-terminal">
        <header><p>BUILD RHYTHM</p><span>Preferred workflow</span></header>
        <div className="showcase-terminal-lines">
          <span><i>$</i> clarify requirements</span>
          <span><i>$</i> map architecture</span>
          <span><i>$</i> ship resilient code</span>
          <span><i>$</i> optimize, monitor, improve</span>
        </div>
        <div className="showcase-terminal-status"><i /><code>pipeline.ready</code><span className="showcase-mini-cursor" /></div>
      </article>

      <article className="showcase-card showcase-card-stack">
        <header><p>STACK SURFACE</p><span>{languageLabel} lens</span></header>
        <div className="showcase-stack-context"><code>{codeProfiles[codeLanguage].file}</code><span>updates with the language selector</span></div>
        <div className="showcase-chip-cloud" key={codeLanguage}>{stack.map((item, index) => <span key={item} style={{ animationDelay: `${index * 45}ms` }}>{item}</span>)}</div>
      </article>
    </div>
  </div>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [activeSectionPath, setActiveSectionPath] = useState<string>("/home");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [font, setFont] = useState<FontPreference>("inter");
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>("typescript");
  const [skillsView, setSkillsView] = useState<"code" | "ui">("code");
  const [copied, setCopied] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>(fallbackRepos);
  const [repoMetadata, setRepoMetadata] = useState<Record<string, PortfolioMetadata | undefined>>({});
  const [metadataState, setMetadataState] = useState<"idle" | "loading" | "ready">("idle");
  const [recruiterModeOpen, setRecruiterModeOpen] = useState(false);
  const [visibleRepos, setVisibleRepos] = useState(6);
  const [repoState, setRepoState] = useState<"loading" | "ready">("loading");
  const [activeRepo, setActiveRepo] = useState<GithubRepo | null>(null);
  const [activeNoteSlug, setActiveNoteSlug] = useState<string | null>(null);
  const [openedRepos, setOpenedRepos] = useState<GithubRepo[]>([]);
  const [readmeHtml, setReadmeHtml] = useState<Record<string, string>>({});
  const [loadingReadmes, setLoadingReadmes] = useState<string[]>([]);
  const [repoImages, setRepoImages] = useState<Record<string, string>>({});
  const [readmeMarkdown, setReadmeMarkdown] = useState<Record<string, string>>({});
  const [repoGalleries, setRepoGalleries] = useState<Record<string, RepoGalleryImage[]>>({});
  const [loadingGalleries, setLoadingGalleries] = useState<string[]>([]);
  const [galleryLightbox, setGalleryLightbox] = useState<{ repo: string; index: number } | null>(null);
  const readmeRequests = useRef<Map<string, Promise<string>>>(new Map());
  const galleryRequests = useRef<Map<string, Promise<RepoGalleryImage[]>>>(new Map());
  const readmeRenderRequests = useRef<Set<string>>(new Set());
  const pendingSectionScrollRef = useRef<{ id: string; behavior: ScrollBehavior; exact: boolean; token: number } | null>(null);
  const sectionScrollTokenRef = useRef(0);
  const sectionScrollTimersRef = useRef<number[]>([]);
  const projectsSectionRef = useRef<HTMLElement>(null);
  const [projectsNearViewport, setProjectsNearViewport] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notFoundPath, setNotFoundPath] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"outline" | "terminal">("terminal");
  const [terminalInput, setTerminalInput] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [actionToast, setActionToast] = useState<ToastState>(null);
  const [panelHeight, setPanelHeight] = useState(290);
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectTech, setProjectTech] = useState("all");
  const [projectSort, setProjectSort] = useState<"recent" | "stars" | "name">("recent");
  const [compareRepos, setCompareRepos] = useState<GithubRepo[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "› cat welcome.txt",
    "Hi — I'm Osameh, software engineer in Tehran. This site is a small editor.",
    "Type `help` for commands, or just scroll.",
  ]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalCompletionRef = useRef<{ seed: string; matches: string[]; index: number; applied: string }>({ seed: "", matches: [], index: -1, applied: "" });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteListRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const panelResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const keyboardChordRef = useRef<{ key: string; at: number } | null>(null);
  const actionToastTimerRef = useRef<number | null>(null);
  const code = codeProfiles[codeLanguage];
  const skillLines = skillSource(codeLanguage);

  const showActionToast = (message: string, kind: ToastKind = "info", duration = 3200) => {
    setActionToast({ message, kind });
    if (actionToastTimerRef.current !== null) window.clearTimeout(actionToastTimerRef.current);
    actionToastTimerRef.current = window.setTimeout(() => setActionToast(null), duration);
  };

  const copyText = async (value: string, message = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(value);
      showActionToast(message, "success");
      return true;
    } catch {
      showActionToast("Clipboard permission was blocked by the browser.", "error", 4200);
      return false;
    }
  };

  const openTerminal = (prefill?: string) => {
    setPanelTab("terminal");
    setPanelOpen(true);
    if (prefill !== undefined) setTerminalInput(prefill);
    window.requestAnimationFrame(() => {
      const input = terminalInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };

  const togglePanelMaximized = () => {
    setPanelMaximized(value => !value);
    window.requestAnimationFrame(() => terminalInputRef.current?.focus({ preventScroll: true }));
  };

  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const renderedHeight = event.currentTarget.parentElement?.getBoundingClientRect().height || panelHeight;
    if (panelMaximized) setPanelMaximized(false);
    panelResizeRef.current = { startY: event.clientY, startHeight: renderedHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("panel-resizing");
  };

  const resizePanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panelResizeRef.current;
    if (!state) return;
    const maxHeight = Math.max(260, window.innerHeight - 86);
    setPanelHeight(Math.max(190, Math.min(maxHeight, state.startHeight + state.startY - event.clientY)));
  };

  const endPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizeRef.current) return;
    panelResizeRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer capture may already be released */ }
    document.body.classList.remove("panel-resizing");
    window.requestAnimationFrame(() => terminalInputRef.current?.focus({ preventScroll: true }));
  };

  const toggleThemeMode = () => {
    const resolved = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(resolved === "dark" ? "light" : "dark");
  };

  const runHireEasterEgg = () => {
    setTerminalLines(lines => [...lines,
      "› sudo hire osameh",
      "Checking skills...",
      ".NET / backend          ✓",
      "React / Vue / Nuxt      ✓",
      "Systems / DevOps        ✓",
      "Product engineering     ✓",
      "",
      "Access granted.",
      "Let's build something great.",
    ]);
    setSearchResults([]);
    setTerminalInput("");
    openTerminal();
  };

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previousScrollRestoration; };
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const knownPaths = ["/", "/home", "/about", "/projects", "/experience", "/now", "/changelog", "/notes", "/contact", "/resume", "/status"];
    const noteMatch = path.match(/^\/notes\/([a-z0-9-]+)\/?$/i);
    const project = fallbackRepos.find(repo => `/${repo.name.toLowerCase()}` === path.toLowerCase() || `/projects/${repo.name.toLowerCase()}` === path.toLowerCase());
    if (noteMatch && engineeringNotes.some(note => note.slug === noteMatch[1].toLowerCase())) {
      setActiveNoteSlug(noteMatch[1].toLowerCase());
      setActiveSectionPath("/notes");
    } else if (noteMatch) setNotFoundPath(path);
    else if (project) openProject(project, false);
    else if (path.toLowerCase() === "/resume") window.setTimeout(() => window.dispatchEvent(new Event("portfolio:resume")), 50);
    else if (path.toLowerCase() === "/status") window.setTimeout(() => window.dispatchEvent(new Event("portfolio:diagnostics")), 80);
    else if (knownPaths.includes(path.toLowerCase()) && !["/", "/home", "/resume", "/status"].includes(path.toLowerCase())) {
      setActiveSectionPath(path.toLowerCase());
      const target = path.toLowerCase() === "/projects" ? "work" : path.slice(1);
      window.setTimeout(() => scrollToSection(target, "auto"), 80);
    } else if (!knownPaths.includes(path.toLowerCase()) && !/^\/projects\/[^/]+\/?$/i.test(path) && !/^\/notes\/[^/]+\/?$/i.test(path)) setNotFoundPath(path);
  }, []);

  useEffect(() => { trackEvent("page_view"); }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("portfolio-theme") as ThemePreference | null;
    const savedFont = localStorage.getItem("portfolio-font") as FontPreference | null;
    const savedLanguage = localStorage.getItem("portfolio-language") as CodeLanguage | null;
    if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) setTheme(savedTheme);
    if (savedFont && fontOptions.some(option => option.id === savedFont)) setFont(savedFont);
    if (savedLanguage && codeProfiles[savedLanguage]) setCodeLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.themePreference = theme;
    };
    applyTheme();
    localStorage.setItem("portfolio-theme", theme);
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("portfolio-font", font);
  }, [font]);

  useEffect(() => {
    localStorage.setItem("portfolio-language", codeLanguage);
  }, [codeLanguage]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      showActionToast(detail.message, detail.kind || "info", detail.duration || 3200);
    };
    window.addEventListener("portfolio:toast", onToast);
    return () => window.removeEventListener("portfolio:toast", onToast);
  }, []);

  useEffect(() => {
    if (!panelOpen || panelTab !== "terminal") return;
    const frame = window.requestAnimationFrame(() => {
      terminalInputRef.current?.focus({ preventScroll: true });
      const input = terminalInputRef.current;
      if (input) input.setSelectionRange(input.value.length, input.value.length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panelOpen, panelTab]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const frame = window.requestAnimationFrame(() => commandPaletteInputRef.current?.focus({ preventScroll: true }));
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setCommandPaletteOpen(false); } };
    document.addEventListener("keydown", closeOnEscape);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", closeOnEscape); };
  }, [commandPaletteOpen]);

  useEffect(() => { setCommandIndex(0); }, [commandQuery]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const frame = window.requestAnimationFrame(() => {
      commandPaletteListRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commandIndex, commandQuery, commandPaletteOpen]);

  useEffect(() => {
    const sync = () => {
      const nextOffline = !navigator.onLine;
      setOffline(nextOffline);
      showActionToast(nextOffline ? "You are offline. Cached portfolio content remains available." : "Connection restored.", nextOffline ? "warning" : "success", 3800);
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = !!target?.closest("input, textarea, select, [contenteditable='true']");
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "?") { event.preventDefault(); window.dispatchEvent(new Event("portfolio:shortcuts")); return; }
      if (event.key === "/") {
        if (!activeRepo && !notFoundPath) { event.preventDefault(); projectSearchRef.current?.focus({ preventScroll: false }); document.getElementById("work")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }
      const now = Date.now();
      if (event.key.toLowerCase() === "g") { keyboardChordRef.current = { key: "g", at: now }; return; }
      const chord = keyboardChordRef.current;
      keyboardChordRef.current = null;
      if (!chord || now - chord.at > 900) return;
      const map: Record<string, SearchResult> = { h: sections[0], a: sections[1], p: sections[2], e: sections[3], n: sections[4], c: sections[6] };
      const destination = map[event.key.toLowerCase()];
      if (destination) { event.preventDefault(); goTo(destination); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeRepo, notFoundPath, repos]);

  useEffect(() => {
    const sequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let index = 0;
    const konami = (event: KeyboardEvent) => {
      if (event.key === sequence[index]) index += 1; else index = event.key === sequence[0] ? 1 : 0;
      if (index === sequence.length) {
        index = 0;
        setTerminalLines(lines => [...lines, "› konami", "Achievement unlocked: curious engineer ✦", "You found the hidden input sequence. Type `neofetch` for another one."]);
        openTerminal();
      }
    };
    document.addEventListener("keydown", konami);
    return () => document.removeEventListener("keydown", konami);
  }, []);

  useEffect(() => {
    const openPalette = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setContextMenu(null);
      setCommandQuery("");
      setCommandIndex(0);
      setCommandPaletteOpen(open => !open);
    };
    document.addEventListener("keydown", openPalette);
    return () => document.removeEventListener("keydown", openPalette);
  }, []);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest(".custom-context-menu, .command-palette")) { event.preventDefault(); return; }

      const keyboardInvocation = event.clientX === 0 && event.clientY === 0;
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!finePointer && !keyboardInvocation) return;

      event.preventDefault();
      setFileMenuOpen(false);
      setCommandPaletteOpen(false);

      const projectTarget = target.closest<HTMLElement>("[data-project-name]");
      const repoName = projectTarget?.dataset.projectName || (target.closest(".ide-project-view") ? activeRepo?.name : undefined);
      const imageTarget = target.closest<HTMLElement>("[data-image-url]");
      let imageUrl = imageTarget?.dataset.imageUrl;
      let imageIndex = imageTarget?.dataset.imageIndex ? Number(imageTarget.dataset.imageIndex) : undefined;

      if (!imageUrl && target instanceof HTMLImageElement && target.src) {
        imageUrl = target.currentSrc || target.src;
        if (repoName) {
          const gallery = repoGalleries[repoName] || [];
          const match = gallery.findIndex(item => item.url === imageUrl);
          if (match >= 0) imageIndex = match;
        }
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const selectedText = window.getSelection()?.toString().trim() || "";
      let x = event.clientX;
      let y = event.clientY;
      if (keyboardInvocation) {
        const rect = target.getBoundingClientRect();
        x = rect.left + Math.min(24, Math.max(8, rect.width / 2));
        y = rect.top + Math.min(rect.height + 8, 36);
      }

      setContextMenu({
        x, y, repoName, imageUrl, imageIndex,
        linkUrl: anchor?.href,
        linkLabel: anchor?.textContent?.trim() || anchor?.getAttribute("aria-label") || undefined,
        selection: selectedText || undefined,
      });
    };

    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".custom-context-menu")) setContextMenu(null);
    };
    const closeOnScroll = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".custom-context-menu")) return;
      setContextMenu(null);
    };
    const closeOnResize = () => setContextMenu(null);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [activeRepo, repoGalleries]);

  useEffect(() => {
    if (!contextMenu) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = contextMenuRef.current;
      if (!menu) return;
      const margin = 10;
      const rect = menu.getBoundingClientRect();
      const left = Math.max(margin, Math.min(contextMenu.x, window.innerWidth - rect.width - margin));
      const top = Math.max(margin, Math.min(contextMenu.y, window.innerHeight - rect.height - margin));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const navigateMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setContextMenu(null); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;
      const menu = contextMenuRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button.context-menu-item:not(:disabled)"));
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Enter" || event.key === " ") {
        if (current >= 0) { event.preventDefault(); items[current].click(); }
        return;
      }
      event.preventDefault();
      if (event.key === "Home") items[0].focus();
      else if (event.key === "End") items[items.length - 1].focus();
      else if (event.key === "ArrowDown") items[(current + 1 + items.length) % items.length].focus();
      else items[(current - 1 + items.length) % items.length].focus();
    };
    document.addEventListener("keydown", navigateMenu);
    return () => document.removeEventListener("keydown", navigateMenu);
  }, [contextMenu]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".ide-file-menu")) setFileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFileMenuOpen(false); };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeMenu); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  useEffect(() => {
    const closeActiveTab = (event: KeyboardEvent) => {
      if (contextMenu || commandPaletteOpen) return;
      if (galleryLightbox) {
        const gallery = repoGalleries[galleryLightbox.repo] || [];
        if (event.key === "Escape") {
          event.preventDefault();
          setGalleryLightbox(null);
          return;
        }
        if (gallery.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          setGalleryLightbox(current => current ? { ...current, index: (current.index + direction + gallery.length) % gallery.length } : current);
        }
        return;
      }
      if (event.key !== "Escape" || fileMenuOpen) return;
      if (notFoundPath) showHome();
      else if (activeNoteSlug) closeNote();
      else if (activeRepo) closeProject(activeRepo);
    };
    document.addEventListener("keydown", closeActiveTab);
    return () => document.removeEventListener("keydown", closeActiveTab);
  }, [activeRepo, activeNoteSlug, notFoundPath, openedRepos, fileMenuOpen, galleryLightbox, repoGalleries, contextMenu, commandPaletteOpen]);

  useEffect(() => {
    const toggleTerminal = (event: KeyboardEvent) => {
      if (event.key !== "`" || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      setPanelOpen(open => {
        const next = !open;
        if (next) setPanelTab("terminal");
        return next;
      });
    };
    document.addEventListener("keydown", toggleTerminal);
    return () => document.removeEventListener("keydown", toggleTerminal);
  }, []);

  useEffect(() => {
    if (!panelOpen || panelTab !== "terminal") return;
    const output = terminalOutputRef.current;
    if (output) output.scrollTo({ top: output.scrollHeight, behavior: "smooth" });
  }, [terminalLines, searchResults, panelOpen, panelTab]);

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

  useEffect(() => {
    if (activeRepo || activeNoteSlug || notFoundPath || resumeOpen) return;

    const targets = [
      { path: "/home", id: "home" },
      { path: "/about", id: "about" },
      { path: "/projects", id: "work" },
      { path: "/experience", id: "experience" },
      { path: "/now", id: "now" },
      { path: "/changelog", id: "changelog" },
      { path: "/notes", id: "notes" },
      { path: "/contact", id: "contact" },
    ].map(item => ({ ...item, element: document.getElementById(item.id) })).filter(item => item.element) as Array<{ path: string; id: string; element: HTMLElement }>;

    if (!targets.length) return;
    let frame = 0;
    const syncExplorerSelection = () => {
      frame = 0;
      const probe = Math.min(190, Math.max(105, window.innerHeight * 0.24));
      let current = targets[0];
      for (const target of targets) {
        if (target.element.getBoundingClientRect().top <= probe) current = target;
        else break;
      }
      setActiveSectionPath(path => path === current.path ? path : current.path);
    };
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncExplorerSelection);
    };

    syncExplorerSelection();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [activeRepo, activeNoteSlug, notFoundPath, resumeOpen]);

  useEffect(() => {
    // A double-clicked dist/index.html runs on file:// and has no PHP server.
    // Render the embedded projects immediately instead of attempting a file:// API request.
    if (window.location.protocol === "file:") {
      setRepos(fallbackRepos);
      setRepoState("ready");
      return;
    }

    const fetchRepositories = async () => {
      for (const endpoint of ["/api/github/repos", "/api/github.php"]) {
        try {
          const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
          if (!response.ok) continue;
          const data = await response.json() as GithubRepo[];
          if (Array.isArray(data) && data.length) return data;
        } catch {
          // Try the compatibility endpoint next.
        }
      }
      throw new Error("GitHub request failed");
    };

    fetchRepositories()
      .then((data: GithubRepo[]) => {
        const activeRepos = data
          .filter(repo => !repo.archived && repo.name.toLowerCase() !== "osameh15")
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
        if (!activeRepos.length) throw new Error("No repositories returned");
        setRepos(activeRepos);
        setRepoState("ready");
      })
      .catch(() => {
        setRepos(fallbackRepos);
        setRepoState("ready");
        showActionToast("GitHub is temporarily unavailable. Showing the embedded project fallback.", "warning", 4600);
      });
  }, []);

  useEffect(() => {
    if (!activeRepo) return;
    const meta = repoMetadata[activeRepo.name];
    if (meta?.seo.title) document.title = meta.seo.title;
  }, [activeRepo, repoMetadata]);

  useEffect(() => {
    if (repoState !== "ready" || !repos.length) return;
    let cancelled = false;
    setMetadataState("loading");
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, repos.length) }, async () => {
      while (!cancelled) {
        const index = cursor;
        cursor += 1;
        const repo = repos[index];
        if (!repo) break;
        const metadata = await fetchPortfolioMetadata(repo);
        if (cancelled) break;
        setRepoMetadata(current => ({ ...current, [repo.name]: metadata }));
      }
    });
    Promise.all(workers).then(() => { if (!cancelled) setMetadataState("ready"); });
    return () => { cancelled = true; };
  }, [repoState, repos]);

  useEffect(() => {
    if (repoState !== "ready") return;
    const match = window.location.pathname.match(/^\/projects\/([^/]+)\/?$/i);
    if (!match) return;
    let requested = match[1];
    try { requested = decodeURIComponent(requested); } catch { /* Keep the encoded value for the 404 path. */ }
    const repo = repos.find(item => item.name.toLowerCase() === requested.toLowerCase());
    if (repo) {
      setNotFoundPath(null);
      if (activeRepo?.name.toLowerCase() !== repo.name.toLowerCase()) openProject(repo);
    } else {
      setNotFoundPath(window.location.pathname);
    }
  }, [repoState, repos]);

  useEffect(() => {
    if (repoState !== "ready" || projectsNearViewport) return;
    const section = projectsSectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setProjectsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setProjectsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "700px 0px" });

    observer.observe(section);
    return () => observer.disconnect();
  }, [repoState, projectsNearViewport]);

  useEffect(() => {
    if (repoState !== "ready" || !projectsNearViewport) return;
    repos.slice(0, visibleRepos).forEach(repo => { void loadReadme(repo); });
  }, [repos, visibleRepos, repoState, projectsNearViewport]);
  const copyEmail = async () => {
    const ok = await copyText("osirandoust@gmail.com", "Email copied");
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const ensureReadmeHtml = (repo: GithubRepo) => {
    if (readmeHtml[repo.name] !== undefined || readmeRenderRequests.current.has(repo.name)) return;
    readmeRenderRequests.current.add(repo.name);
    setLoadingReadmes(current => current.includes(repo.name) ? current : [...current, repo.name]);

    void (async () => {
      const existing = readmeMarkdown[repo.name];
      const markdown = existing !== undefined ? existing : await loadReadme(repo);
      const html = markdown ? await renderMarkdown(markdown, repo) : "";
      setReadmeHtml(current => ({ ...current, [repo.name]: html }));
    })().finally(() => {
      readmeRenderRequests.current.delete(repo.name);
      setLoadingReadmes(current => current.filter(name => name !== repo.name));
    });
  };

  const openProject = (repo: GithubRepo, updateHistory = true) => {
    setNotFoundPath(null);
    setActiveNoteSlug(null);
    setActiveSectionPath("/projects");
    setActiveRepo(repo);
    setOpenedRepos(current => current.some(item => item.id === repo.id) ? current : [...current, repo]);
    if (updateHistory) {
      const path = `/projects/${encodeURIComponent(repo.name)}`;
      if (window.location.pathname !== path) window.history.pushState({ project: repo.name }, "", path);
    }
    document.title = `${repo.name} — Osameh Irandoust`;
    trackEvent("project_open", repo.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPanelOpen(false);
    ensureReadmeHtml(repo);
    void loadGallery(repo);
  };

  const showHome = (updateHistory = true, scrollToTop = true) => {
    setNotFoundPath(null);
    setActiveSectionPath("/home");
    setActiveRepo(null);
    setActiveNoteSlug(null);
    document.title = "Osameh Irandoust — Software Engineer";
    if (updateHistory && window.location.pathname !== "/") window.history.pushState({}, "", "/");
    if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applySectionScroll = (request: { id: string; behavior: ScrollBehavior; exact: boolean; token: number }) => {
    if (request.token !== sectionScrollTokenRef.current) return false;
    const target = document.getElementById(request.id);
    if (!target) return false;

    const move = (behavior: ScrollBehavior) => {
      if (request.token !== sectionScrollTokenRef.current) return;
      const stickyOffset = window.innerWidth <= 720 ? 72 : 96;
      const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
      const destination = Math.max(0, top);
      if (request.exact) {
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, destination);
        root.style.scrollBehavior = previousScrollBehavior;
        return;
      }
      window.scrollTo({ top: destination, behavior });
    };

    move(request.exact ? "auto" : request.behavior);
    if (request.exact) {
      sectionScrollTimersRef.current.forEach(timer => window.clearTimeout(timer));
      sectionScrollTimersRef.current = [60, 220].map(delay => window.setTimeout(() => move("auto"), delay));
    }
    if (pendingSectionScrollRef.current?.token === request.token) pendingSectionScrollRef.current = null;
    return true;
  };

  const scrollToSection = (id: string, behavior: ScrollBehavior = "smooth", exact = false) => {
    const request = { id, behavior, exact, token: ++sectionScrollTokenRef.current };
    pendingSectionScrollRef.current = request;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => { applySectionScroll(request); }));
  };

  useLayoutEffect(() => {
    const request = pendingSectionScrollRef.current;
    if (!request || activeRepo || activeNoteSlug || notFoundPath) return;
    applySectionScroll(request);
  }, [activeRepo, activeNoteSlug, notFoundPath]);

  useEffect(() => () => {
    sectionScrollTimersRef.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  const openNote = (slug: string, updateHistory = true) => {
    const note = engineeringNotes.find(item => item.slug === slug);
    if (!note) { setNotFoundPath(`/notes/${slug}`); return; }
    setNotFoundPath(null);
    setActiveRepo(null);
    setActiveNoteSlug(slug);
    setActiveSectionPath("/notes");
    if (updateHistory) {
      const path = `/notes/${encodeURIComponent(slug)}`;
      if (window.location.pathname !== path) window.history.pushState({ note: slug }, "", path);
    }
    document.title = `${note.title} — Osameh Irandoust`;
    trackEvent("note_open", slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPanelOpen(false);
  };

  const closeNote = (returnToNotes = true) => {
    setActiveNoteSlug(null);
    document.title = "Osameh Irandoust — Software Engineer";
    if (returnToNotes) {
      setActiveSectionPath("/notes");
      if (window.location.pathname !== "/notes") window.history.pushState({}, "", "/notes");
      scrollToSection("notes", "auto", true);
    } else {
      setActiveSectionPath("/home");
      if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeProject = (repo: GithubRepo, returnHome = false) => {
    const remaining = openedRepos.filter(item => item.id !== repo.id);
    setOpenedRepos(remaining);
    if (returnHome) {
      setActiveSectionPath("/home");
      setActiveRepo(null);
      document.title = "Osameh Irandoust — Software Engineer";
      if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    } else if (activeRepo?.id === repo.id) {
      const next = remaining[remaining.length - 1] || null;
      setActiveRepo(next);
      if (next) window.history.replaceState({ project: next.name }, "", `/projects/${encodeURIComponent(next.name)}`);
      else { document.title = "Osameh Irandoust — Software Engineer"; window.history.replaceState({}, "", "/"); }
    }
  };

  const goTo = (result: SearchResult) => {
    if (result.path.startsWith("/notes/") && result.path !== "/notes") {
      openNote(result.path.slice("/notes/".length));
      return;
    }
    if (result.kind === "project") {
      const repo = repos.find(item => item.name.toLowerCase() === result.label.toLowerCase());
      if (repo) openProject(repo);
      return;
    }
    setActiveSectionPath(result.path);
    showHome(false, false);
    setActiveSectionPath(result.path);
    if (window.location.pathname !== result.path) window.history.pushState({}, "", result.path);
    const target = result.path === "/projects" ? "work" : result.path === "/home" ? "home" : result.path.slice(1);
    scrollToSection(target);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const noteMatch = path.match(/^\/notes\/([a-z0-9-]+)\/?$/i);
      if (noteMatch) {
        const slug = noteMatch[1].toLowerCase();
        if (engineeringNotes.some(note => note.slug === slug)) { openNote(slug, false); return; }
      }
      const projectMatch = path.match(/^\/projects\/([^/]+)\/?$/i);
      if (projectMatch) {
        let requested = projectMatch[1];
        try { requested = decodeURIComponent(requested); } catch { /* ignore */ }
        const repo = repos.find(item => item.name.toLowerCase() === requested.toLowerCase());
        if (repo) { openProject(repo, false); return; }
      }
      const section = sections.find(item => item.path === path);
      if (section) {
        showHome(false, false);
        setActiveSectionPath(section.path);
        const target = section.path === "/projects" ? "work" : section.path === "/home" ? "home" : section.path.slice(1);
        scrollToSection(target, "auto", section.path === "/notes");
        return;
      }
      if (path === "/") { showHome(false); return; }
      setNotFoundPath(path);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [repos]);

  const projectSearchText = (repo: GithubRepo) => {
    const meta = repoMetadata[repo.name];
    const metadataTerms = meta ? [
      meta.project.name, meta.project.tagline, meta.project.summary, meta.project.type, meta.project.lifecycle,
      meta.ownership.role, meta.ownership.organization || "", ...meta.ownership.responsibilities,
      ...meta.stack.languages, ...meta.stack.frameworks, ...meta.stack.libraries, ...meta.stack.platforms,
      ...meta.stack.databases, ...meta.stack.tooling, ...meta.stack.concepts, ...meta.recruiter.skillsDemonstrated,
      ...meta.recruiter.talkingPoints, meta.caseStudy.problem, meta.caseStudy.solution,
    ].join(" ") : "";
    return `${repo.name} ${repo.description || ""} ${repo.language || ""} ${repo.topics.join(" ")} ${metadataTerms}`.toLowerCase();
  };

  const projectTechOptions: string[] = Array.from(new Set<string>(repos.flatMap(repo => {
    const meta = repoMetadata[repo.name];
    return [repo.language || "", ...repo.topics, ...(meta ? [...meta.stack.languages, ...meta.stack.frameworks, ...meta.stack.libraries, ...meta.stack.databases, ...meta.stack.platforms, ...meta.stack.tooling, ...meta.stack.concepts] : [])];
  }).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));

  const terminalBaseCommands = [
    "help", "whoami", "ls", "exp", "skills", "projects", "contact", "version", "build", "neofetch",
    "resume", "recruiter", "now", "changelog", "notes", "health", "status", "diagnostics", "install", "shortcuts", "theme",
    "clear", "sudo hire osameh", "sudo su", "cat welcome.txt",
    ...sections.map(item => item.path),
  ];

  const terminalCompletionCandidates = (value: string) => {
    const raw = value.trimStart();
    const lower = raw.toLowerCase();
    const projectNames = repos.map(repo => repo.name);
    let candidates: string[];
    if (lower.startsWith("cat note ")) candidates = engineeringNotes.map(note => `cat note ${note.slug}`);
    else if (lower.startsWith("cat ")) candidates = [...projectNames.map(name => `cat ${name}`), "cat note "];
    else if (lower.startsWith("notes ")) candidates = engineeringNotes.flatMap(note => [note.slug, ...note.tags]).map(term => `notes ${term}`);
    else if (lower.startsWith("share ")) candidates = projectNames.map(name => `share ${name}`);
    else if (lower.startsWith("open ")) candidates = ["github", "gitlab", "linkedin", "telegram", "instagram", "whatsapp", "mail", "business"].map(name => `open ${name}`);
    else if (lower.startsWith("search ")) candidates = [...projectTechOptions, ...projectNames].map(term => `search ${term}`);
    else candidates = [...terminalBaseCommands, "cat ", "cat note ", "notes", "notes ", "health", "share ", "open ", "search "];
    return Array.from(new Set(candidates)).filter(candidate => candidate.toLowerCase().startsWith(lower));
  };

  const terminalGhostSuffix = (() => {
    if (!terminalInput) return "";
    const match = terminalCompletionCandidates(terminalInput)[0];
    if (!match || match.length <= terminalInput.length) return "";
    if (!match.toLowerCase().startsWith(terminalInput.toLowerCase())) return "";
    return match.slice(terminalInput.length);
  })();

  const autocompleteTerminal = (reverse = false) => {
    const current = terminalInput;
    const state = terminalCompletionRef.current;
    const continuing = state.matches.length > 0 && current === state.applied;
    const matches = continuing ? state.matches : terminalCompletionCandidates(current);
    if (!matches.length) {
      terminalCompletionRef.current = { seed: "", matches: [], index: -1, applied: "" };
      showActionToast(`No autocomplete match for “${current || "command"}”.`, "info", 1800);
      return;
    }
    const nextIndex = continuing
      ? (state.index + (reverse ? -1 : 1) + matches.length) % matches.length
      : (reverse ? matches.length - 1 : 0);
    const next = matches[nextIndex];
    terminalCompletionRef.current = { seed: continuing ? state.seed : current, matches, index: nextIndex, applied: next };
    setTerminalInput(next);
    window.requestAnimationFrame(() => {
      const input = terminalInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(next.length, next.length);
    });
  };

  const runTerminal = (event: FormEvent) => {
    event.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    setTerminalInput("");
    const command = raw.toLowerCase();
    if (command === "clear") { setTerminalLines([]); setSearchResults([]); return; }
    if (command === "cat welcome.txt") {
      setTerminalLines(lines => [...lines, "› " + raw, "Hi — I'm Osameh, software engineer in Tehran. This site is a small editor.", "Type `help` for commands, or just scroll."]);
      setSearchResults([]); return;
    }
    if (command === "help" || command === "/help") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "whoami        who is this guy",
        "ls            list live open tabs",
        "exp           work history",
        "skills        tech stack",
        "projects      jump to projects",
        "cat <repo>    open a project in an IDE tab",
        "contact       all the ways to reach me",
        "open <where>  github | gitlab | linkedin | telegram | instagram | whatsapp | mail",
        "search <text> search site content",
        "version       print deployed version",
        "build         open build information",
        "neofetch      portfolio system summary",
        "resume        open the embedded CV",
        "recruiter     start the guided recruiter tour",
        "now           current focus",
        "changelog     portfolio release history",
        "notes         engineering notes index",
        "notes <text>  search engineering notes",
        "cat note <id> open an engineering note",
        "health        live origin and GitHub health center",
        "status        local diagnostics",
        "install       install the PWA when available",
        "shortcuts     keyboard navigation map",
        "share <repo>  share a project deep link",
        "hire          run a tiny easter egg",
        "clear         clear the screen",
        "tab           autocomplete commands, projects, services, and search terms",
        "shift+tab     cycle autocomplete backwards",
        "`             toggle terminal  ·  esc closes the active tab"]);
      setSearchResults([]);
      return;
    }
    if (command === "version" || command === "--version") {
      setTerminalLines(lines => [...lines, "› " + raw, `osameh.dev v${BUILD_VERSION}`]);
      setSearchResults([]); return;
    }
    if (command === "build") {
      setTerminalLines(lines => [...lines, "› " + raw, "opening build-info.json…"]);
      setSearchResults([]);
      window.dispatchEvent(new Event("portfolio:build"));
      return;
    }
    if (command === "sudo hire osameh" || command === "hire" || command === "hire osameh") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "Checking skills...",
        ".NET / backend          ✓",
        "React / Vue / Nuxt      ✓",
        "Systems / DevOps        ✓",
        "Product engineering     ✓",
        "",
        "Access granted.",
        "Let's build something great.",
      ]);
      setSearchResults([]); return;
    }
    if (command === "neofetch") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "        OI // OSAMEH.DEV",
        "  -----------------------------",
        "  Role      Software Engineer",
        "  Focus     Backend · Full-Stack · Systems",
        "  Stack     .NET · C++ · Nuxt · PHP · SQL",
        `  Projects  ${repos.length} public repositories`,
        `  Build     ${BUILD_VERSION}`,
        `  Theme     ${document.documentElement.dataset.theme || "dark"}`,
        `  Network   ${navigator.onLine ? "online" : "offline"}`,
        "  Status    Ready to build_",
      ]); setSearchResults([]); return;
    }
    if (command === "sudo su") {
      setTerminalLines(lines => [...lines, "› " + raw, "root access denied: this portfolio follows least privilege.", "Nice try though. ✦"]); setSearchResults([]); return;
    }
    if (command === "resume" || command === "cv") {
      setTerminalLines(lines => [...lines, "› " + raw, "opening resume.pdf…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:resume")); return;
    }
    if (command === "recruiter" || command === "recruiter-mode") {
      setTerminalLines(lines => [...lines, "› " + raw, "starting recruiter-mode.tour…"]); setSearchResults([]); setRecruiterModeOpen(true); return;
    }
    if (command === "now") { setTerminalLines(lines => [...lines, "› " + raw, "opening /now…"]); setSearchResults([]); goTo(sections[4]); return; }
    if (command === "changelog") { setTerminalLines(lines => [...lines, "› " + raw, "opening /changelog…"]); setSearchResults([]); goTo(sections[5]); return; }
    if (command === "notes") { setTerminalLines(lines => [...lines, "› " + raw, "opening /notes…"]); setSearchResults([]); goTo(sections[7]); return; }
    if (command === "health" || command === "status-server") { setTerminalLines(lines => [...lines, "› " + raw, "opening live system health…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:diagnostics")); return; }
    if (command.startsWith("cat note ")) { const slug = raw.slice(9).trim().toLowerCase(); const note = engineeringNotes.find(item => item.slug === slug); if (note) { setTerminalLines(lines => [...lines, "› " + raw, `opening ${slug}.md…`]); setSearchResults([]); openNote(note.slug); } else { setTerminalLines(lines => [...lines, "› " + raw, `note not found: ${slug}`]); } return; }
    if (command.startsWith("notes ")) { const noteQuery = raw.slice(6).trim().toLowerCase(); const matches = engineeringNotes.filter(note => `${note.title} ${note.summary} ${note.tags.join(" ")} ${note.slug}`.toLowerCase().includes(noteQuery)); setTerminalLines(lines => [...lines, "› " + raw, matches.length ? `Found ${matches.length} engineering note${matches.length === 1 ? "" : "s"}.` : `No notes match “${noteQuery}”.`]); setSearchResults(matches.map(note => ({ label: note.title, path: `/notes/${note.slug}`, kind: "section" as const }))); return; }
    if (command === "status" || command === "diagnostics") { setTerminalLines(lines => [...lines, "› " + raw, "opening live system health…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:diagnostics")); return; }
    if (command === "shortcuts" || command === "keys") { setTerminalLines(lines => [...lines, "› " + raw, "opening keyboard-shortcuts.md…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:shortcuts")); return; }
    if (command === "install" || command === "pwa") { setTerminalLines(lines => [...lines, "› " + raw, "requesting install prompt…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:install")); return; }
    if (command === "theme") { toggleThemeMode(); setTerminalLines(lines => [...lines, "› " + raw, "theme toggled."]); setSearchResults([]); return; }
    if (command.startsWith("share ")) {
      const name = raw.slice(6).trim().toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) { void shareProject(repo); setTerminalLines(lines => [...lines, "› " + raw, `sharing ${repo.name}…`]); }
      else {
        setTerminalLines(lines => [...lines, "› " + raw, `share: project “${name}” not found`]);
        showActionToast(`Project “${name}” was not found.`, "error", 4200);
      }
      setSearchResults([]); return;
    }
    if (command === "whoami") {
      setTerminalLines(lines => [...lines, "› " + raw, "osameh irandoust — software engineer (backend | full-stack | systems)", "Tehran, Iran · B.Sc. University of Tehran · currently @ Navatel"]);
      setSearchResults([]); return;
    }
    if (command === "ls") {
      const liveTabs = [
        `${!activeRepo && !notFoundPath ? "*" : " "} ${code.file}  [home]`,
        ...openedRepos.map(repo => `${activeRepo?.id === repo.id ? "*" : " "} ${repo.name}.md  [project]`),
        ...(notFoundPath ? ["* 404.md  [not found]"] : []),
      ];
      setTerminalLines(lines => [...lines, "› " + raw, `open tabs (${liveTabs.length}):`, ...liveTabs, "* = active tab"]);
      setSearchResults([]); return;
    }
    if (command === "exp") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "Navatel        Software Engineer        Apr 2026 — present",
        "Fluxudio       Software Engineer        2024 — 2026",
        "Datall         Full Stack Developer     2021 — 2024",
        "Arrap Startup  Android Developer        2019 — 2021",
        "Freelance      Software Developer       2017 — present"]);
      setSearchResults([]); return;
    }
    if (command === "skills") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "C++ · C# / .NET · Nuxt.js · Python · Java · Kotlin · PHP · Ruby",
        "PostgreSQL · MySQL · Cassandra · Elasticsearch · Docker · ELK · Linux"]);
      setSearchResults([]); return;
    }
    if (command === "projects") {
      setTerminalLines(lines => [...lines, "› " + raw, `${repos.length} projects loaded from GitHub — scrolling down.`]);
      setSearchResults([]); goTo(sections[2]); return;
    }
    if (command === "contact") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "personal  osirandoust@gmail.com",
        "business  support@osameh.dev",
        "telegram  @osameh_ir",
        "whatsapp  +98 936 964 2754",
        "instagram @osameh.ir",
        "linkedin  osameh-irandoust"]);
      setSearchResults([]); return;
    }
    if (command.startsWith("cat ")) {
      const name = raw.slice(4).trim().replace(/\.md$/i, "").toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) {
        setTerminalLines(lines => [...lines, "› " + raw, `opening ${repo.name} in an IDE tab…`]);
        setSearchResults([]); openProject(repo);
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, `cat: ${name || "<repo>"}: project not found`, "Run `projects` to view available repositories."]);
        setSearchResults([]);
        showActionToast(`Project “${name || "<repo>"}” was not found.`, "error", 4200);
      }
      return;
    }
    if (command.startsWith("open ")) {
      const service = command.slice(5).trim();
      const destinations: Record<string, string> = {
        github: "https://github.com/osameh15", gitlab: "https://gitlab.com/osameh15",
        linkedin: "https://www.linkedin.com/in/osameh-irandoust-493359173/", telegram: "https://t.me/osameh_ir",
        instagram: "https://instagram.com/osameh.ir", whatsapp: "https://wa.me/989369642754",
        mail: "mailto:osirandoust@gmail.com", business: "mailto:support@osameh.dev",
      };
      if (destinations[service]) {
        setTerminalLines(lines => [...lines, "› " + raw, `opening ${service}…`]);
        setSearchResults([]); window.open(destinations[service], "_blank", "noopener,noreferrer");
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, `open: unknown destination “${service}”`, "Try github, gitlab, linkedin, telegram, instagram, whatsapp, mail, or business."]);
        setSearchResults([]);
        showActionToast(`Unknown destination “${service}”.`, "warning", 4000);
      }
      return;
    }
    const route = sections.find(item => item.path === raw.toLowerCase());
    if (route) {
      setTerminalLines(lines => [...lines, "› " + raw, "Opening " + route.label + "…"]);
      setSearchResults([]);
      goTo(route);
      return;
    }
    if (raw.startsWith("/")) {
      const name = raw.replace(/^\/projects?\//, "").replace(/^\//, "").toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) {
        setTerminalLines(lines => [...lines, "› " + raw, "Opening " + repo.name + ".md…"]);
        setSearchResults([]);
        openProject(repo);
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, "Command not found: " + raw, "Try /help or /projects."]);
        setSearchResults([]);
        showActionToast(`Command not found: ${raw}`, "error", 4000);
      }
      return;
    }
    const query = raw.toLowerCase().replace(/^search\s+/, "").trim();
    const sectionTerms: Record<string, string> = {
      "/home": "home portfolio software engineer",
      "/about": "about profile bio skills stack docker linux wpf dotnet nuxt backend full stack systems",
      "/projects": "projects work repositories github source architecture code technologies",
      "/experience": "experience career jobs freelance backend full stack android wordpress",
      "/now": "now current working learning focus",
      "/changelog": "changelog release versions updates history",
      "/notes": "notes engineering blog articles architecture devops security caching github",
      "/contact": "contact email telegram linkedin whatsapp business",
    };
    const sectionMatches = sections.filter(item => `${item.label} ${item.path} ${sectionTerms[item.path] || ""}`.toLowerCase().includes(query));
    const projectMatches = repos
      .filter(repo => projectSearchText(repo).includes(query))
      .map(repo => ({ label: repo.name, path: "/" + repo.name, kind: "project" as const }));
    const noteMatches = engineeringNotes
      .filter(note => `${note.title} ${note.summary} ${note.tags.join(" ")} ${note.slug}`.toLowerCase().includes(query))
      .map(note => ({ label: note.title, path: `/notes/${note.slug}`, kind: "section" as const }));
    const matches: SearchResult[] = [...sectionMatches, ...projectMatches, ...noteMatches].filter((item, index, all) => all.findIndex(other => other.kind === item.kind && other.path === item.path) === index);
    setTerminalLines(lines => [...lines, "› " + raw, matches.length ? "Found " + matches.length + " result" + (matches.length === 1 ? "." : "s.") : "No matches for “" + query + "”."]);
    setSearchResults(matches.slice(0, 10));
    if (!matches.length) showActionToast(`No matches for “${query}”.`, "info");
  };

  const paletteCommands: PaletteCommand[] = [
    { id: "home", label: "Go to Home", hint: "/home", keywords: "home start portfolio", icon: "home", action: () => goTo(sections[0]) },
    { id: "projects", label: "Go to Projects", hint: "/projects", keywords: "work repos github projects", icon: "code", action: () => goTo(sections[2]) },
    { id: "about", label: "Go to About", hint: "/about", keywords: "about profile bio", icon: "about", action: () => goTo(sections[1]) },
    { id: "experience", label: "Go to Experience", hint: "/experience", keywords: "experience jobs career", icon: "experience", action: () => goTo(sections[3]) },
    { id: "contact", label: "Go to Contact", hint: "/contact", keywords: "contact email social", icon: "contact", action: () => goTo(sections[6]) },
    { id: "now", label: "Go to Now", hint: "/now", keywords: "now current working learning", icon: "about", action: () => goTo(sections[4]) },
    { id: "changelog", label: "Open Changelog", hint: "/changelog", keywords: "changelog releases versions updates", icon: "build", action: () => goTo(sections[5]) },
    { id: "notes", label: "Open Engineering Notes", hint: "/notes", keywords: "notes blog articles engineering architecture devops", icon: "about", action: () => goTo(sections[7]) },
    { id: "resume", label: "Open Resume", hint: "resume.pdf", keywords: "resume cv download career", icon: "experience", action: () => window.dispatchEvent(new Event("portfolio:resume")) },
    { id: "recruiter", label: "Start Recruiter Mode", hint: "guided tour", keywords: "recruiter tour featured hiring shortlist", icon: "hire", action: () => setRecruiterModeOpen(true) },
    { id: "diagnostics", label: "System Health Center", hint: "/status", keywords: "status health diagnostics latency system pwa api build github", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:diagnostics")) },
    { id: "shortcuts", label: "Keyboard Shortcuts", hint: "?", keywords: "keyboard shortcuts keys navigation", icon: "copy", action: () => window.dispatchEvent(new Event("portfolio:shortcuts")) },
    { id: "install", label: "Install Portfolio App", hint: "PWA", keywords: "install pwa offline app", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:install")) },
    { id: "terminal", label: "Open Terminal", hint: "`", keywords: "terminal shell cli command", icon: "terminal", action: () => openTerminal() },
    { id: "theme", label: `Switch to ${document.documentElement.dataset.theme === "light" ? "Dark" : "Light"} Theme`, hint: "theme", keywords: "theme dark light appearance", icon: "theme", action: toggleThemeMode },
    { id: "github", label: "Open GitHub", hint: "github.com/osameh15", keywords: "github source repositories", icon: "github", action: () => window.open("https://github.com/osameh15", "_blank", "noopener,noreferrer") },
    { id: "linkedin", label: "Open LinkedIn", hint: "linkedin", keywords: "linkedin career profile", icon: "linkedin", action: () => window.open("https://www.linkedin.com/in/osameh-irandoust-493359173/", "_blank", "noopener,noreferrer") },
    { id: "copy-url", label: "Copy Portfolio URL", hint: "osameh.dev", keywords: "copy link url share", icon: "copy", action: () => { void copyText(window.location.origin + "/", "Portfolio URL copied"); } },
    { id: "build", label: "View Build Info", hint: BUILD_DISPLAY, keywords: "build version deploy cache", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:build")) },
    { id: "hire", label: "sudo hire osameh", hint: "easter egg", keywords: "hire sudo easter egg terminal", icon: "hire", action: runHireEasterEgg },
    ...projectTechOptions.slice(0, 80).map((tech, index) => ({ id: `tech-${index}-${String(tech).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: `Filter projects by ${tech}`, hint: "technology", keywords: `technology stack skill filter projects ${tech}`, icon: "code" as const, action: () => exploreTech(String(tech)) })),
    ...engineeringNotes.map(note => ({ id: `note-${note.slug}`, label: `Read note: ${note.title}`, hint: `${note.readingMinutes} min · ${note.tags[0]}`, keywords: `note article blog ${note.slug} ${note.summary} ${note.tags.join(" ")}`, icon: "about" as const, action: () => openNote(note.slug) })),
    ...repos.map(repo => ({ id: `project-${repo.id}`, label: `Open project: ${repoMetadata[repo.name]?.project.name || repo.name}`, hint: repoMetadata[repo.name]?.project.type || repo.language || "GitHub", keywords: `project repo ${projectSearchText(repo)}`, icon: "code" as const, action: () => openProject(repo) })),
  ];
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const filteredPaletteCommands = paletteCommands.filter(item => !normalizedCommandQuery || `${item.label} ${item.hint} ${item.keywords}`.toLowerCase().includes(normalizedCommandQuery));
  const safeCommandIndex = filteredPaletteCommands.length ? Math.min(commandIndex, filteredPaletteCommands.length - 1) : 0;
  const runPaletteCommand = (item: PaletteCommand) => {
    setCommandPaletteOpen(false);
    setCommandQuery("");
    item.action();
  };
  const paletteIcon = (icon: PaletteCommand["icon"]) => {
    if (icon === "home") return <HomeIcon size={16} />;
    if (icon === "code") return <Code2 size={16} />;
    if (icon === "about") return <Braces size={16} />;
    if (icon === "experience") return <FileCode2 size={16} />;
    if (icon === "contact") return <Mail size={16} />;
    if (icon === "terminal") return <Terminal size={16} />;
    if (icon === "theme") return document.documentElement.dataset.theme === "light" ? <Moon size={16} /> : <Sun size={16} />;
    if (icon === "github") return <Github size={16} />;
    if (icon === "linkedin") return <Linkedin size={16} />;
    if (icon === "copy") return <Copy size={16} />;
    if (icon === "build") return <RefreshCw size={16} />;
    return <Command size={16} />;
  };
  const contextRepo = contextMenu?.repoName ? repos.find(repo => repo.name.toLowerCase() === contextMenu.repoName?.toLowerCase()) || fallbackRepos.find(repo => repo.name.toLowerCase() === contextMenu.repoName?.toLowerCase()) || null : null;
  const projectShareUrl = (repo: GithubRepo) => `${window.location.origin}/projects/${encodeURIComponent(repo.name)}`;
  const runContextAction = (action: () => void) => { setContextMenu(null); action(); };
  const normalizedProjectQuery = projectQuery.trim().toLowerCase();
  const filteredRepos = [...repos].filter(repo => {
    const meta = repoMetadata[repo.name];
    const queryMatch = !normalizedProjectQuery || projectSearchText(repo).includes(normalizedProjectQuery);
    const techValues = [repo.language, ...repo.topics, ...(meta ? [...meta.stack.languages, ...meta.stack.frameworks, ...meta.stack.libraries, ...meta.stack.platforms, ...meta.stack.databases, ...meta.stack.tooling] : [])].filter(Boolean);
    const techMatch = projectTech === "all" || techValues.some(value => String(value).toLowerCase() === projectTech.toLowerCase());
    return queryMatch && techMatch;
  }).sort((a, b) => projectSort === "stars" ? b.stargazers_count - a.stargazers_count : projectSort === "name" ? a.name.localeCompare(b.name) : Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const toggleCompareRepo = (repo: GithubRepo) => setCompareRepos(current => current.some(item => item.id === repo.id) ? current.filter(item => item.id !== repo.id) : current.length >= 2 ? [current[1], repo] : [...current, repo]);
  const exploreTech = (tech: string) => {
    const aliases: Record<string, string> = {
      "c# / .net": "C#", ".net 8": "C#", "nuxt 3 / 4": "nuxt", "laravel / php": "PHP",
      "qt / qml": "C++", "wpf": "C#", "android": "android", "github actions": "github-actions",
      "elk stack": "elk", "rest apis": "api", "postgresql": "postgresql", "mysql": "mysql",
    };
    const exact = projectTechOptions.find(option => option.toLowerCase() === tech.toLowerCase());
    const resolved = exact || aliases[tech.toLowerCase()] || tech;
    const available = exact || projectTechOptions.find(option => option.toLowerCase() === resolved.toLowerCase());
    if (available) { setProjectTech(available); setProjectQuery(""); }
    else { setProjectTech("all"); setProjectQuery(resolved); }

    // Filtering from the Command Palette should land on the actual filter controls,
    // not at the Featured/Recruiter block above them.
    setNotFoundPath(null);
    setActiveRepo(null);
    setActiveSectionPath("/projects");
    setPanelOpen(false);
    document.title = "Osameh Irandoust — Software Engineer";
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    window.setTimeout(() => document.getElementById("project-filter-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 70);
  };

  return (
    <main>
      <header className="topbar">
        <a href="#home" className="logo-link"><BrandMark /></a>
        <div className="ide-file-menu">
          <button className={fileMenuOpen ? "file-menu-trigger active" : "file-menu-trigger"} onClick={() => setFileMenuOpen(open => !open)} aria-expanded={fileMenuOpen} aria-haspopup="menu">File <ChevronDown size={12} /></button>
          {fileMenuOpen && <div className="file-menu-popover" role="menu">
            <div className="menu-group"><p><Sun size={13} /> Theme</p>
              {(["light", "dark", "system"] as ThemePreference[]).map(option => <button key={option} onClick={() => setTheme(option)}><span>{option === "light" ? <Sun size={14} /> : option === "dark" ? <Moon size={14} /> : <Monitor size={14} />}{option[0].toUpperCase() + option.slice(1)}</span>{theme === option && <Check size={14} />}</button>)}
            </div>
            <div className="menu-group"><p><Type size={13} /> Font</p>
              {fontOptions.map(option => <button key={option.id} onClick={() => setFont(option.id)}><span><i className={'font-sample sample-' + option.id}>{option.sample}</i>{option.label}</span>{font === option.id && <Check size={14} />}</button>)}
            </div>
            <div className="menu-group"><p><Code2 size={13} /> Programming language</p>
              {(Object.entries(codeProfiles) as [CodeLanguage, typeof code][]).map(([id, profile]) => <button key={id} onClick={() => setCodeLanguage(id)}><span><i className="language-dot" />{profile.label}</span>{codeLanguage === id && <Check size={14} />}</button>)}
            </div>
            <div className="menu-foot">Preferences save automatically</div>
          </div>}
        </div>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
          {[{ label: "about", section: sections[1] }, { label: "work", section: sections[2] }, { label: "experience", section: sections[3] }, { label: "now", section: sections[4] }, { label: "notes", section: sections[7] }, { label: "contact", section: sections[6] }].map(item => <a href={item.section.path} key={item.label} onClick={event => { event.preventDefault(); setMenuOpen(false); goTo(item.section); }}>{item.label}</a>)}
        </nav>
        <div className="header-actions">
          <PwaInstallControl />
          <span className="availability"><i /> Available for meaningful work</span>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {offline && <div className="offline-banner" role="status"><span>OFFLINE MODE</span> Cached portfolio shell is active. GitHub content may use the last available data.</div>}

      <div className="workspace">
        <aside className="contact-dock" aria-label="Quick contact">
          <a href="https://instagram.com/osameh.ir" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /><span>Instagram</span></a>
          <a href="https://wa.me/989369642754" target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /><span>WhatsApp</span></a>
          <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /><span>Telegram</span></a>
        </aside>
        <aside className="activity-bar" aria-label="Social links">
          <Code2 className="active-icon" size={21} />
          <a href="https://github.com/osameh15" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={20} /></a>
          <a href="https://gitlab.com/osameh15" target="_blank" rel="noreferrer" aria-label="GitLab"><Gitlab size={20} /></a>
          <a href="https://www.linkedin.com/in/osameh-irandoust-493359173/" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={20} /></a>
          <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={19} /></a>
          <span className="activity-line" /><span className="vertical-name">OSAMEH.DEV</span>
        </aside>

        <aside className="explorer">
          <p className="explorer-title">EXPLORER</p>
          <p className="folder"><ChevronDown size={14} /> OSAMEH-PORTFOLIO</p>
          <button className={activeSectionPath === "/home" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/home" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => showHome()}><FileCode2 size={15} /> {code.file}</button>
          <button className={activeSectionPath === "/about" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/about" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[1])}><Braces size={15} /> about.json</button>
          <button className={activeSectionPath === "/projects" && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/projects" && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[2])}><FileCode2 size={15} /> {code.projects}</button>
          <button className={activeSectionPath === "/experience" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/experience" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[3])}><ChevronRight size={14} /> experience</button>
          <button className={activeSectionPath === "/now" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/now" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[4])}><Zap size={14} /> now.md</button>
          <button className={activeSectionPath === "/changelog" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/changelog" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[5])}><RefreshCw size={14} /> changelog.md</button>
          <button className={activeSectionPath === "/notes" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/notes" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => activeNoteSlug ? closeNote() : goTo(sections[7])}><Braces size={14} /> engineering-notes</button>
          <button className={activeSectionPath === "/contact" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/contact" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sections[6])}><Mail size={14} /> contact.md</button>

          <div className="explorer-plugins" aria-label="Portfolio tools">
            <p className="explorer-plugins-title"><PanelBottom size={13} /> PORTFOLIO PLUGINS</p>
            <button className={resumeOpen ? "explorer-plugin active" : "explorer-plugin"} aria-pressed={resumeOpen} onClick={() => window.dispatchEvent(new Event("portfolio:resume"))}>
              <span className="explorer-plugin-icon"><Download size={16} /></span>
              <span className="explorer-plugin-copy"><b>Resume Viewer</b><small>CV preview · local PDF</small></span>
              <span className="explorer-plugin-badge">PDF</span>
            </button>
          </div>
          <div className="explorer-footer">
            <button onClick={() => { setPanelTab("outline"); setPanelOpen(true); }}><ListTree size={14} /> OUTLINE</button>
            <button onClick={() => openTerminal()}><Terminal size={14} /> TERMINAL</button>
          </div>
        </aside>

        <div className="editor">
          <div className="tabs-row">
            <button className={activeRepo || activeNoteSlug || notFoundPath ? "editor-tab" : "editor-tab active"} onClick={() => showHome()}><FileCode2 size={14} /> {code.file}</button>
            {openedRepos.map(repo => <button key={repo.id} className={activeRepo?.id === repo.id ? "editor-tab project-tab active" : "editor-tab project-tab"} onClick={() => openProject(repo)}><Code2 size={14} /><span>{repo.name}.md</span><X size={12} onClick={event => { event.stopPropagation(); closeProject(repo); }} /></button>)}
            {activeNoteSlug && <button className="editor-tab project-tab active" onClick={() => openNote(activeNoteSlug, false)}><Braces size={14} /><span>{activeNoteSlug}.md</span><X size={12} onClick={event => { event.stopPropagation(); closeNote(); }} /></button>}
            {notFoundPath && <button className="editor-tab project-tab error-tab active"><FileCode2 size={14} /><span>404.md</span><X size={12} onClick={event => { event.stopPropagation(); showHome(); }} /></button>}
          </div>

          {notFoundPath ? <section className="not-found-view">
            <div className="not-found-code" aria-hidden="true"><span>4</span><i>/</i><span>4</span></div>
            <p className="eyebrow">ROUTE_RESOLUTION_ERROR</p>
            <h1>File not found.</h1>
            <p>The route <code>{notFoundPath}</code> doesn’t exist in this workspace. It may have moved, been renamed, or never made it past review.</p>
            <div className="not-found-terminal"><span>osameh@portfolio:~$</span> resolve {notFoundPath}<br /><b>error:</b> no matching file or project route</div>
            <div className="detail-actions">
              <button className="primary-btn" onClick={() => showHome()}>Return to home <ArrowUpRight size={16} /></button>
              <button className="secondary-btn" onClick={() => { showHome(false, false); setActiveSectionPath("/projects"); if (window.location.pathname !== "/projects") window.history.pushState({}, "", "/projects"); scrollToSection("work"); }}>Browse projects</button>
            </div>
          </section> : activeNoteSlug ? <EngineeringNoteView slug={activeNoteSlug} onClose={() => closeNote()} /> : activeRepo ? <section className="ide-project-view" data-project-name={activeRepo.name}>
            <ProjectQuickAccess repo={activeRepo} />
            <header id={`overview-${activeRepo.name}`} className="ide-project-hero">
              <div>
                <p className="eyebrow">PROJECT / {activeRepo.language || "CODE"}</p>
                <h1>{repoMetadata[activeRepo.name]?.project.name || activeRepo.name}</h1>
                <p>{repoMetadata[activeRepo.name]?.project.tagline || activeRepo.description || "Explore the source, architecture, and implementation of this project."}</p>
                <div className="detail-actions">
                  <a href={'https://github.com/osameh15/' + activeRepo.name} target="_blank" rel="noreferrer" className="primary-btn">View source <ArrowUpRight size={16} /></a>
                  {npmUrl(activeRepo.name) && <a href={npmUrl(activeRepo.name)} target="_blank" rel="noreferrer" className="npm-btn"><Package size={16} /> View on npm <ArrowUpRight size={14} /></a>}
                  <button className="secondary-btn" onClick={() => { void shareProject(activeRepo).then(ok => showActionToast(ok ? "Project shared" : "Share cancelled")); }}>Share project <Send size={15} /></button>
                  <button className="secondary-btn back-portfolio" onClick={() => closeProject(activeRepo, true)}>Back to portfolio</button>
                </div>
              </div>
              <div className="ide-project-image">{repoImages[activeRepo.name] && <img src={repoImages[activeRepo.name]} alt={'Preview from ' + activeRepo.name + ' README'} onError={event => { event.currentTarget.hidden = true; }} />}<div className="image-fallback"><Code2 size={34} /><span>README preview</span></div></div>
            </header>
            <div className="ide-project-body">
              <aside className="repo-facts">
                <div><Star size={17} /><span><b>{activeRepo.stargazers_count}</b> stars</span></div>
                <div><Github size={17} /><span><b>{activeRepo.forks_count}</b> forks</span></div>
                <div><Code2 size={17} /><span><b>{activeRepo.language || "Mixed"}</b> language</span></div>
                <p className="facts-label">TECH & TOPICS</p>
                <div className="tags">{[activeRepo.language, ...activeRepo.topics].filter(Boolean).map(tag => <span key={tag}>{tag}</span>)}</div>
              </aside>
              <article id={`readme-${activeRepo.name}`} className="readme-card"><div className="readme-head"><span>README.md · Preview</span><span>github / {activeRepo.name}</span></div>
                {loadingReadmes.includes(activeRepo.name) ? <div className="readme-loading"><LoaderCircle className="spin" size={19} /> Rendering README preview…</div> : readmeHtml[activeRepo.name] ? <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: readmeHtml[activeRepo.name] }} /> : <div className="empty-readme">This repository does not include a public README yet. Open the source to explore its files and implementation.</div>}
              </article>
            </div>
            <ProjectMetadataPanel repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectMetrics repo={activeRepo} />
            <ProjectCaseStudyV3 repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectArchitecture repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectSourceExplorer repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <section id={`gallery-${activeRepo.name}`} className="project-gallery" aria-labelledby={`gallery-title-${activeRepo.id}`}>
              <div className="project-gallery-heading">
                <div><p className="eyebrow">PROJECT / GALLERY</p><h2 id={`gallery-title-${activeRepo.id}`}>Project visuals.</h2></div>
                <span>{repoGalleries[activeRepo.name]?.length ? `${repoGalleries[activeRepo.name].length} repository images discovered automatically` : "Images are discovered across the repository automatically."}</span>
              </div>
              {loadingGalleries.includes(activeRepo.name) ? <div className="gallery-loading"><LoaderCircle className="spin" size={19} /> Discovering project images…</div> : repoGalleries[activeRepo.name]?.length ? <div className="project-gallery-grid">
                {repoGalleries[activeRepo.name].map((image, index) => <button type="button" className="project-gallery-item" key={`${image.url}-${index}`} data-project-name={activeRepo.name} data-image-url={image.url} data-image-index={index} onClick={() => setGalleryLightbox({ repo: activeRepo.name, index })} aria-label={`Open ${image.name || image.path} in gallery`}>
                  <img src={image.url} alt={image.name || `${activeRepo.name} project image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.closest("button")?.setAttribute("hidden", ""); }} />
                  <span><ImageIcon size={13} />{image.path}</span>
                </button>)}
              </div> : <div className="gallery-empty"><ImageIcon size={22} /><span>No project images were found in the repository or README.</span></div>}
            </section>
          </section> : <>
          <section id="home" className="hero section-pad">
            <div className="line-nums" aria-hidden="true">01<br />02<br />03<br />04<br />05<br />06<br />07<br />08<br />09<br />10<br />11<br />12</div>
            <div className="hero-content">
              <p className={'code-kicker language-' + codeLanguage}>{code.open}</p>
              <p className="eyebrow">SOFTWARE ENGINEER · BACKEND · FULL-STACK · SYSTEMS</p>
              <h1>I build software<br />that stays <em>solid.</em></h1>
              <p className="hero-copy">I’m Osameh Irandoust — a software engineer turning complex systems into clear, fast, dependable products. From C++ internals to modern web experiences.</p>
              <div className="hero-actions">
                <a href="#work" className="primary-btn">Explore my work <ArrowUpRight size={17} /></a>
                <button onClick={copyEmail} className="text-btn">{copied ? <><Check size={16} /> Email copied</> : <>Copy email <span>⌘E</span></>}</button>
              </div>
              <p className="code-close"><b>{code.close}</b> <span>{code.comment}</span></p>
            </div>
            <HeroShowcase codeLanguage={codeLanguage} repoCount={repos.length} />
          </section>

          <section id="about" className="about section-pad">
            <div className="section-heading"><span>01</span><div><p>ABOUT.ME</p><h2>Engineering with range.</h2></div></div>
            <div className="about-grid">
              <div className="about-copy">
                <p>I work comfortably across the stack — close to the metal in C++ and Qt, inside production backends with .NET, or crafting polished interfaces with Nuxt.</p>
                <p>My focus is always the same: <strong>understand the real problem, choose the right level of complexity, and ship work that people can trust.</strong></p>
                <div className="signal-row"><span><Zap size={15} /> 4+ years in production</span><span><MapPin size={15} /> Tehran, Iran</span></div>
              </div>
              <div className="skills-viewer">
                <div className="skills-view-toolbar"><div><button className={skillsView === "code" ? "active" : ""} onClick={() => setSkillsView("code")}><Code2 size={13} /> Code</button><button className={skillsView === "ui" ? "active" : ""} onClick={() => setSkillsView("ui")}><LayoutGrid size={13} /> Preview</button></div><span>{skillsView === "code" ? code.label + " source" : "Visual stack"}</span></div>
                {skillsView === "code" ? <div className="skills-code" aria-label={'Skills rendered as ' + code.label + ' source code'}>
                  <div className="skills-code-head"><span><i /><i /><i /></span><p>{code.stack}</p><small>{code.label}</small></div>
                  <div className="skills-code-body"><div className="skill-line-numbers" aria-hidden="true">{skillLines.map((_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div><pre><code>{skillLines.join("\n")}</code></pre></div>
                  <div className="skills-code-foot"><span><i /> Valid stack</span><span>UTF-8</span><span>Ln {skillLines.length}, Col 1</span></div>
                </div> : <div className="skills-preview" aria-label="Skills card preview">
                  {skills.map(([title, ...items], index) => <article key={title} className={'skill-card accent-' + index}><header><span>{String(index + 1).padStart(2, "0")}</span><i /></header><h3>{title}</h3><div>{items.map(item => <button type="button" key={item} onClick={() => exploreTech(item)} title={`Show projects related to ${item}`}>{item}</button>)}</div></article>)}
                </div>}
              </div>
            </div>
          </section>

          <section id="work" ref={projectsSectionRef} className="work section-pad">
            <div className="section-heading"><span>02</span><div><p>{code.projects.toUpperCase()}</p><h2>Everything I’m building.</h2></div><div className="section-heading-actions"><button type="button" className="section-link section-link-button" onClick={() => setRecruiterModeOpen(true)}><Command size={15} /> Recruiter mode</button><a href="https://github.com/osameh15?tab=repositories" target="_blank" rel="noreferrer" className="section-link">GitHub profile <ArrowUpRight size={15} /></a></div></div>
            <p className="projects-intro">A live view of public work enriched by repository-owned <code>portfolio.json</code> metadata. Archived repositories stay out of the way.</p>
            {metadataState === "loading" && <div className="metadata-loading"><LoaderCircle className="spin" size={14} /> Reading project metadata…</div>}
            <FeaturedProjects repos={repos} metadata={repoMetadata} onOpen={repo => { const full = repos.find(item => item.id === repo.id); if (full) openProject(full); }} onRecruiterMode={() => setRecruiterModeOpen(true)} />
            <div id="project-filter-panel" className="project-controls" aria-label="Project search and filters">
              <label className="project-search"><Search size={15} /><input ref={projectSearchRef} value={projectQuery} onChange={event => { setProjectQuery(event.target.value); setVisibleRepos(6); }} placeholder="Search repositories, stack, topics…" aria-label="Search projects" /><kbd>/</kbd></label>
              <select value={projectTech} onChange={event => { setProjectTech(event.target.value); setVisibleRepos(6); }} aria-label="Filter by technology"><option value="all">All technologies</option>{projectTechOptions.map(tech => <option key={tech} value={tech}>{tech}</option>)}</select>
              <select value={projectSort} onChange={event => setProjectSort(event.target.value as "recent" | "stars" | "name")} aria-label="Sort projects"><option value="recent">Recently updated</option><option value="stars">Most starred</option><option value="name">Name A-Z</option></select>
              {(projectQuery || projectTech !== "all") && <button className="clear-filter" onClick={() => { setProjectQuery(""); setProjectTech("all"); }}><X size={14} /> Clear</button>}
            </div>
            <div className="stack-explorer" aria-label="Technology explorer"><span>Explore by stack</span>{["C#", "Vue", "TypeScript", "PHP", "Java", "Kotlin", "Nuxt", "Android"].map(tech => <button key={tech} className={projectTech.toLowerCase() === tech.toLowerCase() ? "active" : ""} onClick={() => exploreTech(tech)}>{tech}</button>)}</div>
            {repoState === "loading" && <div className="repo-status"><LoaderCircle className="spin" size={20} /> Fetching projects from GitHub…</div>}
            {repoState === "ready" && <>
              <div className="project-grid">{filteredRepos.slice(0, visibleRepos).map((project, index) => (
                <article role="button" tabIndex={0} onClick={() => openProject(project)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProject(project); } }} className={'project-card tone-' + (index % 3)} key={project.id} data-project-name={project.name} aria-label={'Open ' + project.name + ' project details'}>
                  <div className="project-top"><span>{String(index + 1).padStart(2, "0")}</span><span className="project-stats"><Star size={13} /> {project.stargazers_count}<Github size={13} /> {project.forks_count}</span><ArrowUpRight size={19} /></div>
                  <div className="project-image">
                    {repoImages[project.name] && <img src={repoImages[project.name]} alt={'Preview from ' + project.name + ' README'} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
                    <div className="image-fallback"><Code2 size={31} /><span>{project.language || "Code"}</span></div>
                  </div>
                  <p className="project-type">{repoMetadata[project.name]?.project.type || project.language || "Repository"} · Updated {new Date(project.updated_at).toLocaleDateString("en", { month: "short", year: "numeric" })}{repoMetadata[project.name]?.project.featured ? " · Featured" : ""}</p>
                  <h3>{repoMetadata[project.name]?.project.name || project.name}</h3><p className="project-desc">{repoMetadata[project.name]?.project.tagline || project.description || "Explore the source, architecture, and latest work in this repository."}</p>
                  <div className="tags">{[project.language, ...project.topics].filter(Boolean).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
                  <div className="project-links"><span className="open-detail">Open project details <ArrowUpRight size={14} /></span><button className={compareRepos.some(item => item.id === project.id) ? "compare-chip active" : "compare-chip"} onClick={event => { event.stopPropagation(); toggleCompareRepo(project); }} aria-pressed={compareRepos.some(item => item.id === project.id)}><Code2 size={13} /> {compareRepos.some(item => item.id === project.id) ? "Selected" : "Compare"}</button>{npmUrl(project.name) && <a className="npm-chip" href={npmUrl(project.name)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label={'View ' + npmPackages[project.name] + ' on npm'}><Package size={13} /> npm <ArrowUpRight size={12} /></a>}</div>
                </article>
              ))}</div>
              {!filteredRepos.length && <div className="project-empty"><Search size={20} /><p>No project matches the current search/filter.</p><button onClick={() => { setProjectQuery(""); setProjectTech("all"); }}>Reset filters</button></div>}
              {visibleRepos < filteredRepos.length && <div className="load-more-wrap"><button className="load-more" onClick={() => setVisibleRepos(count => count + 6)}>Load more projects <span>{Math.min(visibleRepos, filteredRepos.length)} / {filteredRepos.length}</span></button></div>}
            </>}
          </section>

          <section id="experience" className="experience section-pad">
            <div className="section-heading"><span>03</span><div><p>EXPERIENCE/</p><h2>Built in the real world.</h2></div></div>
            <div className="experience-layout">
              <div className="role-list">{roles.map((role, index) => <article className="role" key={role.company}>
                <div className="role-marker"><Circle size={10} fill="currentColor" />{index < roles.length - 1 && <i />}</div>
                <p className="years">{role.years}</p><div><h3>{role.role}</h3><h4>@ {role.company}</h4><p>{role.detail}</p></div>
              </article>)}</div>
              <aside className="terminal-card">
                <div className="terminal-head"><span><i /><i /><i /></span><p>osameh — zsh</p></div>
                <div className="terminal-body"><p><b>~</b> whoami</p><span>Software Engineer</span><p><b>~</b> cat focus.txt</p><span>Backend Architecture<br />Performance Optimization<br />System Design<br />AI Integration</span><p><b>~</b> uptime</p><span>Always learning <i className="cursor" /></span></div>
              </aside>
            </div>
          </section>

          <GithubActivity />
          <NowSection />
          <ChangelogSection />
          <EngineeringNotesSection onOpenNote={openNote} />

          <section id="contact" className="contact section-pad">
            <div className="contact-icon"><ServerCog size={27} /></div><p className="eyebrow">READY FOR THE NEXT BUILD</p>
            <h2>Have a difficult problem?<br /><em>Let’s make it simple.</em></h2>
            <p>Open to thoughtful engineering roles, ambitious products, and conversations about how software should work.</p>
            <a href="mailto:osirandoust@gmail.com" className="primary-btn">Start a conversation <Mail size={17} /></a>
            <ContactForm fileName={contactFiles[codeLanguage]} />
            <div className="email-options" aria-label="Email contacts">
              <a href="mailto:osirandoust@gmail.com"><span>Personal</span>osirandoust@gmail.com</a>
              <a href="mailto:support@osameh.dev"><span>Business &amp; formal</span>support@osameh.dev</a>
            </div>
            <div className="social-row">
              <a href="https://github.com/osameh15" target="_blank" rel="noreferrer"><Github size={17} /> GitHub</a>
              <a href="https://gitlab.com/osameh15" target="_blank" rel="noreferrer"><Gitlab size={17} /> GitLab</a>
              <a href="https://www.linkedin.com/in/osameh-irandoust-493359173/" target="_blank" rel="noreferrer"><Linkedin size={17} /> LinkedIn</a>
              <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer"><Send size={17} /> Telegram</a>
              <a href="https://instagram.com/osameh.ir" target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>
              <a href="https://wa.me/989369642754" target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>
            </div>
          </section>
          <footer><span>© 2026 Osameh Irandoust</span><span className="footer-status"><i /> All systems operational</span><button type="button" className="build-version build-version-button" title={`${BUILD_ID} · built ${BUILD_TIME}`} onClick={() => window.dispatchEvent(new Event("portfolio:build"))}>build {BUILD_DISPLAY}</button><span>Designed & built with intention.</span></footer>
          </>}
        </div>
        {contextMenu && <div className="custom-context-menu" ref={contextMenuRef} role="menu" aria-label="Portfolio context menu">
          <div className="context-menu-head"><span><Command size={13} /> osameh.dev</span><code>{contextRepo ? contextRepo.name : contextMenu.imageUrl ? "image" : contextMenu.linkUrl ? "link" : "workspace"}</code></div>
          {contextMenu.selection && <div className="context-menu-group"><button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.selection || "", "Selection copied"); })}><Copy size={15} /><span>Copy selection</span><kbd>⌘C</kbd></button></div>}
          {contextMenu.imageUrl && <div className="context-menu-group"><p>IMAGE</p>
            {contextRepo && contextMenu.imageIndex !== undefined && contextMenu.imageIndex >= 0 && <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => setGalleryLightbox({ repo: contextRepo.name, index: contextMenu.imageIndex || 0 }))}><ImageIcon size={15} /><span>Open fullscreen</span><small>Gallery</small></button>}
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(contextMenu.imageUrl || "", "_blank", "noopener,noreferrer"))}><ExternalLink size={15} /><span>Open original image</span><small>New tab</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.imageUrl || "", "Image URL copied"); })}><Link2 size={15} /><span>Copy image URL</span></button>
          </div>}
          {contextRepo && <div className="context-menu-group"><p>PROJECT</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openProject(contextRepo))}><FolderOpen size={15} /><span>Open project</span><small>{contextRepo.name}.md</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(`https://github.com/${GITHUB_OWNER}/${contextRepo.name}`, "_blank", "noopener,noreferrer"))}><Github size={15} /><span>View on GitHub</span><small>Source</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void shareProject(contextRepo).then(ok => showActionToast(ok ? "Project shared" : "Share cancelled")); })}><Send size={15} /><span>Share project</span><small>Native share</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(projectShareUrl(contextRepo), "Project link copied"); })}><Link2 size={15} /><span>Copy project link</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { openProject(contextRepo); window.setTimeout(() => document.getElementById(`gallery-${contextRepo.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); })}><ImageIcon size={15} /><span>Open gallery</span><small>{repoGalleries[contextRepo.name]?.length || "Auto"}</small></button>
          </div>}
          {contextMenu.linkUrl && <div className="context-menu-group"><p>LINK</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { window.location.href = contextMenu.linkUrl || "#"; })}><ExternalLink size={15} /><span>Open link</span><small>{contextMenu.linkLabel?.slice(0, 20)}</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(contextMenu.linkUrl || "", "_blank", "noopener,noreferrer"))}><ExternalLink size={15} /><span>Open in new tab</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.linkUrl || "", "Link copied"); })}><Copy size={15} /><span>Copy link</span></button>
          </div>}
          {!contextRepo && !contextMenu.imageUrl && !contextMenu.linkUrl && <div className="context-menu-group"><p>NAVIGATE</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[0]))}><HomeIcon size={15} /><span>Home</span><small>/home</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[2]))}><Code2 size={15} /><span>Projects</span><small>/projects</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[1]))}><Braces size={15} /><span>About</span><small>/about</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[3]))}><FileCode2 size={15} /><span>Experience</span><small>/experience</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[4]))}><Zap size={15} /><span>Now</span><small>/now</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[5]))}><RefreshCw size={15} /><span>Changelog</span><small>/changelog</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[7]))}><Braces size={15} /><span>Engineering Notes</span><small>/notes</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sections[6]))}><Mail size={15} /><span>Contact</span><small>/contact</small></button>
          </div>}
          <div className="context-menu-group"><p>WORKSPACE</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { setCommandQuery(""); setCommandIndex(0); setCommandPaletteOpen(true); })}><Command size={15} /><span>Command Palette</span><kbd>⌘K</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openTerminal())}><Terminal size={15} /><span>Open Terminal</span><kbd>`</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:resume")))}><FileCode2 size={15} /><span>Open Resume</span><small>PDF</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => setRecruiterModeOpen(true))}><Command size={15} /><span>Recruiter mode</span><small>tour</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:diagnostics")))}><Monitor size={15} /><span>System Health Center</span><small>live</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:shortcuts")))}><Command size={15} /><span>Keyboard shortcuts</span><kbd>?</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:install")))}><Download size={15} /><span>Install app</span><small>PWA</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(toggleThemeMode)}>{document.documentElement.dataset.theme === "light" ? <Moon size={15} /> : <Sun size={15} />}<span>Switch theme</span><small>{document.documentElement.dataset.theme === "light" ? "Dark" : "Light"}</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(window.location.href, "Page URL copied"); })}><Copy size={15} /><span>Copy page URL</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.location.reload())}><RefreshCw size={15} /><span>Refresh</span><kbd>⌘R</kbd></button>
          </div>
          <div className="context-menu-group context-menu-easter"><button className="context-menu-item" role="menuitem" onClick={() => runContextAction(runHireEasterEgg)}><Terminal size={15} /><span>sudo hire osameh</span><small>run</small></button></div>
          <div className="context-menu-foot"><span>{BUILD_DISPLAY}</span><span><kbd>↑↓</kbd> navigate · <kbd>Esc</kbd> close</span></div>
        </div>}
        {commandPaletteOpen && <div className="command-palette-backdrop" role="presentation" onMouseDown={() => setCommandPaletteOpen(false)}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command Palette" onMouseDown={event => event.stopPropagation()}>
            <div className="command-palette-search"><Search size={17} /><input ref={commandPaletteInputRef} value={commandQuery} onChange={event => setCommandQuery(event.target.value)} onKeyDown={event => {
              if (event.key === "Escape") { event.preventDefault(); setCommandPaletteOpen(false); return; }
              if (event.key === "ArrowDown") { event.preventDefault(); if (filteredPaletteCommands.length) setCommandIndex(index => (Math.min(index, filteredPaletteCommands.length - 1) + 1) % filteredPaletteCommands.length); return; }
              if (event.key === "ArrowUp") { event.preventDefault(); if (filteredPaletteCommands.length) setCommandIndex(index => (Math.min(index, filteredPaletteCommands.length - 1) - 1 + filteredPaletteCommands.length) % filteredPaletteCommands.length); return; }
              if (event.key === "Enter" && filteredPaletteCommands[safeCommandIndex]) { event.preventDefault(); runPaletteCommand(filteredPaletteCommands[safeCommandIndex]); }
            }} placeholder="Search commands, projects, technologies…" aria-label="Search commands" autoComplete="off" /><kbd>ESC</kbd></div>
            <div ref={commandPaletteListRef} className="command-palette-list" role="listbox" aria-label="Available commands">
              {filteredPaletteCommands.length ? filteredPaletteCommands.map((item, index) => <button key={item.id} className={index === safeCommandIndex ? "active" : ""} role="option" aria-selected={index === safeCommandIndex} onMouseEnter={() => setCommandIndex(index)} onClick={() => runPaletteCommand(item)}><span className="command-palette-icon">{paletteIcon(item.icon)}</span><span><b>{item.label}</b><small>{item.hint}</small></span><CornerDownLeft size={13} /></button>) : <div className="command-palette-empty"><Search size={18} /><span>No command matches “{commandQuery}”.</span></div>}
            </div>
            <div className="command-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>esc</kbd> close</span><code>{BUILD_VERSION}</code></div>
          </section>
        </div>}
        {actionToast && <div className={`action-toast ${actionToast.kind}`} role={actionToast.kind === "error" ? "alert" : "status"} aria-live={actionToast.kind === "error" ? "assertive" : "polite"}>
          <span className="action-toast-icon">{actionToast.kind === "success" ? <Check size={18} /> : actionToast.kind === "warning" || actionToast.kind === "error" ? <AlertTriangle size={18} /> : <Info size={18} />}</span>
          <span>{actionToast.message}</span>
        </div>}
        {compareRepos.length > 0 && <div className="compare-bar"><span><Code2 size={14} /> Compare queue</span><div>{compareRepos.map(repo => <button key={repo.id} onClick={() => toggleCompareRepo(repo)}>{repo.name} <X size={12} /></button>)}</div><button className="compare-run" disabled={compareRepos.length !== 2} onClick={() => { if (compareRepos.length === 2) { setCompareModalOpen(true); trackEvent("project_compare", compareRepos.map(repo => repo.name).join(" vs ")); } }}>{compareRepos.length === 2 ? "Compare 2 projects" : "Select one more"}</button></div>}
        <RecruiterMode open={recruiterModeOpen} repos={repos} metadata={repoMetadata} onClose={() => setRecruiterModeOpen(false)} onOpenProject={repo => { const full = repos.find(item => item.id === repo.id); if (full) openProject(full); }} />
        <ResumeViewer onOpenChange={setResumeOpen} />
        <BuildInfoModal />
        <SystemDiagnostics />
        <ShortcutGuide />
        {compareModalOpen && compareRepos.length === 2 && <ProjectCompare repos={compareRepos} onClose={() => setCompareModalOpen(false)} />}
        {galleryLightbox && (() => {
          const gallery = repoGalleries[galleryLightbox.repo] || [];
          const image = gallery[galleryLightbox.index];
          if (!image) return null;
          const move = (direction: number) => setGalleryLightbox(current => current ? { ...current, index: (current.index + direction + gallery.length) % gallery.length } : current);
          return <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${galleryLightbox.repo} image gallery`} onClick={() => setGalleryLightbox(null)}>
            <button type="button" className="gallery-lightbox-close" onClick={() => setGalleryLightbox(null)} aria-label="Close gallery"><X size={20} /></button>
            {gallery.length > 1 && <button type="button" className="gallery-lightbox-nav previous" onClick={event => { event.stopPropagation(); move(-1); }} aria-label="Previous image"><ChevronLeft size={24} /></button>}
            <figure onClick={event => event.stopPropagation()}>
              <img src={image.url} alt={image.name || image.path} data-project-name={galleryLightbox.repo} data-image-url={image.url} data-image-index={galleryLightbox.index} referrerPolicy="no-referrer" />
              <figcaption><span>{galleryLightbox.index + 1} / {gallery.length}</span><code>{image.path}</code></figcaption>
            </figure>
            {gallery.length > 1 && <button type="button" className="gallery-lightbox-nav next" onClick={event => { event.stopPropagation(); move(1); }} aria-label="Next image"><ChevronRight size={24} /></button>}
          </div>;
        })()}
        {panelOpen && <section className={panelMaximized ? "bottom-panel panel-maximized" : "bottom-panel"} style={{ height: panelMaximized ? "calc(100vh - 72px)" : `${panelHeight}px` }} aria-label="IDE bottom panel">
          <div className="panel-resize-handle" role="separator" aria-label="Resize terminal panel" aria-orientation="horizontal" onDoubleClick={togglePanelMaximized} onPointerDown={beginPanelResize} onPointerMove={resizePanel} onPointerUp={endPanelResize} onPointerCancel={endPanelResize}><span /></div>
          <div className="panel-head">
            <div className="panel-tabs">
              <button className={panelTab === "outline" ? "active" : ""} onClick={() => setPanelTab("outline")}><ListTree size={13} /> OUTLINE</button>
              <button className={panelTab === "terminal" ? "active" : ""} onClick={() => setPanelTab("terminal")}><Terminal size={13} /> TERMINAL</button>
            </div>
            <div className="panel-window-actions">
              <button className="panel-close" onClick={togglePanelMaximized} aria-label={panelMaximized ? "Restore panel size" : "Maximize panel"} title={panelMaximized ? "Restore panel size" : "Maximize panel"}>{panelMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
              <button className="panel-close" onClick={() => setPanelOpen(false)} aria-label="Close panel"><X size={15} /></button>
            </div>
          </div>
          {panelTab === "outline" ? <div className="outline-panel">
            <div className="outline-tree">
              <p><ChevronDown size={13} /> OSAMEH-PORTFOLIO</p>
              {sections.map(item => <button key={item.path} onClick={() => goTo(item)}><span>{item.path}</span><small>{item.label}</small></button>)}
            </div>
            <div className="outline-projects">
              <p>PROJECT ROUTES</p>
              {repos.map(repo => <button key={repo.id} onClick={() => openProject(repo)}><Code2 size={12} /><span>/{repo.name}</span></button>)}
            </div>
          </div> : <div className="terminal-panel">
            <div className="terminal-output" ref={terminalOutputRef}>
              {terminalLines.map((line, index) => <p key={index} className={line.startsWith("›") ? "command-line" : ""}>{line}</p>)}
              {searchResults.map(result => <button key={result.path} onClick={() => goTo(result)}><Search size={12} /><span>{result.path}</span><small>{result.label}</small></button>)}
            </div>
            <form className="terminal-input-row" onSubmit={runTerminal}>
              <span>osameh@portfolio:~$</span>
              <div className="terminal-input-shell">
                {terminalGhostSuffix && <div className="terminal-input-ghost" aria-hidden="true"><span>{terminalInput}</span><em>{terminalGhostSuffix}</em></div>}
                <input ref={terminalInputRef} value={terminalInput} onChange={event => { setTerminalInput(event.target.value); terminalCompletionRef.current = { seed: "", matches: [], index: -1, applied: "" }; }} onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); autocompleteTerminal(event.shiftKey); } }} placeholder="Type help… · Tab autocomplete" aria-label="Terminal command" autoComplete="off" spellCheck={false} />
              </div>
              <small className="terminal-tab-hint"><kbd>Tab</kbd> autocomplete</small>
              <button type="submit" aria-label="Run command"><CornerDownLeft size={15} /></button>
            </form>
          </div>}
        </section>}
        <div className="status-bar">
          <span><Github size={12} /> main*</span><button type="button" className="status-build status-build-button" title={`${BUILD_ID} · built ${BUILD_TIME}`} onClick={() => window.dispatchEvent(new Event("portfolio:build"))}>{BUILD_VERSION}</button><span className="status-online"><i /> {code.label} mode</span>
          <button onClick={() => { if (panelOpen) setPanelOpen(false); else openTerminal(); }}><PanelBottom size={13} /> {panelOpen ? "Close panel" : "Open panel"}</button>
        </div>
      </div>
    </main>
  );
}
