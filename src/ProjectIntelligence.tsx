import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, ChevronRight,
  Circle, Code2, Copy, ExternalLink, FileCode2, FolderOpen, GitBranch, LayoutGrid,
  LoaderCircle, Package, Search, ShieldCheck, Sparkles, Star, Terminal, X, Zap,
} from "lucide-react";
import { notify } from "./toast";
import type { RepoLike } from "./portfolioData";
import {
  fallbackPortfolioMetadata,
  type ArchitectureNode,
  type PortfolioMetadata,
  type ProjectMetricsPayload,
  type SourceFilePayload,
  type SourceTreeFile,
  type SourceTreePayload,
} from "./projectMetadata";

type RepoMetadataMap = Record<string, PortfolioMetadata | undefined>;

function metadataFor(repo: RepoLike, metadata?: PortfolioMetadata) {
  return metadata || fallbackPortfolioMetadata(repo);
}

export function ProjectMetadataPanel({ repo, metadata }: { repo: RepoLike; metadata?: PortfolioMetadata }) {
  const meta = metadataFor(repo, metadata);
  const stack = [
    ...meta.stack.languages,
    ...meta.stack.frameworks,
    ...meta.stack.libraries,
    ...meta.stack.databases,
    ...meta.stack.platforms,
  ].filter((value, index, all) => all.indexOf(value) === index).slice(0, 12);

  return <section id={`metadata-${repo.name}`} className="project-metadata-panel" aria-labelledby={`metadata-title-${repo.id}`}>
    <div className="advanced-section-head">
      <div><p className="eyebrow">PROJECT / METADATA</p><h2 id={`metadata-title-${repo.id}`}>Repository-owned context.</h2></div>
      <span>{meta.schemaVersion === "fallback" ? "Generated fallback" : `portfolio.json · schema ${meta.schemaVersion}`}</span>
    </div>
    <div className="project-metadata-grid">
      <article><small>TYPE</small><b>{meta.project.type}</b><span>{meta.project.lifecycle}{meta.project.legacy ? " · legacy" : ""}</span></article>
      <article><small>ROLE</small><b>{meta.ownership.role}</b><span>{meta.ownership.collaboration}{meta.ownership.organization ? ` · ${meta.ownership.organization}` : ""}</span></article>
      <article><small>REPOSITORY</small><b>{meta.repository.owner}/{meta.repository.name}</b><span>{meta.repository.defaultBranch}{meta.repository.license ? ` · ${meta.repository.license}` : ""}</span></article>
      <article><small>PORTFOLIO</small><b>{meta.project.featured ? "Featured" : "Standard"}</b><span>{meta.recruiter.skillsDemonstrated.slice(0, 3).join(" · ") || "Public engineering work"}</span></article>
    </div>
    <p className="project-metadata-summary">{meta.project.summary}</p>
    {stack.length > 0 && <div className="metadata-stack">{stack.map(item => <span key={item}>{item}</span>)}</div>}
    {meta.ownership.responsibilities.length > 0 && <div className="metadata-responsibilities"><small>RESPONSIBILITIES</small><div>{meta.ownership.responsibilities.slice(0, 8).map(item => <span key={item}><Check size={13} />{item}</span>)}</div></div>}
  </section>;
}

