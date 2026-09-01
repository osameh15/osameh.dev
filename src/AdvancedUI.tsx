import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowUpRight, Check, ChevronDown, ChevronUp, Code2, Download, ExternalLink, FileText, GitBranch, HardDrive, Keyboard, Laptop, LoaderCircle, Mail, MonitorCheck, PackageCheck, RefreshCw, Send, Share2, ShieldCheck, Sparkles, Terminal, Wifi, WifiOff, X } from "lucide-react";
import { BUILD_ID, BUILD_TIME, BUILD_VERSION } from "./generated/build";
import { notify } from "./toast";
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
      .catch(() => {
        if (!live) return;
        setState("error");
        notify("GitHub activity is temporarily unavailable. Project data will keep using the cached fallback.", "warning", 4200);
      });
    return () => { live = false; };
  }, []);
  return <section id="activity" className="activity-feed section-pad">
    <div className="section-heading"><span>04</span><div><p>GITHUB.ACTIVITY</p><h2>Recent repository activity.</h2></div><a href="https://github.com/osameh15" target="_blank" rel="noreferrer" className="section-link">Open GitHub <ArrowUpRight size={15} /></a></div>
    {state === "loading" ? <div className="repo-status"><LoaderCircle className="spin" size={18} /> Reading public activity…</div> : state === "error" ? <div className="muted-card"><GitBranch size={18} /> Recent activity is temporarily unavailable.</div> : <div className="activity-timeline">
      {items.length ? items.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><span className="activity-node"><GitBranch size={14} /></span><div><b>{item.repo}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("en", { month: "short", day: "numeric", year: "numeric" })}</small></div><ExternalLink size={14} /></a>) : <p className="muted-card">No public repository activity in the last 30 days.</p>}
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
  const initialVisible = 5;
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(changelog[0]?.version || "");
  const visibleItems = expanded ? changelog : changelog.slice(0, initialVisible);
  const hiddenCount = Math.max(0, changelog.length - initialVisible);

  useEffect(() => {
    if (!visibleItems.length) return;
    if (!visibleItems.some(item => item.version === selectedVersion)) setSelectedVersion(visibleItems[0].version);
  }, [visibleItems, selectedVersion]);

  const selected = visibleItems.find(item => item.version === selectedVersion) || visibleItems[0];
  const selectedIndex = selected ? changelog.findIndex(item => item.version === selected.version) : 0;

  return <section id="changelog" className="changelog-section section-pad">
    <div className="section-heading"><span>06</span><div><p>CHANGELOG.MD</p><h2>This portfolio ships like software.</h2></div></div>
    <div className="changelog-graph-shell">
      <div className="changelog-graph-intro">
        <div>
          <p className="eyebrow">RELEASE GRAPH / LIVE HISTORY</p>
          <h3>Scan the latest releases, then drill into the exact version you want.</h3>
        </div>
        <p>The newest five releases stay visible by default so the first screen remains focused. Hover, focus, or click any node to inspect its version and shipped changes in the detail panel.</p>
      </div>
      <div className="changelog-graph-layout">
        <div className="changelog-graph-map" role="listbox" aria-label="Portfolio release graph">
          <div className="changelog-graph-line" aria-hidden="true" />
          {visibleItems.map((item, index) => {
            const isActive = selected?.version === item.version;
            return <button
              key={item.version}
              type="button"
              role="option"
              aria-selected={isActive}
              className={isActive ? "changelog-node active" : "changelog-node"}
              onMouseEnter={() => setSelectedVersion(item.version)}
              onFocus={() => setSelectedVersion(item.version)}
              onClick={() => setSelectedVersion(item.version)}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="changelog-node-axis" aria-hidden="true">
                <span className="changelog-node-point"><span /></span>
                <small>v{item.version}</small>
              </span>
              <span className="changelog-node-content">
                <small>{index === 0 ? "LATEST" : !expanded ? "RECENT" : index < initialVisible ? "RECENT" : "ARCHIVE"}</small>
                <strong>{item.title}</strong>
              </span>
            </button>;
          })}
          {!expanded && hiddenCount > 0 && <div className="changelog-node-pending"><span />+{hiddenCount} older releases</div>}
        </div>
        {selected && <aside className="changelog-graph-detail" aria-live="polite">
          <div className="changelog-graph-detail-head">
            <div>
              <p className="eyebrow">SELECTED RELEASE</p>
              <h3>{selected.title}</h3>
            </div>
            <code>v{selected.version}</code>
          </div>
          <p className="changelog-detail-meta">Release {String(selectedIndex + 1).padStart(2, "0")} of {String(changelog.length).padStart(2, "0")} · Hover a node in the graph to move through the portfolio’s shipping history.</p>
          <div className="changelog-detail-list">
            {selected.items.map((change, index) => <article key={change}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{change}</p>
            </article>)}
          </div>
        </aside>}
      </div>
      {hiddenCount > 0 && <div className="changelog-load-more">
        <div>
          <b>{expanded ? `Showing all ${changelog.length} releases.` : `Showing the latest ${initialVisible} of ${changelog.length} releases.`}</b>
          <span>{expanded ? "Collapse the older history if you want to return to the short release snapshot." : "Load the rest of the release history only when you want the deeper archive."}</span>
        </div>
        <button type="button" className={expanded ? "secondary-btn is-open" : "secondary-btn"} onClick={() => setExpanded(current => !current)}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expanded ? "Collapse older releases" : `Load ${hiddenCount} older releases`}
        </button>
      </div>}
    </div>
  </section>;
}

