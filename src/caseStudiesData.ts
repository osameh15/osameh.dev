export type CaseStudyPrivacy = "public" | "anonymized";

export type Capability = {
  id: string;
  title: string;
  summary: string;
  focus: string[];
  technologies: string[];
};

export type CaseStudy = {
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
export const caseStudies: CaseStudy[] = [
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
];
