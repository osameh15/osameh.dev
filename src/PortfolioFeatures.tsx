import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Accessibility as AccessibilityIcon, ArrowUpRight, ChevronRight, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import availabilityData from "../config/availability.json";
import { useModalDialog } from "./modalScroll";
import { capabilities, caseStudies, type CaseStudy } from "./caseStudiesData";

export type AvailabilityStatus = "open" | "selective" | "freelance" | "focused" | "unavailable";
export type AccessibilityPreferences = {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  strongFocus: boolean;
};

type AvailabilityProfile = {
  label: string;
  shortLabel: string;
  description: string;
  ctaEnabled: boolean;
  tone: AvailabilityStatus;
};
type AvailabilityConfig = {
  activeStatus: AvailabilityStatus;
  timezone: string;
  opportunityTypes: string[];
  workModes: string[];
  email: string;
  profiles: Record<AvailabilityStatus, AvailabilityProfile>;
};

export const availabilityConfig = availabilityData as AvailabilityConfig;
export const availabilityProfile = availabilityConfig.profiles[availabilityConfig.activeStatus];

const dictionary = {
  availability: "Selective",
  availabilityShort: "Selective",
  availabilityTitle: "Availability",
  accessibility: "Accessibility",
  accessibilityTitle: "Accessibility Control Center",
  caseStudies: "Case Studies",
  caseStudiesTitle: "Freelance work, with the details that matter.",
  caseStudiesIntro: "Public client work is shown only when it can be verified. Additional case studies can be added here as more projects become publishable.",
  capabilitiesEyebrow: "WHAT I CAN BUILD",
  capabilitiesTitle: "Capability areas backed by production experience.",
  capabilitiesIntro: "These are not presented as named client case studies. They describe the kinds of systems I can design, build, modernize, and maintain.",
  liveSite: "Visit live site",
  confidential: "Anonymized",
  problem: "Problem",
  constraints: "Constraints",
  solution: "Solution",
  decisions: "Engineering decisions",
  outcomes: "Outcomes",
  lessons: "Lessons learned",
  stack: "Stack",
  role: "Role",
  timeline: "Timeline",
  close: "Close",
  reducedMotion: "Reduce motion",
  reducedMotionHelp: "Minimize parallax, smooth scrolling, and non-essential animation.",
  highContrast: "Increase contrast",
  highContrastHelp: "Strengthen text, borders, and interactive-state contrast.",
  largeText: "Larger interface text",
  largeTextHelp: "Increase the base UI scale without breaking the editor layout.",
  strongFocus: "Enhanced focus indicators",
  strongFocusHelp: "Make keyboard focus easier to locate across the workspace.",
  systemPreference: "System reduced-motion preference is respected automatically.",
  currentAvailability: "Current status",
  workModes: "Work modes",
  opportunities: "Opportunity types",
  timezone: "Timezone",
  contact: "Start a conversation",
  universalSearch: "Command Palette",
  universalSearchPlaceholder: "Search projects, notes, case studies, skills, experience, or commands…",
  navAbout: "about",
  navWork: "work",
  navExperience: "experience",
  navNow: "now",
  navNotes: "notes",
  navContact: "contact",
  navCaseStudies: "case studies",
  heroEyebrow: "SOFTWARE ENGINEER · BACKEND · FULL-STACK · SYSTEMS",
  heroTitleLead: "I build software",
  heroTitleTail: "that stays",
  heroTitleAccent: "solid.",
  heroCopy: "I’m Osameh Irandoust — a software engineer turning complex systems into clear, fast, dependable products. From C++ internals to modern web experiences.",
  exploreWork: "Explore my work",
  copyEmail: "Copy email",
  emailCopied: "Email copied",
  aboutTitle: "Engineering with range.",
  aboutP1: "I work comfortably across the stack — close to the metal in C++ and Qt, inside production backends with .NET, or crafting polished interfaces with Nuxt.",
  aboutP2: "My focus is always the same: understand the real problem, choose the right level of complexity, and ship work that people can trust.",
  productionYears: "4+ years in production",
  location: "Tehran, Iran",
  projectsTitle: "Everything I’m building.",
  projectsIntro: "A live view of public work enriched by repository-owned portfolio.json metadata. Archived repositories stay out of the way.",
  recruiterMode: "Recruiter mode",
  githubProfile: "GitHub profile",
  experienceTitle: "Built in the real world.",
  contactEyebrow: "READY FOR THE NEXT BUILD",
  contactTitleLead: "Have a difficult problem?",
  contactTitleAccent: "Let’s make it simple.",
  contactCopy: "Open to thoughtful engineering roles, ambitious products, and conversations about how software should work.",
  openCaseStudy: "Open case study",
  preferencesSaved: "Preferences save automatically",
  noResults: "No matching item found.",
} as const;

