export type CaseStudyPrivacy = "public" | "anonymized";

export type Capability = {
  id: string;
  title: string;
  summary: string;
  focus: string[];
  technologies: string[];
};

/**
 * A client engagement. Distinct from a project deep-dive, which is the
 * per-repository narrative in portfolioData/portfolio.json and is keyed by
 * repository name. Both were called "case study"; only this one is a client
 * case study, and only this one appears under /case-studies.
 */
export type ClientCaseStudy = {
  id: string;
  title: string;
  client: string;
  industry: string;
  role: string;
  projectType: string;
  privacy: CaseStudyPrivacy;
  summary: string;
  problem: string;
  constraints: string[];
  solution: string[];
  stack: string[];
  responsibilities: string[];
  decisions: string[];
  outcomes: string[];
  lessons: string[];
  timeline: string;
  relatedSkills: string[];
  siteUrl?: string;
  /**
   * Label for the live-site link. Set it when "Visit live site" would overstate
   * what the URL is - a temporary development preview is not a production site.
   */
  siteLabel?: string;
  /** Repository names that evidence this client engagement. */
  relatedProjects?: string[];
  /** Engineering note slugs that discuss this engagement. */
  relatedNotes?: string[];
};

// These are capability areas backed by Osameh's professional experience. They are
// intentionally presented as "what I can build" rather than as named client work.
export const capabilities: Capability[] = [
  {
    id: "realtime-communications",
    title: "Cross-platform real-time communications",
    summary: "Build and stabilize realtime desktop/mobile products with reliable lifecycle behavior, native integrations, and clear state transitions.",
    focus: ["Realtime systems", "Desktop + Android", "Lifecycle reliability", "Native integration"],
    technologies: ["C++", "Qt", "QML", "Android", "Java", "JNI", "WebSocket"],
  },
  {
    id: "business-platform",
    title: "Business platform modernization",
    summary: "Modernize production business software incrementally across frontend, backend, data access, observability, and operational workflows.",
    focus: ["Full-stack modernization", "Production reliability", "Observability", "Incremental delivery"],
    technologies: ["Nuxt", "Vue", ".NET", "C#", "PostgreSQL", "ELK", "Ruby"],
  },
  {
    id: "marketplace-platform",
    title: "Marketplace and mobile product delivery",
    summary: "Deliver coherent products across backend APIs, responsive web experiences, mobile integration, authentication, and relational data.",
    focus: ["API design", "Responsive web", "Android integration", "Authentication"],
    technologies: ["PHP", "Laravel", "MySQL", "JavaScript", "Java", "Kotlin", "Android"],
  },
];

