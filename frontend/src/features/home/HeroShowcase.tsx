// The home hero: brand mark, animated metrics and the engineering showcase.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Circle, GitBranch as Github, ServerCog, Star, Zap } from "lucide-react";
import { codeProfiles, type CodeLanguage } from "../../app/workspacePreferences";

export function BrandMark() {
  // Neural Cipher brand mark. The anchor that wraps this carries the accessible
  // name, so the image itself is decorative and must not be announced twice.
  return <div className="brand-mark">
    <img
      src="/icons/icon-32x32.png"
      srcSet="/icons/icon-32x32.png 1x, /icons/icon-64x64.png 2x"
      width={32}
      height={32}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  </div>;
}

export function AnimatedHeroMetric({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
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

export const heroStackByLanguage: Record<CodeLanguage, string[]> = {
  typescript: ["TypeScript", "React", "Vite", "Nuxt", "Node.js", "GitHub Actions"],
  cpp: ["C++", "Qt / QML", "CMake", "Linux", "PostgreSQL", "Systems"],
  csharp: [".NET", "ASP.NET", "WPF", "EF Core", "PostgreSQL", "Docker"],
  java: ["Java", "Android", "REST APIs", "MySQL", "Gradle", "Linux"],
  go: ["Go", "REST APIs", "PostgreSQL", "Docker", "Linux", "Observability"],
  python: ["Python", "Automation", "FastAPI", "PostgreSQL", "Linux", "AI workflows"],
  php: ["PHP", "Laravel", "MySQL", "WordPress", "REST APIs", "Linux"],
};

export function HeroShowcase({ codeLanguage, repoCount }: { codeLanguage: CodeLanguage; repoCount: number }) {
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
        <h2>Systems thinking with product-level polish.</h2>
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
