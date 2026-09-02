import { createContext, useContext, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Accessibility, Check, ChevronRight, Globe2, Languages, Search, ShieldCheck, X } from "lucide-react";
import { caseStudies, type CaseStudy } from "./caseStudiesData";

export type Locale = "en" | "fa";
export type AvailabilityStatus = "open-selective" | "freelance" | "limited" | "unavailable";
export type AccessibilityPreferences = {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  strongFocus: boolean;
};

const availabilityStatusLabels: Record<AvailabilityStatus, Record<Locale, string>> = {
  "open-selective": { en: "Open to selected opportunities", fa: "آماده بررسی فرصت‌های منتخب" },
  freelance: { en: "Available for selected freelance work", fa: "آماده همکاری فریلنس منتخب" },
  limited: { en: "Limited availability", fa: "ظرفیت همکاری محدود" },
  unavailable: { en: "Not currently available", fa: "در حال حاضر آماده همکاری نیستم" },
};

export const availabilityConfig = {
  status: "open-selective" as AvailabilityStatus,
  timezone: "Asia/Tehran (UTC+3:30)",
  opportunityTypes: {
    en: ["Senior software engineering", "Full-stack / backend", "Selected freelance projects"],
    fa: ["مهندسی نرم‌افزار ارشد", "فول‌استک / بک‌اند", "پروژه‌های فریلنس منتخب"],
  },
  workModes: {
    en: ["Remote", "Hybrid", "Relocation-ready opportunities"],
    fa: ["دورکاری", "هیبرید", "فرصت‌های مناسب برای جابه‌جایی"],
  },
  email: "osirandoust@gmail.com",
};

