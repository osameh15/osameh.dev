export type CaseStudyPrivacy = "public" | "anonymized";

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
};

// These entries intentionally stay high-level and privacy-safe. They describe
// categories of professional work already represented by the portfolio without
// inventing client names, private metrics, or confidential implementation detail.
export const caseStudies: CaseStudy[] = [
  {
    id: "realtime-communications",
    title: "Cross-platform real-time communications",
    client: "Confidential product team",
    industry: "Communications",
    role: "Software Engineer",
    projectType: "Desktop + Android systems",
    privacy: "anonymized",
    summary: "Stabilizing a mature Qt/QML communications product while preserving background-call behavior across desktop and Android.",
    problem: "A large multi-platform codebase had tightly coupled UI/native behavior, difficult lifecycle edge cases, and reliability regressions around foreground/background transitions.",
    constraints: ["Large legacy codebase", "Qt/QML and Android/JNI boundary", "Background service continuity", "Limited automated test coverage"],
    solution: ["Separated lifecycle responsibilities", "Reduced destructive process-level shutdown behavior", "Improved observable startup and call-state paths", "Kept platform-specific behavior behind narrow native boundaries"],
    stack: ["C++", "Qt", "QML", "Android", "Java", "JNI", "WebSocket"],
    responsibilities: ["Debugging", "Lifecycle design", "Native integration", "UI behavior", "Performance analysis"],
    decisions: ["Preserve service continuity instead of forcing process termination", "Prefer explicit state transitions over timing-based UI fixes", "Keep native integrations isolated from presentation logic"],
    outcomes: ["More predictable application lifecycle", "Clearer failure investigation", "Safer foundation for continued platform migration"],
    lessons: ["Lifecycle bugs are architecture bugs when responsibilities are blurred", "Instrumentation is essential before optimizing a mature realtime application"],
    timeline: "Ongoing professional work",
    relatedSkills: ["C++", "Qt", "Android", "System Design"],
  },
  {
    id: "business-platform",
    title: "Business platform modernization",
    client: "Confidential business application",
    industry: "Business software",
    role: "Full-Stack Engineer",
    projectType: "Web + API modernization",
    privacy: "anonymized",
    summary: "Improving a production business platform across frontend responsiveness, backend services, data access, and operational tooling.",
    problem: "The product needed coordinated improvements across UI responsiveness, backend behavior, data workflows, debugging, and maintainability without interrupting production use.",
    constraints: ["Production continuity", "Multiple technologies in one system", "Existing database contracts", "Cross-functional delivery"],
    solution: ["Improved responsive frontend behavior", "Hardened backend and API paths", "Used targeted scripts and observability to accelerate diagnosis", "Documented operational knowledge for the team"],
    stack: ["Nuxt", "Vue", ".NET", "C#", "PostgreSQL", "ELK", "Ruby"],
    responsibilities: ["Frontend engineering", "Backend engineering", "Database work", "Debugging", "Documentation"],
    decisions: ["Optimize the bottleneck actually observed in production", "Favor incremental modernization over risky rewrites", "Keep diagnostic tooling close to operational workflows"],
    outcomes: ["More reliable production workflows", "Improved maintainability", "Faster debugging and team handoff"],
    lessons: ["Cross-stack context often solves issues faster than local optimization", "Production modernization benefits from small reversible changes"],
    timeline: "Multi-year production work",
    relatedSkills: ["Nuxt", ".NET", "PostgreSQL", "ELK"],
  },
  {
    id: "marketplace-platform",
    title: "Marketplace and mobile product delivery",
    client: "Private startup product",
    industry: "Consumer / marketplace",
    role: "Full-Stack Engineer",
    projectType: "Backend + responsive web + Android",
    privacy: "anonymized",
    summary: "Building and evolving a product spanning Laravel APIs, responsive web experiences, relational data, authentication, and Android integration.",
    problem: "A growing product needed one coherent implementation across backend contracts, browser UX, mobile integration, access control, and deployment concerns.",
    constraints: ["Small-team delivery", "Shared backend across web/mobile", "Authentication and authorization", "Fast iteration"],
    solution: ["Built REST-oriented backend capabilities", "Kept responsive web flows aligned with mobile contracts", "Structured relational data for product workflows", "Implemented authentication and role-aware access"],
    stack: ["PHP", "Laravel", "MySQL", "JavaScript", "Bootstrap", "Java", "Kotlin", "Android"],
    responsibilities: ["API design", "Database design", "Frontend implementation", "Android integration", "Security"],
    decisions: ["Treat API contracts as product interfaces", "Keep authorization enforced server-side", "Share domain concepts without coupling platform UI code"],
    outcomes: ["Consistent product behavior across web and mobile", "Clearer backend ownership of business rules", "More maintainable feature delivery"],
    lessons: ["Multi-client products need stable contracts more than clever abstractions", "Security boundaries should not depend on UI behavior"],
    timeline: "Long-running startup delivery",
    relatedSkills: ["Laravel", "MySQL", "Android", "REST API"],
  },
];