// Only publicly verifiable freelance/client work belongs here. Additional case
// studies can be added later without changing the presentation architecture.
export const caseStudies: ClientCaseStudy[] = [
  {
    id: "amorella-beauty",
    title: "Amorella Beauty",
    client: "Amorella Beauty",
    industry: "Beauty",
    role: "Freelance Software Developer",
    projectType: "Production website",
    privacy: "public",
    summary: "A live client website delivered as part of my freelance web work, focused on a polished customer-facing experience and dependable production delivery.",
    problem: "Create and deliver a professional public-facing website for the Amorella Beauty brand that is ready for real visitors and ongoing use.",
    constraints: ["Client-facing production environment", "Responsive experience across common device sizes", "Maintainable delivery for future updates"],
    solution: ["Delivered the website end to end", "Built the experience around clear customer-facing content and navigation", "Prepared the site for production deployment and ongoing maintenance"],
    stack: ["Web development", "Responsive UI", "Production deployment"],
    responsibilities: ["Requirements", "Implementation", "Responsive UI", "Deployment", "Maintenance"],
    decisions: ["Keep the public experience focused and easy to navigate", "Favor maintainable implementation over unnecessary complexity"],
    outcomes: ["The client website is live and publicly accessible at amorellabeauty.ir"],
    lessons: ["Client work benefits from balancing visual polish, maintainability, and production reliability"],
    timeline: "Freelance client work",
    relatedSkills: ["Web Development", "Responsive UI", "Deployment"],
    siteUrl: "https://amorellabeauty.ir/",
  },
  {
    id: "hirava",
    title: "Hirava",
    client: "Hirava",
    industry: "Recruitment platform",
    role: "Product & Frontend Engineer",
    projectType: "Two-sided marketplace · in development",
    privacy: "public",
    summary: "A trust-driven recruitment marketplace connecting companies with professional recruiters. The Nuxt 4 frontend is implemented and running as a development preview; the Go backend is planned and not built yet.",
    problem: "Traditional hiring channels create excessive candidate volume, weak accountability, and almost no visibility into recruiter performance. Hirava explores a marketplace model where companies work with verified recruiters who each submit a small number of structurally evaluated candidates instead of forwarding resumes in bulk.",
    constraints: [
      "Frontend-first delivery: the product surface is built before the backend it will eventually call, so it must not become the system of record",
      "Two participants with almost no shared vocabulary - companies and recruiters need separate product contexts, not one dashboard with role flags",
      "Persian-first, right-to-left interface with an English locale, Jalali and Gregorian calendars, and Rial-to-Toman currency display",
      "Every business rule modelled in the browser has to stay clearly marked as client-side, because the server that will enforce it does not exist yet",
      "Prototype content must never be presented as measured business results",
    ],
    solution: [
      "Modelled the domain as two separate product contexts - company, recruiter - plus an internal admin context, each behind its own route namespace and route middleware",
      "Implemented the hiring pipeline as a single explicit state model (submitted, under review, interview, final stage, hired, rejected) rather than a set of ordered tabs",
      "Built the candidate submission flow around a structured assessment package - strengths, weaknesses, motivation, risk factors, recommendation, fit score - instead of a resume attachment",
      "Surfaced the product invariants the backend will own, including the five-candidates-per-job submission cap, as named client-side constants documented as hints that the server must re-validate",
      "Kept all state in typed stores fed by typed data modules, so the data source can be replaced with an HTTP client without moving component code",
      "Shared only presentation primitives - dates, currency, plan and tier chips, layout chrome - and never shared a workflow between the two participant contexts",
    ],
    stack: ["Nuxt 4", "Vue 3", "TypeScript", "Tailwind CSS", "Pinia", "TanStack Query", "Nuxt i18n (fa/en, RTL)"],
    responsibilities: ["Product domain modelling", "Frontend architecture", "Design system and RTL layout", "State and data-layer design", "API boundary definition for the planned backend"],
    decisions: [
      "Split by participant, not by page: a company dashboard and a recruiter dashboard share layout, not logic",
      "Treat the hiring pipeline as an append-only state machine in the type system, so an illegal transition is not renderable",
      "Declare the API base in runtime configuration and leave it uncalled, rather than inventing an API shape a Go backend would then have to honour",
      "Define the submission cap once, beside a comment stating that the client value only pre-empts an obviously invalid action",
      "Planned backend architecture is Nuxt frontend over a REST boundary to a Go service with PostgreSQL - documented as planned, never presented as deployed",
    ],
    outcomes: [
      "The current milestone delivers the frontend product architecture and interaction model, not a running platform",
      "Company, recruiter and admin flows are modelled end to end across the implemented Nuxt application",
      "The hiring pipeline, structured candidate evaluation, verification stages, recruiter performance surfaces and plan/pricing model are represented in the interface",
      "The application is responsive and bilingual, with right-to-left as the primary direction",
      "State, types and the API boundary are shaped so backend integration replaces a data source rather than the product",
      "Live figures shown on the marketing pages are prototype presentation content and are not claimed as adoption, placements or revenue",
    ],
    lessons: [
      "Building the product surface before the backend is defensible only while the surface stays explicit about what it does not enforce",
      "A client-side rule is worth much more when the comment beside it names the server as the real authority",
      "Two-sided products fail when the two sides are collapsed into one screen with conditionals",
      "Prototype numbers are the fastest way for an honest project to start making dishonest claims",
    ],
    timeline: "In development · frontend milestone delivered",
    relatedSkills: ["Nuxt", "Vue", "TypeScript", "Frontend Architecture", "Product Engineering"],
    siteUrl: "https://hirava.osameh.dev",
    siteLabel: "Open live preview",
    relatedNotes: ["architecting-hirava-recruitment-marketplace", "designing-trust-into-hiring-workflows"],
  },
];

/** @deprecated Use ClientCaseStudy. Kept so existing imports keep compiling. */
export type CaseStudy = ClientCaseStudy;