export type TranslationKey = keyof typeof dictionary;

type FeatureContextValue = {
  t: (key: TranslationKey) => string;
  accessibility: AccessibilityPreferences;
  setAccessibility: (value: AccessibilityPreferences | ((current: AccessibilityPreferences) => AccessibilityPreferences)) => void;
  accessibilityOpen: boolean;
  setAccessibilityOpen: (open: boolean) => void;
  availabilityOpen: boolean;
  setAvailabilityOpen: (open: boolean) => void;
};

const defaultAccessibility: AccessibilityPreferences = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  strongFocus: false,
};

const FeatureContext = createContext<FeatureContextValue | null>(null);

export function FeaturePreferencesProvider({ children }: { children: ReactNode }) {
  const [accessibility, setAccessibilityState] = useState<AccessibilityPreferences>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("portfolio-accessibility") || "null");
      return stored && typeof stored === "object" ? { ...defaultAccessibility, ...stored } : defaultAccessibility;
    } catch {
      return defaultAccessibility;
    }
  });
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = "en";
    root.dir = "ltr";
    delete root.dataset.locale;
    root.dataset.availabilityMood = availabilityConfig.activeStatus;
    try { localStorage.removeItem("portfolio-locale"); } catch { /* storage can be unavailable */ }

    const isDetailRoute = /^\/(?:projects|notes|case-studies)\/[^/]+\/?$/.test(window.location.pathname);
    if (!isDetailRoute) {
      document.title = "Osameh Irandoust — Software Engineer";
      const description = "Osameh Irandoust's software engineering portfolio: projects, case studies, engineering notes, and experience across backend, full-stack, and systems work.";
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description);
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", description);
      document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.setAttribute("content", "en_US");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduceMotion = accessibility.reduceMotion ? "true" : "false";
    root.dataset.highContrast = accessibility.highContrast ? "true" : "false";
    root.dataset.largeText = accessibility.largeText ? "true" : "false";
    root.dataset.strongFocus = accessibility.strongFocus ? "true" : "false";
    localStorage.setItem("portfolio-accessibility", JSON.stringify(accessibility));
  }, [accessibility]);

  const value = useMemo<FeatureContextValue>(() => ({
    t: key => dictionary[key],
    accessibility,
    setAccessibility: setAccessibilityState,
    accessibilityOpen,
    setAccessibilityOpen,
    availabilityOpen,
    setAvailabilityOpen,
  }), [accessibility, accessibilityOpen, availabilityOpen]);

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}

export function usePortfolioFeatures() {
  const context = useContext(FeatureContext);
  if (!context) throw new Error("usePortfolioFeatures must be used inside FeaturePreferencesProvider");
  return context;
}

export function AccessibilityControlButton() {
  const { setAccessibilityOpen, t } = usePortfolioFeatures();
  return <button type="button" className="feature-icon-button" aria-label={t("accessibility")} title={t("accessibility")} onClick={() => setAccessibilityOpen(true)}><AccessibilityIcon size={16} aria-hidden="true" /></button>;
}

export function AvailabilityBadge() {
  const { setAvailabilityOpen, t } = usePortfolioFeatures();
  const status = availabilityConfig.activeStatus;
  const profile = availabilityConfig.profiles[status];
  return <button type="button" className={`availability availability-button availability-${status}`} data-mood={status} title={profile.label} onClick={() => setAvailabilityOpen(true)} aria-label={`${t("availabilityTitle")}: ${profile.label}`}><i aria-hidden="true" /> <span>{profile.label}</span></button>;
}


function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: () => void; label: string; help: string }) {
  return <button type="button" className="accessibility-toggle" role="switch" aria-checked={checked} onClick={onChange}>
    <span><b>{label}</b><small>{help}</small></span><i className={checked ? "active" : ""} aria-hidden="true" />
  </button>;
}