export function ResumeViewer({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange?.(next); };
  useEffect(() => {
    const listener = () => { changeOpen(true); trackEvent("resume_open"); };
    window.addEventListener("portfolio:resume", listener);
    return () => window.removeEventListener("portfolio:resume", listener);
  }, [onOpenChange]);
  useEffect(() => { if (!open) return; const close = (e: KeyboardEvent) => { if (e.key === "Escape") changeOpen(false); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={() => changeOpen(false)}><section className="advanced-modal resume-modal" role="dialog" aria-modal="true" aria-label="Resume viewer" onMouseDown={e => e.stopPropagation()}>
    <header><div><FileText size={17} /><span>resume.pdf</span></div><div className="resume-header-actions"><a href="/resume/Osameh_Irandoust_CV.pdf" target="_blank" rel="noreferrer" className="icon-text-btn"><ExternalLink size={14} /> Open PDF</a><a href="/resume/Osameh_Irandoust_CV.pdf" download className="icon-text-btn"><Download size={14} /> Download</a><button onClick={() => changeOpen(false)} aria-label="Close resume"><X size={17} /></button></div></header>
    <div className="resume-summary"><div><p className="eyebrow">CV / QUICK VIEW</p><h2>{resumeSummary.headline}</h2><p>{resumeSummary.profile}</p><small>{resumeSummary.education}</small></div><div className="resume-skill-cloud">{resumeSummary.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>
    <div className="resume-document">
      <article><small>PROFILE</small><p>{resumeSummary.profile}</p></article>
      <article><small>EDUCATION</small><p>{resumeSummary.education}</p></article>
      <article><small>LANGUAGES</small><p>{resumeSummary.languages.join(" · ")}</p></article>
      <article><small>FULL PDF</small><p>The complete PDF is packaged with the portfolio. Use the Open PDF or Download controls in the viewer header.</p></article>
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
      notify("Clipboard permission was blocked by the browser.", "error");
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
        <button className="secondary-btn" onClick={() => { setOpen(false); window.dispatchEvent(new Event("portfolio:diagnostics")); }}><MonitorCheck size={15} /> System Health</button>
      </div>
      <p className="build-info-tip"><code>version</code> prints the version in Terminal. <code>build</code> opens this panel.</p>
    </section>
  </div>;
}

type HealthCheck = { id: string; label: string; status: "operational" | "degraded" | "down"; latencyMs: number | null; detail: string };
type HealthPayload = { status: "operational" | "degraded"; generatedAt: string; build: { version: string; buildId: string; builtAt: string | null; environment: string }; checks: HealthCheck[] };

export function SystemDiagnostics() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [sw, setSw] = useState("Not registered");
  const [requestLatency, setRequestLatency] = useState<number | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  const refresh = async () => {
    setState("loading");
    const started = performance.now();
    try {
      const response = await fetch(`/api/health?ts=${Date.now()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("health");
      const payload = await response.json() as HealthPayload;
      const latency = Math.max(1, Math.round(performance.now() - started));
      setRequestLatency(latency);
      setLatencyHistory(current => [...current, latency].slice(-12));
      setHealth(payload);
      setState("ready");
      if (payload.status === "degraded") notify("System Health is reporting a degraded dependency.", "warning", 4200);
    } catch {
      const latency = Math.max(1, Math.round(performance.now() - started));
      setRequestLatency(latency);
      setLatencyHistory(current => [...current, latency].slice(-12));
      setState("error");
      notify("Live health diagnostics could not reach the origin endpoint.", "warning", 4200);
    }
  };

  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("portfolio:diagnostics", listener);
    return () => window.removeEventListener("portfolio:diagnostics", listener);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration()
      .then(reg => setSw(reg?.active ? "Active" : reg ? "Installing" : "Not registered"))
      .catch(() => setSw("Unavailable"));
  }, [open]);

  if (!open) return null;
  const browser = navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Edg/") ? "Edge" : navigator.userAgent.includes("Chrome") ? "Chromium" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser";
  const maxLatency = Math.max(1, ...latencyHistory);
  const overall = state === "error" ? "Unavailable" : state === "loading" && !health ? "Checking" : health?.status === "degraded" ? "Degraded" : "Operational";

  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="advanced-modal diagnostics-modal health-center-modal" role="dialog" aria-modal="true" aria-labelledby="health-center-title" onMouseDown={e => e.stopPropagation()}>
    <header><div><MonitorCheck size={17} /><span>system-health.json</span></div><div className="health-header-actions"><button onClick={() => void refresh()} disabled={state === "loading"} aria-label="Refresh system health"><RefreshCw className={state === "loading" ? "spin" : ""} size={16} /></button><button onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></div></header>
    <div className="health-hero">
      <div><p className="eyebrow">LIVE / SYSTEM HEALTH</p><h2 id="health-center-title">Production signals, without exposing internals.</h2><p>The browser measures the round trip to a same-origin health endpoint. The server checks only safe operational dependencies and never returns credentials, filesystem paths, raw IPs, or environment secrets.</p></div>
      <div className={`health-overall ${overall.toLowerCase()}`}><span><i />{overall}</span><strong>{requestLatency ? `${requestLatency} ms` : "—"}</strong><small>browser → origin</small></div>
    </div>
    <div className="health-latency-strip" aria-label="Recent health request latency">
      <div><small>RECENT ORIGIN LATENCY</small><b>{latencyHistory.length ? `${latencyHistory[latencyHistory.length - 1]} ms` : "collecting…"}</b></div>
      <div className="health-sparkline">{latencyHistory.length ? latencyHistory.map((value, index) => <i key={`${value}-${index}`} style={{ height: `${Math.max(12, Math.round((value / maxLatency) * 100))}%` }} title={`${value} ms`} />) : Array.from({ length: 8 }).map((_, index) => <i key={index} className="placeholder" />)}</div>
    </div>
    <div className="health-check-grid">
      {(health?.checks || []).map(item => <article key={item.id} className={`health-check ${item.status}`}><div><span className="health-dot" /><small>{item.label}</small></div><b>{item.status === "operational" ? "Operational" : item.status === "degraded" ? "Degraded" : "Down"}</b><p>{item.detail}</p><code>{item.latencyMs !== null ? `${Math.round(item.latencyMs)} ms` : "local check"}</code></article>)}
      {!health && state === "loading" && Array.from({ length: 6 }).map((_, index) => <article key={index} className="health-check health-skeleton"><span /><span /><span /></article>)}
      {state === "error" && <article className="health-check down"><div><span className="health-dot" /><small>Health endpoint</small></div><b>Unavailable</b><p>The local health endpoint did not return a valid response.</p><code>retry available</code></article>}
    </div>
    <div className="health-client-grid">
      <article>{navigator.onLine ? <Wifi size={18} /> : <WifiOff size={18} />}<small>CLIENT NETWORK</small><b>{navigator.onLine ? "Online" : "Offline"}</b><span>browser connectivity</span></article>
      <article><ShieldCheck size={18} /><small>SERVICE WORKER</small><b>{sw}</b><span>offline shell</span></article>
      <article><Laptop size={18} /><small>CLIENT</small><b>{browser}</b><span>{window.innerWidth}×{window.innerHeight} · {window.devicePixelRatio}x</span></article>
      <article><PackageCheck size={18} /><small>BUILD</small><b>v{health?.build.version || BUILD_VERSION}</b><span>{health?.build.environment || "production"}</span></article>
    </div>
    <p className="diagnostics-note">Generated {health?.generatedAt ? new Date(health.generatedAt).toLocaleTimeString() : "on refresh"}. Diagnostics are ephemeral and privacy-friendly.</p>
  </section></div>;
}

export function ShortcutGuide() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const listener = () => setOpen(true); window.addEventListener("portfolio:shortcuts", listener); return () => window.removeEventListener("portfolio:shortcuts", listener); }, []);
  if (!open) return null;
  const rows = [["Ctrl/Cmd + K", "Command Palette"], ["`", "Toggle terminal"], ["Tab", "Terminal autocomplete"], ["Shift + Tab", "Previous autocomplete suggestion"], ["G then P", "Projects"], ["G then A", "About"], ["G then E", "Experience"], ["G then N", "Now"], ["G then C", "Contact"], ["/", "Focus project search"], ["?", "Keyboard shortcuts"], ["Esc", "Close active modal/tab"]];
  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section className="advanced-modal shortcuts-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}><header><div><Keyboard size={17} /><span>keyboard-shortcuts.md</span></div><button onClick={() => setOpen(false)}><X size={17} /></button></header><div className="shortcut-grid">{rows.map(([keys, action]) => <div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}</div></section></div>;
}

export function PwaInstallControl() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const before = (event: Event) => { event.preventDefault(); setPrompt(event); };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      trackEvent("pwa_installed");
      notify("Portfolio app installed successfully.", "success");
    };
    const install = async () => {
      if (!prompt) {
        notify("Install is not available in this browser right now. You can still add the site from your browser menu.", "info", 4200);
        return;
      }
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted") {
          trackEvent("pwa_install_accept");
          notify("Install accepted. The app will be available from your device launcher.", "success");
        } else {
          notify("Install dismissed.", "info");
        }
      } catch {
        notify("The browser could not open the install prompt.", "error");
      } finally {
        setPrompt(null);
      }
    };
    window.addEventListener("beforeinstallprompt", before as EventListener);
    window.addEventListener("appinstalled", appInstalled);
    window.addEventListener("portfolio:install", install);
    return () => { window.removeEventListener("beforeinstallprompt", before as EventListener); window.removeEventListener("appinstalled", appInstalled); window.removeEventListener("portfolio:install", install); };
  }, [prompt]);
  if (installed || !prompt) return null;
  return <button className="pwa-install" onClick={() => window.dispatchEvent(new Event("portfolio:install"))}><Download size={14} /> Install app</button>;
}

