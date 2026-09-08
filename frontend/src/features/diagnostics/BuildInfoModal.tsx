// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { Check, MonitorCheck, PackageCheck, X } from "lucide-react";
import { BUILD_CODENAME, BUILD_ID, BUILD_TIME, BUILD_VERSION } from "../../generated/build";
import { RELEASE_THEME, formatReleaseLabel } from "../../lib/releaseMetadata";
import { useModalDialog } from "../../lib/modalScroll";
import { notify } from "../../lib/toast";
import { trackEvent } from "../../lib/analytics";

export function BuildInfoModal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Runtime environment is unknown until /build-info.json answers. It must never
  // default to a guess: the same JS bundle ships to staging and production, so a
  // fallback would let staging assert "PRODUCTION BUILD" while the request is in
  // flight or after it fails.
  const [buildEnvironment, setBuildEnvironment] = useState<"staging" | "production" | null>(null);
  const [buildEnvironmentState, setBuildEnvironmentState] = useState<"loading" | "ready" | "unavailable">("loading");
  const dialogRef = useModalDialog<HTMLElement>(open, () => setOpen(false));

  useEffect(() => {
    const listener = () => {
      setOpen(true);
      trackEvent("build_info_open", BUILD_ID);
    };
    window.addEventListener("portfolio:build", listener);
    return () => window.removeEventListener("portfolio:build", listener);
  }, []);

  // The environment cannot be baked into the JS bundle: one indexable bundle is
  // built and the staging/production bundles are derived from it afterwards, so
  // the same JS ships to both. build-info.json is stamped per environment at
  // packaging time and is the only truthful source at runtime.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setBuildEnvironment(null);
    setBuildEnvironmentState("loading");
    fetch("/build-info.json", { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const environment = payload?.environment;
        if (environment === "staging" || environment === "production") {
          setBuildEnvironment(environment);
          setBuildEnvironmentState("ready");
        } else {
          setBuildEnvironmentState("unavailable");
        }
      })
      .catch(error => { if (!controller.signal.aborted) setBuildEnvironmentState("unavailable"); void error; });
    return () => controller.abort();
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
    <section ref={dialogRef} tabIndex={-1} className="advanced-modal build-info-modal" role="dialog" aria-modal="true" aria-labelledby="build-info-title" onMouseDown={event => event.stopPropagation()}>
      <header>
        <div><PackageCheck size={17} /><span>build-info.json</span></div>
        <button onClick={() => setOpen(false)} aria-label="Close build information"><X size={17} /></button>
      </header>
      <div className="modal-scroll-viewport">
        <div className="modal-content">
          <div className="build-info-hero">
            <span className="build-info-badge" data-environment-state={buildEnvironmentState}>{buildEnvironment ? `${buildEnvironment.toUpperCase()} BUILD` : buildEnvironmentState === "loading" ? "RESOLVING BUILD…" : "BUILD"}</span>
            <h2 id="build-info-title">osameh.dev <code>{formatReleaseLabel(BUILD_VERSION)}</code></h2>
            <p>This is the exact build currently rendered by the browser. Use the build ID to confirm whether a CDN edge or browser cache is serving the latest deployment.</p>
          </div>
          <div className="build-info-grid">
            <article><small>VERSION</small><strong>{formatReleaseLabel(BUILD_VERSION)}</strong><span>semantic release</span></article>
            {BUILD_CODENAME && <article><small>CODENAME</small><strong>{BUILD_CODENAME}</strong><span>{RELEASE_THEME} release family</span></article>}
            <article><small>BUILD ID</small><strong className="build-info-id">{BUILD_ID}</strong><span>unique deployment fingerprint</span></article>
            <article><small>BUILT AT</small><strong>{new Date(BUILD_TIME).toLocaleString()}</strong><span>{BUILD_TIME}</span></article>
            <article><small>ENVIRONMENT</small><strong data-environment-state={buildEnvironmentState}>{buildEnvironment || (buildEnvironmentState === "loading" ? "resolving…" : "unavailable")}</strong><span>Vite · ParsPack CDN</span></article>
          </div>
          <div className="build-info-actions">
            <button className="primary-btn" onClick={() => { void copyBuildId(); }}><Check size={15} /> {copied ? "Build ID copied" : "Copy build ID"}</button>
            <button className="secondary-btn" onClick={() => { setOpen(false); window.dispatchEvent(new Event("portfolio:diagnostics")); }}><MonitorCheck size={15} /> System Health</button>
          </div>
          <p className="build-info-tip"><code>version</code> prints the version in Terminal. <code>build</code> opens this panel.</p>
        </div>
      </div>
    </section>
  </div>;
}