export function ProjectMetrics({ repo }: { repo: RepoLike }) {
  const [metrics, setMetrics] = useState<ProjectMetricsPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/github/metrics/${encodeURIComponent(repo.name)}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Metrics request failed (${response.status})`);
        return response.json() as Promise<ProjectMetricsPayload>;
      })
      .then(payload => {
        if (cancelled) return;
        setMetrics(payload);
        setState("ready");
      })
      .catch(error => {
        if (cancelled || error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => { cancelled = true; controller.abort(); };
  }, [repo.name]);

  const formatDate = (value: string) => value ? new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "—";
  const formatSize = (kb: number) => kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${kb.toLocaleString()} KB`;

  return <section id={`metrics-${repo.name}`} className="project-metrics" aria-labelledby={`metrics-title-${repo.id}`}>
    <div className="advanced-section-head">
      <div><p className="eyebrow">PROJECT / METRICS</p><h2 id={`metrics-title-${repo.id}`}>Repository signals.</h2></div>
      <span>Live GitHub data · 1h origin cache</span>
    </div>
    {state === "loading" && <div className="project-metrics-loading"><LoaderCircle size={17} className="spin" /> Loading repository metrics…</div>}
    {state === "error" && <div className="project-metrics-empty">Metrics are temporarily unavailable. The rest of the project view remains available from cached repository data.</div>}
    {state === "ready" && metrics && <>
      <div className="project-metrics-grid">
        <article><small>STARS</small><b>{metrics.stars.toLocaleString()}</b><span>{metrics.forks.toLocaleString()} forks</span></article>
        <article><small>SIZE</small><b>{formatSize(metrics.size_kb)}</b><span>{metrics.default_branch} branch</span></article>
        <article><small>LICENSE</small><b>{metrics.license?.spdx && metrics.license.spdx !== "NOASSERTION" ? metrics.license.spdx : "Not declared"}</b><span>{metrics.license?.name || "Repository metadata"}</span></article>
        <article><small>LAST PUSH</small><b>{formatDate(metrics.pushed_at)}</b><span>{metrics.open_issues} open issue{metrics.open_issues === 1 ? "" : "s"}</span></article>
      </div>
      {metrics.languages.length > 0 && <div className="project-language-breakdown">
        <div className="language-breakdown-head"><small>LANGUAGE BREAKDOWN</small><span>{metrics.languages.length} detected</span></div>
        <div className="language-bar" aria-label="Repository language percentages">
          {metrics.languages.map(language => <span key={language.name} style={{ width: `${Math.max(language.percent, .5)}%` }} title={`${language.name}: ${language.percent}%`} />)}
        </div>
        <div className="language-legend">{metrics.languages.slice(0, 8).map((language, index) => <span key={language.name}><i data-index={index} />{language.name}<b>{language.percent}%</b></span>)}</div>
      </div>}
      <div className="project-metrics-foot">
        <span>Created {formatDate(metrics.created_at)}</span>
        <span>Updated {formatDate(metrics.updated_at)}</span>
        {metrics.latest_release?.tag && <a href={metrics.latest_release.url} target="_blank" rel="noopener noreferrer"><Package size={14} /> Latest release {metrics.latest_release.tag}</a>}
      </div>
    </>}
  </section>;
}

export function ProjectCaseStudyV3({ repo, metadata }: { repo: RepoLike; metadata?: PortfolioMetadata }) {
  const meta = metadataFor(repo, metadata);
  const study = meta.caseStudy;
  return <section id={`case-study-${repo.name}`} className="case-study case-study-v3" aria-labelledby={`case-study-title-${repo.id}`}>
    <div className="advanced-section-head"><div><p className="eyebrow">PROJECT / CASE STUDY</p><h2 id={`case-study-title-${repo.id}`}>How it was engineered.</h2></div><span>Problem → decisions → results</span></div>
    <div className="case-study-grid">
      <article><small>01 / PROBLEM</small><h3>The problem</h3><p>{study.problem}</p></article>
      <article><small>02 / SOLUTION</small><h3>The approach</h3><p>{study.solution}</p></article>
      <article><small>03 / HIGHLIGHTS</small><h3>Engineering highlights</h3><ul>{study.highlights.slice(0, 8).map(item => <li key={item}>{item}</li>)}</ul></article>
      <article><small>04 / CHALLENGES</small><h3>Decisions under pressure</h3><div className="challenge-list">{study.challenges.length ? study.challenges.map(challenge => <div key={challenge.title}><b>{challenge.title}</b><p>{challenge.description}</p><span>{challenge.resolution}</span></div>) : <p>No structured challenge notes have been published for this repository yet.</p>}</div></article>
      <article className="case-study-result"><small>05 / RESULT</small><h3>What shipped</h3><ul>{study.results.map(item => <li key={item}>{item}</li>)}</ul></article>
    </div>
  </section>;
}