export function ContactForm({ fileName = "send-message.ts" }: { fileName?: string }) {
  const [csrf, setCsrf] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [securityState, setSecurityState] = useState<"loading" | "ready" | "fallback">("loading");

  const loadCsrf = async () => {
    try {
      const response = await fetch("/api/contact", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("csrf-bootstrap");
      const data = await response.json();
      const token = String(data.csrf || "");
      setCsrf(token);
      setSecurityState(token ? "ready" : "fallback");
      return token;
    } catch {
      setSecurityState("fallback");
      return "";
    }
  };

  useEffect(() => { void loadCsrf(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const subject = String(form.get("subject") || "").trim();
    const bodyMessage = String(form.get("message") || "").trim();
    if (name.length < 2) { notify("Please enter your name.", "error"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notify("Please enter a valid email address.", "error"); return; }
    if (subject.length < 3) { notify("Please enter a subject with at least 3 characters.", "error"); return; }
    if (bodyMessage.length < 20) { notify("Please write a message with at least 20 characters.", "error"); return; }
    setState("sending");
    const token = csrf || await loadCsrf();
    const payload = {
      name,
      email,
      subject,
      message: bodyMessage,
      website: String(form.get("website") || ""),
      csrf: token,
    };
    try {
      const postMessage = async (body: typeof payload) => {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      };

      let result = await postMessage(payload);
      if (result.response.status === 419 && result.data.csrf) {
        const refreshed = String(result.data.csrf);
        setCsrf(refreshed);
        setSecurityState("ready");
        result = await postMessage({ ...payload, csrf: refreshed });
      }

      if (result.data.csrf) { setCsrf(String(result.data.csrf)); setSecurityState("ready"); }
      if (!result.response.ok || !result.data.success) throw new Error(result.data.message || "Message could not be sent.");
      setState("success");
      notify("Message sent successfully. I’ll get back to you as soon as I can.", "success", 4200);
      formElement.reset();
      trackEvent("contact_submit", payload.subject || "general");
    } catch (error) {
      setState("error");
      notify(error instanceof Error ? error.message : "Message could not be sent.", "error", 4800);
    }
  };

  const securityLabel = securityState === "ready"
    ? "same-origin · CSRF · honeypot · rate limited"
    : securityState === "loading"
      ? "preparing secure channel…"
      : "same-origin · origin checked · honeypot · rate limited";

  return <form className="contact-form" onSubmit={submit} noValidate>
    <div className="contact-form-head"><div><Mail size={17} /><span>{fileName}</span></div><small>{securityLabel}</small></div>
    <div className="contact-form-grid"><label>Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Email<input name="email" type="email" required maxLength={160} autoComplete="email" /></label></div>
    <label>Subject<input name="subject" required minLength={3} maxLength={120} /></label>
    <label>Message<textarea name="message" required minLength={20} maxLength={5000} rows={6} /></label>
    <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="contact-form-actions"><button type="submit" className="primary-btn" disabled={state === "sending"}>{state === "sending" ? <><LoaderCircle className="spin" size={16} /> Sending…</> : <><Send size={16} /> Send message</>}</button></div>
  </form>;
}

export function ProjectCompare({ repos, onClose }: { repos: RepoLike[]; onClose: () => void }) {
  if (repos.length !== 2) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={onClose}><section className="advanced-modal compare-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}><header><div><Code2 size={17} /><span>compare-projects.diff</span></div><button onClick={onClose}><X size={17} /></button></header><div className="compare-grid"><div className="compare-labels"><span>Project</span><span>Language</span><span>Stars</span><span>Forks</span><span>Last update</span><span>Topics</span><span>Summary</span></div>{repos.map(repo => <article key={repo.id}><h3>{repo.name}</h3><b>{repo.language || "Mixed"}</b><b>{repo.stargazers_count}</b><b>{repo.forks_count}</b><b>{new Date(repo.updated_at).toLocaleDateString()}</b><div className="compare-tags">{repo.topics.slice(0, 5).map(topic => <span key={topic}>{topic}</span>)}</div><p>{repo.description || "No public description."}</p></article>)}</div></section></div>;
}

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
