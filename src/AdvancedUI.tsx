import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowUpRight, Check, Code2, Download, ExternalLink, FileText, GitBranch, HardDrive, Keyboard, Laptop, LoaderCircle, Mail, MonitorCheck, PackageCheck, RefreshCw, Send, Share2, ShieldCheck, Sparkles, Terminal, Wifi, WifiOff, X } from "lucide-react";
import { BUILD_ID, BUILD_TIME, BUILD_VERSION } from "./generated/build";
import { caseStudyFor, changelog, nowItems, resumeSummary, type RepoLike } from "./portfolioData";

export function trackEvent(event: string, label = "") {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, label: label.slice(0, 120), path: window.location.pathname });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function ProjectCaseStudy({ repo }: { repo: RepoLike }) {
  const study = useMemo(() => caseStudyFor(repo), [repo]);
  return <section className="case-study" aria-labelledby={`case-study-${repo.id}`}>
    <div className="advanced-section-head"><div><p className="eyebrow">PROJECT / CASE STUDY</p><h2 id={`case-study-${repo.id}`}>How it was engineered.</h2></div><span>Problem → decision → result</span></div>
    <div className="case-study-grid">
      <article><small>01 / PROBLEM</small><h3>The problem</h3><p>{study.problem}</p></article>
      <article><small>02 / SOLUTION</small><h3>The approach</h3><p>{study.solution}</p></article>
      <article><small>03 / ARCHITECTURE</small><h3>Architecture</h3><ul>{study.architecture.map(item => <li key={item}>{item}</li>)}</ul></article>
      <article><small>04 / CHALLENGES</small><h3>Engineering challenges</h3><ul>{study.challenges.map(item => <li key={item}>{item}</li>)}</ul></article>
      <article className="case-study-result"><small>05 / RESULT</small><h3>What shipped</h3><ul>{study.results.map(item => <li key={item}>{item}</li>)}</ul></article>
    </div>
  </section>;
}

type ActivityItem = { id: string; type: string; repo: string; message: string; created_at: string; url: string };
export function GithubActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let live = true;
    fetch("/api/github/activity", { headers: { Accept: "application/json" } })
      .then(response => { if (!response.ok) throw new Error("activity"); return response.json(); })
      .then(data => { if (live) { setItems(Array.isArray(data) ? data.slice(0, 8) : []); setState("ready"); } })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, []);
  return <section id="activity" className="activity-feed section-pad">
    <div className="section-heading"><span>04</span><div><p>GITHUB.ACTIVITY</p><h2>Recent public activity.</h2></div><a href="https://github.com/osameh15" target="_blank" rel="noreferrer" className="section-link">Open GitHub <ArrowUpRight size={15} /></a></div>
    {state === "loading" ? <div className="repo-status"><LoaderCircle className="spin" size={18} /> Reading public activity…</div> : state === "error" ? <div className="repo-status error"><GitBranch size={18} /> Activity is unavailable right now; projects still use cached data.</div> : <div className="activity-timeline">
      {items.length ? items.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><span className="activity-node"><GitBranch size={14} /></span><div><b>{item.repo}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("en", { month: "short", day: "numeric", year: "numeric" })}</small></div><ExternalLink size={14} /></a>) : <p className="muted-card">No recent public events returned by GitHub.</p>}
    </div>}
  </section>;
}

export function NowSection() {
  return <section id="now" className="now-section section-pad">
    <div className="section-heading"><span>05</span><div><p>NOW.MD</p><h2>What I’m focused on now.</h2></div></div>
    <div className="now-grid">{nowItems.map((item, index) => <article key={item.label}><span>{String(index + 1).padStart(2, "0")}</span><small>{item.label}</small><p>{item.value}</p></article>)}</div>
  </section>;
}

export function ChangelogSection() {
  return <section id="changelog" className="changelog-section section-pad">
    <div className="section-heading"><span>06</span><div><p>CHANGELOG.MD</p><h2>This portfolio ships like software.</h2></div></div>
    <div className="changelog-list">{changelog.map(item => <article key={item.version}><header><code>v{item.version}</code><h3>{item.title}</h3></header><ul>{item.items.map(change => <li key={change}>{change}</li>)}</ul></article>)}</div>
  </section>;
}