const dictionary = {
  en: {
    availability: "Open to selected opportunities",
    availabilityShort: "Selected opportunities",
    availabilityTitle: "Availability",
    accessibility: "Accessibility",
    accessibilityTitle: "Accessibility Control Center",
    language: "Language",
    english: "English",
    persian: "فارسی",
    caseStudies: "Case Studies",
    caseStudiesTitle: "Engineering decisions in real-world work.",
    caseStudiesIntro: "Privacy-safe case studies focused on constraints, architecture, decisions, and outcomes rather than marketing claims.",
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
    universalSearch: "Universal Search",
    universalSearchPlaceholder: "Search projects, notes, case studies, skills, experience…",
    navAbout: "about", navWork: "work", navExperience: "experience", navNow: "now", navNotes: "notes", navContact: "contact", navCaseStudies: "case studies",
    heroEyebrow: "SOFTWARE ENGINEER · BACKEND · FULL-STACK · SYSTEMS",
    heroTitleLead: "I build software", heroTitleTail: "that stays", heroTitleAccent: "solid.",
    heroCopy: "I’m Osameh Irandoust — a software engineer turning complex systems into clear, fast, dependable products. From C++ internals to modern web experiences.",
    exploreWork: "Explore my work", copyEmail: "Copy email", emailCopied: "Email copied",
    aboutTitle: "Engineering with range.", aboutP1: "I work comfortably across the stack — close to the metal in C++ and Qt, inside production backends with .NET, or crafting polished interfaces with Nuxt.",
    aboutP2: "My focus is always the same: understand the real problem, choose the right level of complexity, and ship work that people can trust.",
    productionYears: "4+ years in production", location: "Tehran, Iran",
    projectsTitle: "Everything I’m building.", projectsIntro: "A live view of public work enriched by repository-owned portfolio.json metadata. Archived repositories stay out of the way.",
    recruiterMode: "Recruiter mode", githubProfile: "GitHub profile", experienceTitle: "Built in the real world.",
    contactEyebrow: "READY FOR THE NEXT BUILD", contactTitleLead: "Have a difficult problem?", contactTitleAccent: "Let’s make it simple.",
    contactCopy: "Open to thoughtful engineering roles, ambitious products, and conversations about how software should work.",
    openCaseStudy: "Open case study", preferencesSaved: "Preferences save automatically",
    noResults: "No matching item found.",
  },
  fa: {
    availability: "آماده بررسی فرصت‌های منتخب",
    availabilityShort: "فرصت‌های منتخب",
    availabilityTitle: "وضعیت همکاری",
    accessibility: "دسترس‌پذیری",
    accessibilityTitle: "مرکز کنترل دسترس‌پذیری",
    language: "زبان",
    english: "English",
    persian: "فارسی",
    caseStudies: "مطالعات موردی",
    caseStudiesTitle: "تصمیم‌های مهندسی در پروژه‌های واقعی.",
    caseStudiesIntro: "مطالعات موردی با رعایت محرمانگی که به‌جای ادعاهای تبلیغاتی روی محدودیت‌ها، معماری، تصمیم‌ها و نتیجه تمرکز دارند.",
    confidential: "ناشناس / محرمانه",
    problem: "مسئله",
    constraints: "محدودیت‌ها",
    solution: "راهکار",
    decisions: "تصمیم‌های مهندسی",
    outcomes: "نتیجه‌ها",
    lessons: "آموخته‌ها",
    stack: "فناوری‌ها",
    role: "نقش",
    timeline: "بازه همکاری",
    close: "بستن",
    reducedMotion: "کاهش حرکت",
    reducedMotionHelp: "کاهش پارالاکس، اسکرول نرم و انیمیشن‌های غیرضروری.",
    highContrast: "افزایش کنتراست",
    highContrastHelp: "تقویت کنتراست متن، خطوط و حالت‌های تعاملی.",
    largeText: "متن رابط بزرگ‌تر",
    largeTextHelp: "افزایش مقیاس پایه رابط بدون به‌هم‌زدن چیدمان محیط ادیتور.",
    strongFocus: "فوکوس واضح‌تر",
    strongFocusHelp: "نمایش واضح‌تر فوکوس کیبورد در کل محیط.",
    systemPreference: "تنظیم Reduce Motion سیستم‌عامل به‌صورت خودکار رعایت می‌شود.",
    currentAvailability: "وضعیت فعلی",
    workModes: "شیوه همکاری",
    opportunities: "نوع فرصت‌ها",
    timezone: "منطقه زمانی",
    contact: "شروع گفتگو",
    universalSearch: "جستجوی سراسری",
    universalSearchPlaceholder: "جستجو در پروژه‌ها، یادداشت‌ها، مطالعات موردی، مهارت‌ها و تجربه…",
    navAbout: "درباره من", navWork: "پروژه‌ها", navExperience: "تجربه", navNow: "اکنون", navNotes: "یادداشت‌ها", navContact: "تماس", navCaseStudies: "مطالعات موردی",
    heroEyebrow: "مهندس نرم‌افزار · بک‌اند · فول‌استک · سیستم‌ها",
    heroTitleLead: "نرم‌افزاری می‌سازم", heroTitleTail: "که محکم و", heroTitleAccent: "قابل اتکاست.",
    heroCopy: "من اسامه ایران‌دوست هستم؛ مهندس نرم‌افزاری که سیستم‌های پیچیده را به محصولات شفاف، سریع و قابل‌اعتماد تبدیل می‌کند؛ از لایه‌های داخلی C++ تا تجربه‌های مدرن وب.",
    exploreWork: "مشاهده پروژه‌ها", copyEmail: "کپی ایمیل", emailCopied: "ایمیل کپی شد",
    aboutTitle: "مهندسی با دامنه‌ای گسترده.", aboutP1: "در سراسر پشته نرم‌افزار کار می‌کنم؛ از C++ و Qt نزدیک به سیستم، تا بک‌اندهای production با .NET و رابط‌های مدرن با Nuxt.",
    aboutP2: "تمرکز من همیشه یکسان است: مسئله واقعی را بفهمم، سطح پیچیدگی مناسب را انتخاب کنم و محصولی تحویل بدهم که بتوان به آن اعتماد کرد.",
    productionYears: "بیش از ۴ سال تجربه production", location: "تهران، ایران",
    projectsTitle: "چیزهایی که می‌سازم.", projectsIntro: "نمای زنده‌ای از پروژه‌های عمومی که با metadata متعلق به خود repository غنی شده‌اند؛ repositoryهای archive شده نمایش داده نمی‌شوند.",
    recruiterMode: "حالت Recruiter", githubProfile: "پروفایل GitHub", experienceTitle: "تجربه در دنیای واقعی.",
    contactEyebrow: "آماده برای ساخت بعدی", contactTitleLead: "مسئله سختی دارید؟", contactTitleAccent: "ساده‌اش کنیم.",
    contactCopy: "برای نقش‌های مهندسی جدی، محصولات بلندپروازانه و گفتگو درباره ساخت نرم‌افزار بهتر آماده‌ام.",
    openCaseStudy: "باز کردن مطالعه موردی", preferencesSaved: "تنظیمات به‌صورت خودکار ذخیره می‌شوند",
    noResults: "موردی پیدا نشد.",
  },
} as const;

export type TranslationKey = keyof typeof dictionary.en;

type FeatureContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
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
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem("portfolio-locale");
      return stored === "fa" ? "fa" : "en";
    } catch {
      return "en";
    }
  });
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
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    document.documentElement.dataset.locale = locale;
    localStorage.setItem("portfolio-locale", locale);

    const isDetailRoute = /^\/(?:projects|notes|case-studies)\/[^/]+\/?$/.test(window.location.pathname);
    if (!isDetailRoute) {
      document.title = locale === "fa" ? "اسامه ایران‌دوست — مهندس نرم‌افزار" : "Osameh Irandoust — Software Engineer";
      const description = locale === "fa"
        ? "پورتفولیوی مهندسی نرم‌افزار اسامه ایران‌دوست؛ پروژه‌ها، مطالعات موردی، یادداشت‌های مهندسی و تجربه در بک‌اند، فول‌استک و سیستم‌ها."
        : "Osameh Irandoust's software engineering portfolio: projects, case studies, engineering notes, and experience across backend, full-stack, and systems work.";
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description);
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", description);
      document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.setAttribute("content", locale === "fa" ? "fa_IR" : "en_US");
    }
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduceMotion = accessibility.reduceMotion ? "true" : "false";
    root.dataset.highContrast = accessibility.highContrast ? "true" : "false";
    root.dataset.largeText = accessibility.largeText ? "true" : "false";
    root.dataset.strongFocus = accessibility.strongFocus ? "true" : "false";
    localStorage.setItem("portfolio-accessibility", JSON.stringify(accessibility));
  }, [accessibility]);

  const value = useMemo<FeatureContextValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: key => dictionary[locale][key],
    accessibility,
    setAccessibility: setAccessibilityState,
    accessibilityOpen,
    setAccessibilityOpen,
    availabilityOpen,
    setAvailabilityOpen,
  }), [locale, accessibility, accessibilityOpen, availabilityOpen]);

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}

export function usePortfolioFeatures() {
  const context = useContext(FeatureContext);
  if (!context) throw new Error("usePortfolioFeatures must be used inside FeaturePreferencesProvider");
  return context;
}

export function LanguageControl() {
  const { locale, setLocale, t } = usePortfolioFeatures();
  return <button type="button" className="feature-icon-button language-control" aria-label={`${t("language")}: ${locale === "en" ? t("english") : t("persian")}`} title={t("language")} onClick={() => setLocale(locale === "en" ? "fa" : "en")}>
    <Languages size={16} aria-hidden="true" /><span>{locale.toUpperCase()}</span>
  </button>;
}

export function AccessibilityControlButton() {
  const { setAccessibilityOpen, t } = usePortfolioFeatures();
  return <button type="button" className="feature-icon-button" aria-label={t("accessibility")} title={t("accessibility")} onClick={() => setAccessibilityOpen(true)}><Accessibility size={16} aria-hidden="true" /></button>;
}

export function AvailabilityBadge() {
  const { locale, setAvailabilityOpen, t } = usePortfolioFeatures();
  const statusLabel = availabilityStatusLabels[availabilityConfig.status][locale];
  return <button type="button" className={`availability availability-button availability-${availabilityConfig.status}`} onClick={() => setAvailabilityOpen(true)} aria-label={`${t("availabilityTitle")}: ${statusLabel}`}><i aria-hidden="true" /> <span>{statusLabel}</span></button>;
}


function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: () => void; label: string; help: string }) {
  return <button type="button" className="accessibility-toggle" role="switch" aria-checked={checked} onClick={onChange}>
    <span><b>{label}</b><small>{help}</small></span><i className={checked ? "active" : ""}>{checked && <Check size={13} />}</i>
  </button>;
}