const nodeIcon = (node: ArchitectureNode) => {
  const value = node.type.toLowerCase();
  if (value.includes("client") || value.includes("ui") || value.includes("frontend")) return <Code2 size={16} />;
  if (value.includes("storage") || value.includes("database")) return <Package size={16} />;
  if (value.includes("external") || value.includes("edge")) return <ArrowUpRight size={16} />;
  if (value.includes("ci") || value.includes("hosting")) return <GitBranch size={16} />;
  return <LayoutGrid size={16} />;
};

export function ProjectArchitecture({ repo, metadata }: { repo: RepoLike; metadata?: PortfolioMetadata }) {
  const meta = metadataFor(repo, metadata);
  const graph = meta.architecture;
  if (!graph.nodes.length) return null;
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  return <section id={`architecture-${repo.name}`} className="architecture-viewer" aria-labelledby={`architecture-title-${repo.id}`}>
    <div className="advanced-section-head"><div><p className="eyebrow">PROJECT / ARCHITECTURE</p><h2 id={`architecture-title-${repo.id}`}>System architecture.</h2></div><span>{graph.nodes.length} nodes · {graph.edges.length} relationships</span></div>
    <p className="architecture-summary">{graph.summary}</p>
    <div className="architecture-canvas">
      <div className="architecture-nodes">{graph.nodes.map((node, index) => <article key={node.id} className={`architecture-node type-${node.type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}><span>{String(index + 1).padStart(2, "0")}</span><i>{nodeIcon(node)}</i><div><b>{node.label}</b><small>{node.type}</small></div></article>)}</div>
      <div className="architecture-flows"><header><Terminal size={15} /><span>flows.map</span></header>{graph.edges.map((edge, index) => <div key={`${edge.from}-${edge.to}-${index}`}><span>{nodeMap.get(edge.from)?.label || edge.from}</span><ChevronRight size={14} /><small>{edge.label || "connects"}</small><ChevronRight size={14} /><span>{nodeMap.get(edge.to)?.label || edge.to}</span></div>)}</div>
    </div>
  </section>;
}

type TreeNode = {
  name: string;
  path: string;
  dirs: Map<string, TreeNode>;
  files: SourceTreeFile[];
};

function buildTree(files: SourceTreeFile[]) {
  const root: TreeNode = { name: "root", path: "", dirs: new Map(), files: [] };
  files.forEach(file => {
    const parts = file.path.split("/");
    const name = parts.pop() || file.name;
    let cursor = root;
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let next = cursor.dirs.get(part);
      if (!next) {
        next = { name: part, path: currentPath, dirs: new Map(), files: [] };
        cursor.dirs.set(part, next);
      }
      cursor = next;
    }
    cursor.files.push({ ...file, name });
  });
  return root;
}

function SourceTreeNode({ node, activePath, onOpen, depth = 0 }: { node: TreeNode; activePath: string; onOpen: (file: SourceTreeFile) => void; depth?: number }) {
  const directories = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
  return <>{directories.map(directory => <details className="source-dir" key={directory.path} open={depth < 1}><summary><FolderOpen size={14} /><span>{directory.name}</span></summary><div className="source-dir-children"><SourceTreeNode node={directory} activePath={activePath} onOpen={onOpen} depth={depth + 1} /></div></details>)}{files.map(file => <button type="button" key={file.path} className={activePath === file.path ? "source-file active" : "source-file"} onClick={() => onOpen(file)} title={file.path}><FileCode2 size={13} /><span>{file.name}</span><small>{file.language}</small></button>)}</>;
}

const languageKeywords: Record<string, string[]> = {
  typescript: ["const", "let", "var", "function", "return", "async", "await", "type", "interface", "export", "import", "from", "if", "else", "for", "while", "new", "class", "extends", "true", "false", "null", "undefined"],
  javascript: ["const", "let", "var", "function", "return", "async", "await", "export", "import", "from", "if", "else", "for", "while", "new", "class", "extends", "true", "false", "null", "undefined"],
  csharp: ["public", "private", "protected", "class", "interface", "namespace", "using", "return", "async", "await", "var", "new", "if", "else", "foreach", "string", "int", "bool", "true", "false", "null"],
  java: ["public", "private", "protected", "class", "interface", "package", "import", "return", "new", "if", "else", "for", "while", "String", "int", "boolean", "true", "false", "null"],
  php: ["function", "return", "class", "public", "private", "protected", "if", "else", "foreach", "while", "true", "false", "null", "use", "namespace"],
  python: ["def", "return", "class", "import", "from", "if", "else", "elif", "for", "while", "in", "is", "None", "True", "False", "async", "await"],
  go: ["package", "import", "func", "return", "type", "struct", "interface", "var", "const", "if", "else", "for", "range", "go", "defer", "true", "false", "nil"],
  kotlin: ["package", "import", "class", "object", "fun", "val", "var", "return", "if", "else", "when", "for", "while", "true", "false", "null"],
};

function commentIndex(line: string, language: string) {
  const markers = language === "python" || language === "ruby" || language === "shell" ? ["#"] : language === "sql" ? ["--"] : ["//"];
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'" || char === "`") && line[index - 1] !== "\\") quote = quote === char ? "" : quote || char;
    if (quote) continue;
    for (const marker of markers) if (line.startsWith(marker, index)) return index;
  }
  return -1;
}

function CodeSegment({ value, language }: { value: string; language: string }) {
  const keywords = new Set(languageKeywords[language] || []);
  const parts = value.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g).filter(Boolean);
  return <>{parts.map((part, index) => {
    const key = `${index}-${part.slice(0, 10)}`;
    if (/^(?:"|'|`)/.test(part)) return <span className="tok-string" key={key}>{part}</span>;
    if (/^\d/.test(part)) return <span className="tok-number" key={key}>{part}</span>;
    if (keywords.has(part)) return <span className="tok-keyword" key={key}>{part}</span>;
    if (/^[A-Z][\w$]*$/.test(part)) return <span className="tok-type" key={key}>{part}</span>;
    return <Fragment key={key}>{part}</Fragment>;
  })}</>;
}

function SourceLine({ line, language, number }: { line: string; language: string; number: number }) {
  const index = commentIndex(line, language);
  const code = index >= 0 ? line.slice(0, index) : line;
  const comment = index >= 0 ? line.slice(index) : "";
  return <div className="source-code-line"><span className="source-line-number">{number}</span><code><CodeSegment value={code} language={language} />{comment && <span className="tok-comment">{comment}</span>}</code></div>;
}

export function ProjectSourceExplorer({ repo, metadata }: { repo: RepoLike; metadata?: PortfolioMetadata }) {
  const meta = metadataFor(repo, metadata);
  const rootRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [tree, setTree] = useState<SourceTreePayload | null>(null);
  const [treeState, setTreeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activePath, setActivePath] = useState("");
  const [source, setSource] = useState<SourceFilePayload | null>(null);
  const [sourceState, setSourceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTree(null); setTreeState("idle"); setActivePath(""); setSource(null); setSourceState("idle"); setQuery(""); setNearViewport(false);
  }, [repo.name]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !("IntersectionObserver" in window)) { setNearViewport(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [repo.name]);

  useEffect(() => {
    if (!nearViewport || !meta.sourceExplorer.enabled) return;
    let live = true;
    const controller = new AbortController();
    setTreeState("loading");
    fetch(`/api/github/tree/${encodeURIComponent(repo.name)}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("tree"); return response.json(); })
      .then((payload: SourceTreePayload) => { if (!live) return; setTree(payload); setTreeState("ready"); })
      .catch(error => {
        if (!live || error instanceof DOMException && error.name === "AbortError") return;
        setTreeState("error");
        notify(`Source tree for ${repo.name} is temporarily unavailable.`, "warning", 4200);
      });
    return () => { live = false; controller.abort(); };
  }, [nearViewport, meta.sourceExplorer.enabled, repo.name]);

  const files = useMemo(() => tree?.files || [], [tree]);
  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? files.filter(file => file.path.toLowerCase().includes(needle) || file.language.toLowerCase().includes(needle)) : files;
  }, [files, query]);
  const sourceTree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  const openFile = async (file: SourceTreeFile) => {
    if (activePath === file.path && source) return;
    setActivePath(file.path); setSourceState("loading"); setSource(null);
    try {
      const response = await fetch(`/api/github/file/${encodeURIComponent(repo.name)}?path=${encodeURIComponent(file.path)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Source file could not be loaded."));
      setSource(payload as SourceFilePayload); setSourceState("ready");
    } catch (error) {
      setSourceState("error"); notify(error instanceof Error ? error.message : "Source file could not be loaded.", "error", 4400);
    }
  };

  const openEntryPoint = (entry: string) => {
    const clean = entry.replace(/\/$/, "");
    const match = files.find(file => file.path === clean) || files.find(file => file.path.startsWith(`${clean}/`));
    if (match) void openFile(match);
    else { setQuery(clean); notify(`Filtered the source tree to ${entry}.`, "info"); }
  };

  const copySource = async () => {
    if (!source) return;
    try { await navigator.clipboard.writeText(source.content); notify(`${source.name} copied to clipboard.`, "success"); }
    catch { notify("Clipboard permission was blocked by the browser.", "error"); }
  };

  if (!meta.sourceExplorer.enabled) return null;
  return <section ref={rootRef} id={`source-${repo.name}`} className="source-explorer" aria-labelledby={`source-title-${repo.id}`}>
    <div className="advanced-section-head"><div><p className="eyebrow">PROJECT / SOURCE</p><h2 id={`source-title-${repo.id}`}>Explore the public code.</h2></div><span>{tree ? `${tree.files.length} previewable files · ${tree.branch}` : `up to ${meta.sourceExplorer.maxFileSizeKb} KB per file`}</span></div>
    {meta.sourceExplorer.entryPoints?.length ? <div className="source-entrypoints"><small>ENTRY POINTS</small><div>{meta.sourceExplorer.entryPoints.map(entry => <button type="button" key={entry} onClick={() => openEntryPoint(entry)}><Zap size={12} />{entry}</button>)}</div></div> : null}
    <div className="source-workbench">
      <aside className="source-sidebar">
        <header><GitBranch size={14} /><b>{repo.name}</b><small>{tree?.branch || meta.repository.defaultBranch}</small></header>
        <label><Search size={13} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter files…" aria-label={`Filter ${repo.name} source files`} /></label>
        <div className="source-tree">{treeState === "loading" ? <p className="source-state"><LoaderCircle className="spin" size={16} /> Loading repository tree…</p> : treeState === "error" ? <p className="source-state">Source tree unavailable.</p> : treeState === "ready" && filteredFiles.length ? <SourceTreeNode node={sourceTree} activePath={activePath} onOpen={openFile} /> : treeState === "ready" ? <p className="source-state">No previewable files match this filter.</p> : <p className="source-state">Source tree loads when this section approaches the viewport.</p>}</div>
      </aside>
      <div className="source-editor">
        <header><div><FileCode2 size={14} /><span>{source?.path || "Select a source file"}</span></div>{source && <div><button onClick={() => { void copySource(); }}><Copy size={13} /> Copy</button><a href={source.html_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> GitHub</a></div>}</header>
        <div className="source-editor-body">{sourceState === "loading" ? <div className="source-empty"><LoaderCircle className="spin" size={20} /><span>Loading source file…</span></div> : sourceState === "error" ? <div className="source-empty"><FileCode2 size={22} /><span>Unable to render this source file.</span></div> : source ? <div className={`source-code language-${source.language}`}>{source.content.split(/\r?\n/).map((line, index) => <SourceLine key={index} line={line} language={source.language} number={index + 1} />)}</div> : <div className="source-empty"><FileCode2 size={24} /><b>Repository source explorer</b><span>Select a file from the tree to inspect it without leaving osameh.dev.</span></div>}</div>
        {source && <footer><span>{source.language}</span><span>{Math.max(1, Math.round(source.size / 1024))} KB</span><span>{source.content.split(/\r?\n/).length} lines</span></footer>}
      </div>
    </div>
    {tree?.truncated && <p className="source-truncated"><ShieldCheck size={14} /> GitHub marked this repository tree as truncated; the explorer shows the available previewable subset.</p>}
  </section>;
}

export function ProjectQuickAccess({ repo }: { repo: RepoLike }) {
  const items = useMemo(() => [
    { id: `overview-${repo.name}`, label: "Overview", short: "OV", icon: <LayoutGrid size={15} /> },
    { id: `readme-${repo.name}`, label: "README", short: "RD", icon: <FileCode2 size={15} /> },
    { id: `metadata-${repo.name}`, label: "Metadata", short: "MD", icon: <Package size={15} /> },
    { id: `metrics-${repo.name}`, label: "Metrics", short: "MX", icon: <Star size={15} /> },
    { id: `case-study-${repo.name}`, label: "Case study", short: "CS", icon: <BriefcaseBusiness size={15} /> },
    { id: `architecture-${repo.name}`, label: "Architecture", short: "AR", icon: <GitBranch size={15} /> },
    { id: `source-${repo.name}`, label: "Source", short: "SC", icon: <Code2 size={15} /> },
    { id: `gallery-${repo.name}`, label: "Gallery", short: "GL", icon: <Sparkles size={15} /> },
  ], [repo.name]);
  const [active, setActive] = useState(items[0]?.id || "");

  useEffect(() => {
    const elements = items.map(item => document.getElementById(item.id)).filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - 150) - Math.abs(b.boundingClientRect.top - 150));
      if (visible[0]?.target.id) setActive(visible[0].target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, .05, .2] });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <nav className="project-quick-access" aria-label={`${repo.name} project quick access`}>
    <div className="project-quick-access-rail" />
    {items.map(item => <button key={item.id} type="button" className={active === item.id ? "active" : ""} onClick={() => jump(item.id)} aria-label={`Jump to ${item.label}`} aria-current={active === item.id ? "location" : undefined}>
      <span className="project-quick-icon">{item.icon}</span>
      <span className="project-quick-short">{item.short}</span>
      <span className="project-quick-label">{item.label}</span>
    </button>)}
  </nav>;
}

export function FeaturedProjects({ repos, metadata, onOpen, onRecruiterMode }: { repos: RepoLike[]; metadata: RepoMetadataMap; onOpen: (repo: RepoLike) => void; onRecruiterMode: () => void }) {
  const featured = repos
    .map(repo => ({ repo, meta: metadata[repo.name] }))
    .filter(item => item.meta?.project.featured)
    .sort((a, b) => (a.meta?.project.featuredOrder ?? 999) - (b.meta?.project.featuredOrder ?? 999))
    .slice(0, 6);
  if (!featured.length) return null;
  return <section className="featured-projects" aria-label="Featured projects">
    <header><div><Sparkles size={16} /><span>FEATURED / RECRUITER SHORTLIST</span></div><button type="button" onClick={onRecruiterMode}>Start recruiter mode <ArrowUpRight size={14} /></button></header>
    <div className="featured-project-grid">{featured.map(({ repo, meta }, index) => <button type="button" key={repo.name} data-project-name={repo.name} onClick={() => onOpen(repo)}><span className="featured-index">0{index + 1}</span><div><small>{meta?.project.type}</small><h3>{meta?.project.name || repo.name}</h3><p>{meta?.recruiter.headline || repo.description}</p><div>{meta?.recruiter.skillsDemonstrated.slice(0, 4).map(skill => <span key={skill}>{skill}</span>)}</div></div><ArrowUpRight size={16} /></button>)}</div>
  </section>;
}

export function RecruiterMode({ open, repos, metadata, onClose, onOpenProject }: { open: boolean; repos: RepoLike[]; metadata: RepoMetadataMap; onClose: () => void; onOpenProject: (repo: RepoLike) => void }) {
  const featured = useMemo(() => repos
    .map(repo => ({ repo, meta: metadata[repo.name] || fallbackPortfolioMetadata(repo) }))
    .filter(item => item.meta.project.featured)
    .sort((a, b) => a.meta.project.featuredOrder - b.meta.project.featuredOrder)
    .slice(0, 5), [repos, metadata]);
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStep(value => Math.min(featured.length + 1, value + 1));
      if (event.key === "ArrowLeft") setStep(value => Math.max(0, value - 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, featured.length, onClose]);
  if (!open) return null;

  const total = featured.length + 2;
  const projectIndex = step - 1;
  const current = projectIndex >= 0 && projectIndex < featured.length ? featured[projectIndex] : null;
  return <div className="advanced-modal-backdrop recruiter-backdrop" onMouseDown={onClose}><section className="recruiter-mode" role="dialog" aria-modal="true" aria-label="Recruiter mode" onMouseDown={event => event.stopPropagation()}>
    <header><div><BriefcaseBusiness size={17} /><span>recruiter-mode.tour</span><small>~90 second engineering tour</small></div><button onClick={onClose} aria-label="Close recruiter mode"><X size={18} /></button></header>
    <div className="recruiter-progress"><span style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
    <main>{step === 0 ? <div className="recruiter-intro"><p className="eyebrow">RECRUITER MODE / START</p><h2>Software engineering, without the scavenger hunt.</h2><p>This guided view surfaces the strongest evidence across backend, full-stack, desktop, product engineering, security, and delivery. Every project remains backed by its public repository and repository-owned <code>portfolio.json</code>.</p><div className="recruiter-facts"><span><Code2 size={16} /><b>{repos.length}</b> public repositories</span><span><GitBranch size={16} /><b>GitHub</b> live metadata</span><span><ShieldCheck size={16} /><b>CI/CD</b> production delivery</span></div></div> : current ? <div className="recruiter-project"><div className="recruiter-project-top"><span>{String(projectIndex + 1).padStart(2, "0")} / {String(featured.length).padStart(2, "0")}</span><small>{current.meta.project.type}</small></div><h2>{current.meta.project.name}</h2><p className="recruiter-headline">{current.meta.recruiter.headline}</p><div className="recruiter-skill-list">{current.meta.recruiter.skillsDemonstrated.map(skill => <span key={skill}>{skill}</span>)}</div><div className="recruiter-talking-points">{current.meta.recruiter.talkingPoints.map(point => <p key={point}><Circle size={14} />{point}</p>)}</div><div className="recruiter-role"><small>MY ROLE</small><b>{current.meta.ownership.role}</b><span>{current.meta.ownership.responsibilities.slice(0, 5).join(" · ")}</span></div><button className="primary-btn" onClick={() => { onClose(); onOpenProject(current.repo); }}>Open full project <ArrowUpRight size={15} /></button></div> : <div className="recruiter-outro"><p className="eyebrow">RECRUITER MODE / NEXT STEP</p><h2>Want the full picture?</h2><p>The resume covers professional history; individual project pages expose architecture, source, README, gallery, and case-study detail.</p><div><button className="primary-btn" onClick={() => { onClose(); window.dispatchEvent(new Event("portfolio:resume")); }}>Open resume</button><button className="secondary-btn" onClick={() => { onClose(); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }}>Contact me</button></div></div>}</main>
    <footer><button onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0}><ArrowLeft size={15} /> Previous</button><span>{step + 1} / {total}</span><button onClick={() => setStep(value => Math.min(total - 1, value + 1))} disabled={step >= total - 1}>Next <ArrowRight size={15} /></button></footer>
  </section></div>;
}