export function ResumeViewer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const listener = () => { setOpen(true); trackEvent("resume_open"); };
    window.addEventListener("portfolio:resume", listener);
    return () => window.removeEventListener("portfolio:resume", listener);
  }, []);
  useEffect(() => { if (!open) return; const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [open]);
  if (!open) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="advanced-modal resume-modal" role="dialog" aria-modal="true" aria-label="Resume viewer" onMouseDown={e => e.stopPropagation()}>
    <header><div><FileText size={17} /><span>resume.pdf</span></div><div><a href="/resume/Osameh_Irandoust_CV.pdf" download className="icon-text-btn"><Download size={14} /> Download</a><button onClick={() => setOpen(false)} aria-label="Close resume"><X size={17} /></button></div></header>
    <div className="resume-summary"><div><p className="eyebrow">CV / QUICK VIEW</p><h2>{resumeSummary.headline}</h2><p>{resumeSummary.profile}</p><small>{resumeSummary.education}</small></div><div className="resume-skill-cloud">{resumeSummary.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>
    <div className="resume-document">
      <article><small>PROFILE</small><p>{resumeSummary.profile}</p></article>
      <article><small>EDUCATION</small><p>{resumeSummary.education}</p></article>
      <article><small>LANGUAGES</small><p>{resumeSummary.languages.join(" · ")}</p></article>
      <article><small>FULL PDF</small><p>A downloadable CV is packaged with the portfolio. Open it in the browser's native PDF viewer for the complete resume.</p><a className="primary-btn" href="/resume/Osameh_Irandoust_CV.pdf" target="_blank" rel="noreferrer">Open PDF <ExternalLink size={15} /></a></article>
    </div>
  </section></div>;
}

export function BuildInfoModal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const listener = () => {
      setOpen(true);
      trackEvent("build_info_open", BUILD_ID);
    };
    window.addEventListener("portfolio:build", listener);
    return () => window.removeEventListener("portfolio:build", listener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  const copyBuildId = async () => {
    try {
      await navigator.clipboard.writeText(BUILD_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  if (!open) return null;

  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}>
    <section className="advanced-modal build-info-modal" role="dialog" aria-modal="true" aria-labelledby="build-info-title" onMouseDown={event => event.stopPropagation()}>
      <header>
        <div><PackageCheck size={17} /><span>build-info.json</span></div>
        <button onClick={() => setOpen(false)} aria-label="Close build information"><X size={17} /></button>
      </header>
      <div className="build-info-hero">
        <span className="build-info-badge">PRODUCTION BUILD</span>
        <h2 id="build-info-title">osameh.dev <code>v{BUILD_VERSION}</code></h2>
        <p>This is the exact build currently rendered by the browser. Use the build ID to confirm whether a CDN edge or browser cache is serving the latest deployment.</p>
      </div>
      <div className="build-info-grid">
        <article><small>VERSION</small><strong>v{BUILD_VERSION}</strong><span>semantic release</span></article>
        <article><small>BUILD ID</small><strong className="build-info-id">{BUILD_ID}</strong><span>unique deployment fingerprint</span></article>
        <article><small>BUILT AT</small><strong>{new Date(BUILD_TIME).toLocaleString()}</strong><span>{BUILD_TIME}</span></article>
        <article><small>ENVIRONMENT</small><strong>production</strong><span>Vite · ParsPack CDN</span></article>
      </div>
      <div className="build-info-actions">
        <button className="primary-btn" onClick={() => { void copyBuildId(); }}><Check size={15} /> {copied ? "Build ID copied" : "Copy build ID"}</button>
        <button className="secondary-btn" onClick={() => { setOpen(false); window.dispatchEvent(new Event("portfolio:diagnostics")); }}><MonitorCheck size={15} /> System diagnostics</button>
      </div>
      <p className="build-info-tip"><code>version</code> prints the version in Terminal. <code>build</code> opens this panel.</p>
    </section>
  </div>;
}

export function SystemDiagnostics() {
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<"checking" | "online" | "offline">("checking");
  const [sw, setSw] = useState("Not registered");
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("portfolio:diagnostics", listener);
    return () => window.removeEventListener("portfolio:diagnostics", listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    setApi("checking");
    fetch("/api/github/repos", { headers: { Accept: "application/json" } }).then(r => setApi(r.ok ? "online" : "offline")).catch(() => setApi("offline"));
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then(reg => setSw(reg?.active ? "Active" : reg ? "Installing" : "Not registered"));
  }, [open]);
  if (!open) return null;
  const browser = `${navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Edg/") ? "Edge" : navigator.userAgent.includes("Chrome") ? "Chromium" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser"}`;
  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="advanced-modal diagnostics-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
    <header><div><MonitorCheck size={17} /><span>system-info.json</span></div><button onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></header>
    <div className="diagnostics-grid">
      <article><PackageCheck size={18} /><small>Build</small><b>{BUILD_VERSION}</b><code>{BUILD_ID}</code></article>
      <article>{navigator.onLine ? <Wifi size={18} /> : <WifiOff size={18} />}<small>Network</small><b>{navigator.onLine ? "Online" : "Offline"}</b><code>{api === "checking" ? "checking API…" : `GitHub API ${api}`}</code></article>
      <article><ShieldCheck size={18} /><small>PWA</small><b>{sw}</b><code>offline shell enabled</code></article>
      <article><Laptop size={18} /><small>Client</small><b>{browser}</b><code>{window.innerWidth}x{window.innerHeight} · {window.devicePixelRatio}x</code></article>
      <article><Activity size={18} /><small>Theme</small><b>{document.documentElement.dataset.theme || "dark"}</b><code>{document.documentElement.dataset.font || "inter"}</code></article>
      <article><HardDrive size={18} /><small>Built</small><b>{new Date(BUILD_TIME).toLocaleDateString()}</b><code>{new Date(BUILD_TIME).toLocaleTimeString()}</code></article>
    </div>
    <p className="diagnostics-note">Diagnostics are computed locally. No fingerprint or device identifier is stored by the portfolio.</p>
  </section></div>;
}

export function ShortcutGuide() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const listener = () => setOpen(true); window.addEventListener("portfolio:shortcuts", listener); return () => window.removeEventListener("portfolio:shortcuts", listener); }, []);
  if (!open) return null;
  const rows = [["Ctrl/Cmd + K", "Command Palette"], ["`", "Toggle terminal"], ["G then P", "Projects"], ["G then A", "About"], ["G then E", "Experience"], ["G then N", "Now"], ["G then C", "Contact"], ["/", "Focus project search"], ["?", "Keyboard shortcuts"], ["Esc", "Close active modal/tab"]];
  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="advanced-modal shortcuts-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}><header><div><Keyboard size={17} /><span>keyboard-shortcuts.md</span></div><button onClick={() => setOpen(false)}><X size={17} /></button></header><div className="shortcut-grid">{rows.map(([keys, action]) => <div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}</div></section></div>;
}