export function PortfolioFeatureModals() {
  const { accessibility, setAccessibility, accessibilityOpen, setAccessibilityOpen, availabilityOpen, setAvailabilityOpen, t } = usePortfolioFeatures();
  const availabilityStatus = availabilityConfig.activeStatus;
  const activeAvailability = availabilityConfig.profiles[availabilityStatus];
  const activeAccessibilityCount = Object.values(accessibility).filter(Boolean).length;
  const resetAccessibility = () => setAccessibility(defaultAccessibility);
  const accessibilityDialogRef = useModalDialog<HTMLElement>(accessibilityOpen, () => setAccessibilityOpen(false));
  const availabilityDialogRef = useModalDialog<HTMLElement>(availabilityOpen, () => setAvailabilityOpen(false));
  return <>
    {accessibilityOpen && <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setAccessibilityOpen(false)}>
      <section ref={accessibilityDialogRef} tabIndex={-1} className="feature-modal accessibility-center" role="dialog" aria-modal="true" aria-labelledby="accessibility-title" onMouseDown={event => event.stopPropagation()}>
        <header><span><AccessibilityIcon size={16} /> <b id="accessibility-title">{t("accessibilityTitle")}</b></span><button type="button" autoFocus onClick={() => setAccessibilityOpen(false)} aria-label={t("close")}><X size={17} /></button></header>
        <div className="feature-modal-body modal-scroll-viewport">
          <div className="modal-content">
            <div className="accessibility-summary"><div><small>LIVE ACCESSIBILITY PROFILE</small><strong>{activeAccessibilityCount ? `${activeAccessibilityCount} preference${activeAccessibilityCount === 1 ? "" : "s"} active` : "Default interface"}</strong><p>Every switch updates the portfolio immediately and persists on this device.</p></div>{activeAccessibilityCount > 0 && <button type="button" className="accessibility-reset" onClick={resetAccessibility}><RotateCcw size={13} /> Reset</button>}</div>
            <Toggle checked={accessibility.reduceMotion} onChange={() => setAccessibility(current => ({ ...current, reduceMotion: !current.reduceMotion }))} label={t("reducedMotion")} help={t("reducedMotionHelp")} />
            <Toggle checked={accessibility.highContrast} onChange={() => setAccessibility(current => ({ ...current, highContrast: !current.highContrast }))} label={t("highContrast")} help={t("highContrastHelp")} />
            <Toggle checked={accessibility.largeText} onChange={() => setAccessibility(current => ({ ...current, largeText: !current.largeText }))} label={t("largeText")} help={t("largeTextHelp")} />
            <Toggle checked={accessibility.strongFocus} onChange={() => setAccessibility(current => ({ ...current, strongFocus: !current.strongFocus }))} label={t("strongFocus")} help={t("strongFocusHelp")} />
            <div className="accessibility-live-preview" aria-label="Accessibility live preview">
              <span className="accessibility-preview-dot" aria-hidden="true" />
              <div><small>LIVE PREVIEW</small><b>Readable interface sample</b><p>Text scale, contrast, focus and motion preferences apply immediately across the portfolio.</p><button type="button">Keyboard focus sample</button></div>
            </div>
            <p className="feature-modal-note"><ShieldCheck size={14} /> {t("systemPreference")}</p>
          </div>
        </div>
      </section>
    </div>}
    {availabilityOpen && <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setAvailabilityOpen(false)}>
      <section ref={availabilityDialogRef} tabIndex={-1} className="feature-modal availability-modal" role="dialog" aria-modal="true" aria-labelledby="availability-title" onMouseDown={event => event.stopPropagation()}>
        <header><span><ShieldCheck size={16} /> <b id="availability-title">{t("availabilityTitle")}</b></span><button type="button" autoFocus onClick={() => setAvailabilityOpen(false)} aria-label={t("close")}><X size={17} /></button></header>
        <div className="feature-modal-body modal-scroll-viewport">
          <div className="modal-content">
            <div className={`availability-status-card availability-${availabilityStatus}`}><i /><div><small>PORTFOLIO MOOD · {availabilityStatus.toUpperCase()}</small><strong>{activeAvailability.label}</strong><p>{activeAvailability.description}</p></div></div>
            <dl className="availability-details"><div><dt>{t("opportunities")}</dt><dd>{availabilityConfig.opportunityTypes.join(" · ")}</dd></div><div><dt>{t("workModes")}</dt><dd>{availabilityConfig.workModes.join(" · ")}</dd></div><div><dt>{t("timezone")}</dt><dd dir="ltr">{availabilityConfig.timezone}</dd></div></dl>
            {activeAvailability.ctaEnabled ? <a href={`mailto:${availabilityConfig.email}`} className="primary-btn availability-cta">{t("contact")} <ChevronRight size={15} /></a> : <p className="availability-unavailable-note">New opportunities are paused. You can still explore the work and reconnect later.</p>}
          </div>
        </div>
      </section>
    </div>}
  </>;
}

