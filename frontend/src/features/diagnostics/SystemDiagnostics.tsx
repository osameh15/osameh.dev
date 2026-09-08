// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { Laptop, MonitorCheck, PackageCheck, RefreshCw, ShieldCheck, Wifi, WifiOff, X } from "lucide-react";
import { BUILD_ID, BUILD_VERSION } from "../../generated/build";
import { useModalDialog } from "../../lib/modalScroll";
import { formatReleaseLabel } from "../../lib/releaseMetadata";
import { notify } from "../../lib/toast";

type HealthCheck = { id: string; label: string; status: "operational" | "degraded" | "down"; latencyMs: number | null; detail: string };

type HealthPayload = { status: "operational" | "degraded"; generatedAt: string; build: { version: string; buildId: string; builtAt: string | null; environment: string }; checks: HealthCheck[] };

export function SystemDiagnostics() {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog<HTMLElement>(open, () => setOpen(false));
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

  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section ref={dialogRef} tabIndex={-1} className="advanced-modal diagnostics-modal health-center-modal" role="dialog" aria-modal="true" aria-labelledby="health-center-title" onMouseDown={e => e.stopPropagation()}>
    <header><div><MonitorCheck size={17} /><span>system-health.json</span></div><div className="health-header-actions"><button onClick={() => void refresh()} disabled={state === "loading"} aria-label="Refresh system health"><RefreshCw className={state === "loading" ? "spin" : ""} size={16} /></button><button onClick={() => setOpen(false)} aria-label="Close"><X size={17} /></button></div></header>
    <div className="modal-scroll-viewport">
      <div className="modal-content">
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
          <article><PackageCheck size={18} /><small>BUILD</small><b>{formatReleaseLabel(health?.build.version || BUILD_VERSION)}</b><span>{health?.build.environment || "resolving…"}</span></article>
        </div>
        <p className="diagnostics-note">Generated {health?.generatedAt ? new Date(health.generatedAt).toLocaleTimeString() : "on refresh"}. Diagnostics are ephemeral and privacy-friendly.</p>
      </div>
    </div>
  </section></div>;
}