export function PortfolioFeatureModals() {
  const { locale, accessibility, setAccessibility, accessibilityOpen, setAccessibilityOpen, availabilityOpen, setAvailabilityOpen, t } = usePortfolioFeatures();
  const availabilityStatusLabel = availabilityStatusLabels[availabilityConfig.status][locale];
  useEffect(() => {
    if (!accessibilityOpen && !availabilityOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccessibilityOpen(false);
      setAvailabilityOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [accessibilityOpen, availabilityOpen, setAccessibilityOpen, setAvailabilityOpen]);
  return <>
    {accessibilityOpen && <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setAccessibilityOpen(false)}>
      <section className="feature-modal accessibility-center" role="dialog" aria-modal="true" aria-labelledby="accessibility-title" onKeyDown={trapDialogFocus} onMouseDown={event => event.stopPropagation()}>
        <header><span><Accessibility size={16} /> <b id="accessibility-title">{t("accessibilityTitle")}</b></span><button type="button" autoFocus onClick={() => setAccessibilityOpen(false)} aria-label={t("close")}><X size={17} /></button></header>
        <div className="feature-modal-body">
          <Toggle checked={accessibility.reduceMotion} onChange={() => setAccessibility(current => ({ ...current, reduceMotion: !current.reduceMotion }))} label={t("reducedMotion")} help={t("reducedMotionHelp")} />
          <Toggle checked={accessibility.highContrast} onChange={() => setAccessibility(current => ({ ...current, highContrast: !current.highContrast }))} label={t("highContrast")} help={t("highContrastHelp")} />
          <Toggle checked={accessibility.largeText} onChange={() => setAccessibility(current => ({ ...current, largeText: !current.largeText }))} label={t("largeText")} help={t("largeTextHelp")} />
          <Toggle checked={accessibility.strongFocus} onChange={() => setAccessibility(current => ({ ...current, strongFocus: !current.strongFocus }))} label={t("strongFocus")} help={t("strongFocusHelp")} />
          <p className="feature-modal-note"><ShieldCheck size={14} /> {t("systemPreference")}</p>
        </div>
      </section>
    </div>}
    {availabilityOpen && <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setAvailabilityOpen(false)}>
      <section className="feature-modal availability-modal" role="dialog" aria-modal="true" aria-labelledby="availability-title" onKeyDown={trapDialogFocus} onMouseDown={event => event.stopPropagation()}>
        <header><span><Globe2 size={16} /> <b id="availability-title">{t("availabilityTitle")}</b></span><button type="button" autoFocus onClick={() => setAvailabilityOpen(false)} aria-label={t("close")}><X size={17} /></button></header>
        <div className="feature-modal-body">
          <div className={`availability-status-card availability-${availabilityConfig.status}`}><i /><div><small>{t("currentAvailability")}</small><strong>{availabilityStatusLabel}</strong></div></div>
          <dl className="availability-details"><div><dt>{t("opportunities")}</dt><dd>{availabilityConfig.opportunityTypes[locale].join(" · ")}</dd></div><div><dt>{t("workModes")}</dt><dd>{availabilityConfig.workModes[locale].join(" · ")}</dd></div><div><dt>{t("timezone")}</dt><dd dir="ltr">{availabilityConfig.timezone}</dd></div></dl>
          <a href={`mailto:${availabilityConfig.email}`} className="primary-btn availability-cta">{t("contact")} <ChevronRight size={15} /></a>
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
    <div className="case-study-grid">{caseStudies.map((study, index) => <article className="case-study-card" key={study.id}>
      <header><span>{String(index + 1).padStart(2, "0")}</span><small>{study.privacy === "anonymized" ? t("confidential") : study.client}</small></header>
      <p className="case-study-type">{study.industry} · {study.projectType}</p><h3>{study.title}</h3><p>{study.summary}</p>
      <div className="case-study-stack">{study.stack.slice(0, 5).map(item => <span key={item}>{item}</span>)}</div>
      <button type="button" onClick={() => onOpen(study)}>{t("openCaseStudy")} <ChevronRight size={14} /></button>
    </article>)}</div>
  </section>;
}

export function CaseStudyModal({ study, onClose }: { study: CaseStudy | null; onClose: () => void }) {
  const { t } = usePortfolioFeatures();
  useEffect(() => {
    if (!study) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [study, onClose]);
  if (!study) return null;
  return <div className="feature-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="feature-modal case-study-modal" role="dialog" aria-modal="true" aria-labelledby="case-study-title" onKeyDown={trapDialogFocus} onMouseDown={event => event.stopPropagation()}>
      <header><span><Search size={16} /><b dir="ltr">case-study/{study.id}.md</b></span><button type="button" autoFocus onClick={onClose} aria-label={t("close")}><X size={17} /></button></header>
      <div className="feature-modal-body case-study-detail">
        <div className="case-study-detail-hero"><p>{study.industry} · {study.projectType}</p><h2 id="case-study-title">{study.title}</h2><span>{study.client} · {study.role}</span></div>
        <div className="case-study-facts"><span><b>{t("role")}</b>{study.role}</span><span><b>{t("timeline")}</b>{study.timeline}</span><span><b>{t("stack")}</b>{study.stack.join(" · ")}</span></div>
        <section><h3>{t("problem")}</h3><p>{study.problem}</p></section>
        <section><h3>{t("constraints")}</h3><ul>{study.constraints.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>{t("solution")}</h3><ul>{study.solution.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>{t("decisions")}</h3><ul>{study.decisions.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>{t("outcomes")}</h3><ul>{study.outcomes.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>{t("lessons")}</h3><ul>{study.lessons.map(item => <li key={item}>{item}</li>)}</ul></section>
      </div>
    </section>
  </div>;
}

export { caseStudies };