export function CaseStudiesSection({ onOpen }: { onOpen: (study: CaseStudy) => void }) {
  const { t } = usePortfolioFeatures();
  return <section id="case-studies" className="case-studies section-pad" aria-labelledby="case-studies-title">
    <div className="section-heading"><span>03</span><div><p>CASE.STUDIES</p><h2 id="case-studies-title">{t("caseStudiesTitle")}</h2></div></div>
    <p className="case-studies-intro">{t("caseStudiesIntro")}</p>

    <div className="published-case-studies">
      <div className="published-case-studies-heading"><p>PUBLIC CLIENT WORK</p><h3>Published case studies.</h3></div>
      <div className="client-case-study-grid">{caseStudies.map((study, index) => <article className="case-study-card" key={study.id} data-case-study-id={study.id}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><small>{study.privacy === "anonymized" ? t("confidential") : study.client}</small></header>
        <p className="case-study-type">{study.industry} · {study.projectType}</p><h3>{study.title}</h3><p>{study.summary}</p>
        <div className="case-study-stack">{study.stack.slice(0, 5).map(item => <span key={item}>{item}</span>)}</div>
        <div className="case-study-actions"><button type="button" onClick={() => onOpen(study)}>{t("openCaseStudy")} <ChevronRight size={14} /></button>{study.siteUrl && <a href={study.siteUrl} target="_blank" rel="noreferrer">{t("liveSite")} <ArrowUpRight size={13} /></a>}</div>
      </article>)}</div>
    </div>

    <div className="capabilities-block" aria-labelledby="capabilities-title">
      <div className="capabilities-heading"><p>{t("capabilitiesEyebrow")}</p><h3 id="capabilities-title">{t("capabilitiesTitle")}</h3><span>{t("capabilitiesIntro")}</span></div>
      <div className="capability-grid">{capabilities.map((capability, index) => <article className="capability-card" key={capability.id}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><small>CAPABILITY</small></header>
        <h4>{capability.title}</h4><p>{capability.summary}</p>
        <div className="capability-focus">{capability.focus.map(item => <span key={item}>{item}</span>)}</div>
        <div className="capability-tech">{capability.technologies.slice(0, 7).map(item => <code key={item}>{item}</code>)}</div>
      </article>)}</div>
    </div>
  </section>;
}

export function CaseStudyModal({ study, onClose, restorePosition }: { study: CaseStudy | null; onClose: () => void; restorePosition?: { x: number; y: number } }) {
  const { t } = usePortfolioFeatures();
  const dialogRef = useModalDialog<HTMLElement>(Boolean(study), onClose, restorePosition);
  if (!study) return null;
  return <div className="feature-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} tabIndex={-1} className="feature-modal case-study-modal" data-case-study-id={study.id} role="dialog" aria-modal="true" aria-labelledby="case-study-title" onMouseDown={event => event.stopPropagation()}>
      <header><span><Search size={16} /><b dir="ltr">case-study/{study.id}.md</b></span><button type="button" autoFocus onClick={onClose} aria-label={t("close")}><X size={17} /></button></header>
      <div className="feature-modal-body case-study-detail modal-scroll-viewport">
        <div className="modal-content">
          <div className="case-study-detail-hero"><p>{study.industry} · {study.projectType}</p><h2 id="case-study-title">{study.title}</h2><span>{study.client} · {study.role}</span>{study.siteUrl && <a className="case-study-live-link" href={study.siteUrl} target="_blank" rel="noreferrer">{t("liveSite")} <ArrowUpRight size={14} /></a>}</div>
          <div className="case-study-facts"><span><b>{t("role")}</b>{study.role}</span><span><b>{t("timeline")}</b>{study.timeline}</span><span><b>{t("stack")}</b>{study.stack.join(" · ")}</span></div>
          <section><h3>{t("problem")}</h3><p>{study.problem}</p></section>
          <section><h3>{t("constraints")}</h3><ul>{study.constraints.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section><h3>{t("solution")}</h3><ul>{study.solution.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section><h3>{t("decisions")}</h3><ul>{study.decisions.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section><h3>{t("outcomes")}</h3><ul>{study.outcomes.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section><h3>{t("lessons")}</h3><ul>{study.lessons.map(item => <li key={item}>{item}</li>)}</ul></section>
        </div>
      </div>
    </section>
  </div>;
}

export { capabilities, caseStudies };