export function PwaInstallControl() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const before = (event: Event) => { event.preventDefault(); setPrompt(event); };
    const appInstalled = () => { setInstalled(true); setPrompt(null); trackEvent("pwa_installed"); };
    const install = async () => {
      if (!prompt) return;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") trackEvent("pwa_install_accept");
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before as EventListener);
    window.addEventListener("appinstalled", appInstalled);
    window.addEventListener("portfolio:install", install);
    return () => { window.removeEventListener("beforeinstallprompt", before as EventListener); window.removeEventListener("appinstalled", appInstalled); window.removeEventListener("portfolio:install", install); };
  }, [prompt]);
  if (installed || !prompt) return null;
  return <button className="pwa-install" onClick={() => window.dispatchEvent(new Event("portfolio:install"))}><Download size={14} /> Install app</button>;
}

export function ContactForm() {
  const [csrf, setCsrf] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/contact", { credentials: "same-origin" }).then(r => r.json()).then(data => setCsrf(String(data.csrf || ""))).catch(() => undefined); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setState("sending"); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = { name: String(form.get("name") || ""), email: String(form.get("email") || ""), subject: String(form.get("subject") || ""), message: String(form.get("message") || ""), website: String(form.get("website") || ""), csrf };
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Message could not be sent.");
      setState("success"); setMessage("Message sent. I’ll get back to you as soon as I can."); formElement.reset(); trackEvent("contact_submit", payload.subject || "general");
      if (data.csrf) setCsrf(String(data.csrf));
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Message could not be sent."); }
  };
  return <form className="contact-form" onSubmit={submit}>
    <div className="contact-form-head"><div><Mail size={17} /><span>send-message.ts</span></div><small>same-origin · CSRF · honeypot · rate limited</small></div>
    <div className="contact-form-grid"><label>Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Email<input name="email" type="email" required maxLength={160} autoComplete="email" /></label></div>
    <label>Subject<input name="subject" required minLength={3} maxLength={120} /></label>
    <label>Message<textarea name="message" required minLength={20} maxLength={5000} rows={6} /></label>
    <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="contact-form-actions"><button className="primary-btn" disabled={state === "sending" || !csrf}>{state === "sending" ? <><LoaderCircle className="spin" size={16} /> Sending…</> : <><Send size={16} /> Send message</>}</button>{message && <p className={state === "success" ? "form-message success" : "form-message error"}>{state === "success" && <Check size={14} />}{message}</p>}</div>
  </form>;
}

export function ProjectCompare({ repos, onClose }: { repos: RepoLike[]; onClose: () => void }) {
  if (repos.length !== 2) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={onClose}><section className="advanced-modal compare-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}><header><div><Code2 size={17} /><span>compare-projects.diff</span></div><button onClick={onClose}><X size={17} /></button></header><div className="compare-grid"><div className="compare-labels"><span>Project</span><span>Language</span><span>Stars</span><span>Forks</span><span>Last update</span><span>Topics</span><span>Summary</span></div>{repos.map(repo => <article key={repo.id}><h3>{repo.name}</h3><b>{repo.language || "Mixed"}</b><b>{repo.stargazers_count}</b><b>{repo.forks_count}</b><b>{new Date(repo.updated_at).toLocaleDateString()}</b><div className="compare-tags">{repo.topics.slice(0, 5).map(topic => <span key={topic}>{topic}</span>)}</div><p>{repo.description || "No public description."}</p></article>)}</div></section></div>;
}

export async function shareProject(repo: RepoLike) {
  const url = `${window.location.origin}/projects/${encodeURIComponent(repo.name)}`;
  const data = { title: `${repo.name} - Osameh Irandoust`, text: repo.description || `Explore ${repo.name} on osameh.dev`, url };
  if (navigator.share) { try { await navigator.share(data); trackEvent("project_share", repo.name); return true; } catch { return false; } }
  try { await navigator.clipboard.writeText(url); trackEvent("project_share_copy", repo.name); return true; } catch { return false; }
}
