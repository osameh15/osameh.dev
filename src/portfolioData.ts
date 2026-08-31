export type RepoLike = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  default_branch: string;
};

export type CaseStudy = {
  problem: string;
  solution: string;
  architecture: string[];
  challenges: string[];
  results: string[];
};

const handcraftedCaseStudies: Record<string, CaseStudy> = {
  Mizekar: {
    problem: "Managing structured Persian-language folder workflows on Windows needed to feel immediate, fullscreen, and reliable without forcing non-technical users into File Explorer.",
    solution: "A .NET 8 / WPF desktop application with page-based navigation, Persian-first UX, category-driven folder management, image workflows, input validation, and filesystem monitoring.",
    architecture: [".NET 8 + WPF single-window shell", "Frame/Page navigation for flicker-free transitions", "FolderService abstraction over filesystem operations", "FileSystemWatcher for live updates", "User-writable data under %APPDATA%"],
    challenges: ["RTL/Persian input validation and typography", "Avoiding fullscreen transition flicker", "Keeping filesystem state and UI synchronized", "Packaging assets and installer reliably"],
    results: ["Fast page transitions with a single-window architecture", "Real-time folder updates", "Installer-ready Windows deployment", "Accessible Persian-first desktop workflow"],
  },
  Dialysis: {
    problem: "Patients undergoing dialysis need a focused mobile experience for treatment-related information and day-to-day monitoring without overwhelming navigation.",
    solution: "An Android application organized around treatment information, reminders, health-related screens, and a straightforward mobile navigation model.",
    architecture: ["Native Android application", "Java-based mobile codebase", "Screen-oriented feature modules", "Repository-managed visual assets and documentation"],
    challenges: ["Presenting medical information clearly", "Keeping the mobile UX simple", "Maintaining compatibility across Android versions"],
    results: ["A focused healthcare-oriented Android product", "Documented visual flow", "Reusable project structure for future health features"],
  },
  YariZan: {
    problem: "Elementary students needed a playful Persian launcher that could organize educational mini-games while still supporting controlled deployment in school environments.",
    solution: "A WPF launcher styled as an ornate book, with grade-based game navigation and hardware-locked activation for managed installations.",
    architecture: ["C# / WPF desktop shell", "Grade-oriented game catalog", "Hardware-bound activation flow", "Local launcher assets"],
    challenges: ["Child-friendly interaction design", "Persian typography and layout", "Reliable activation on school hardware"],
    results: ["A focused launcher for grades 1-6", "Distinct visual identity", "Managed activation workflow"],
  },
  "Form-Management": {
    problem: "Nuxt applications often need form building and rendering without pulling in a heavy UI framework or drag-and-drop dependency stack.",
    solution: "A zero-dependency Nuxt module providing a form builder and renderer with modern UI behavior designed to fit alongside the companion dialog/toast packages.",
    architecture: ["Nuxt 3/4 module", "TypeScript-first API", "Zero third-party UI framework", "Reusable builder + renderer layers"],
    challenges: ["Drag-and-drop behavior without external libraries", "Keeping bundle overhead small", "Designing an ergonomic module API"],
    results: ["Composable form tooling", "No Vuetify/MDI dependency requirement", "Consistent ecosystem with companion Nuxt modules"],
  },
};

export function caseStudyFor(repo: RepoLike): CaseStudy {
  if (handcraftedCaseStudies[repo.name]) return handcraftedCaseStudies[repo.name];
  const stack = [repo.language, ...repo.topics].filter(Boolean).slice(0, 5).join(", ") || "a pragmatic project-specific stack";
  return {
    problem: repo.description || `A product or engineering problem that called for a focused implementation in ${repo.language || "software"}.`,
    solution: `A production-minded implementation built around ${stack}, with the repository kept public so the architecture and iteration history can be inspected directly.`,
    architecture: [
      `${repo.language || "Mixed-language"} implementation`,
      repo.topics.length ? `Domain modules: ${repo.topics.slice(0, 4).join(", ")}` : "Repository-driven modular structure",
      "Git-based release and change history",
    ],
    challenges: ["Keeping the implementation maintainable", "Balancing scope against complexity", "Making the public repository understandable to other developers"],
    results: ["Working public implementation", `Recently maintained (${new Date(repo.updated_at).getFullYear()})`, "Source and project documentation available on GitHub"],
  };
}

export const nowItems = [
  { label: "Working on", value: "Production software, backend systems, and product engineering at Navatel." },
  { label: "Building", value: "Open-source Nuxt utilities, desktop software, and experiments around AI-assisted workflows." },
  { label: "Learning", value: "Deeper distributed-system design, observability, and practical AI integration in production services." },
  { label: "Open to", value: "Thoughtful software engineering roles, ambitious products, technical collaboration, and high-leverage freelance work." },
];

export const changelog = [
  { version: "2.1.0", title: "Readability & contact polish", items: ["Improved typography and contrast across both themes", "Fixed contact form bootstrap with resilient same-origin CSRF handling", "Refined header wrapping and resume PDF actions", "Added ongoing freelance experience from 2017 to present"] },
  { version: "2.0.1", title: "Build UX & compile fixes", items: ["Build information now opens in an in-app modal", "Terminal build opens the modal while version remains text-only", "Fixed React event-handler typing and GitHub activity icon compatibility"] },
  { version: "2.0.0", title: "Portfolio OS", items: ["Case studies, project filtering and compare", "Resume viewer, PWA/offline support and contact form", "GitHub activity, system diagnostics and privacy-friendly analytics", "Advanced terminal, keyboard navigation and share tooling", "Dynamic project social metadata"] },
  { version: "1.3.0", title: "Developer interaction layer", items: ["Custom context menu", "Command Palette", "Terminal autofocus", "Deep project links and clipboard toasts"] },
  { version: "1.2.0", title: "Production diagnostics", items: ["Build IDs", "Social preview cover", "Gallery and project image discovery", "GitHub proxy hardening"] },
  { version: "1.0.0", title: "Production launch", items: ["IDE-inspired responsive portfolio", "Dynamic public GitHub projects", "README rendering", "CDN-ready shared-host deployment"] },
];

export const resumeSummary = {
  headline: "Software Engineer (Backend | Full-Stack | Systems)",
  profile: "Software Engineer with 4+ years of experience designing and building scalable backend systems, full-stack web applications, and cross-platform software.",
  skills: ["C++", "C# / .NET", "Python", "Java", "JavaScript", "PHP", "Ruby", "SQL", "Nuxt.js", "PostgreSQL", "MySQL", "Cassandra", "Docker", "Linux", "ELK Stack"],
  education: "B.Sc. Software Engineering - University of Tehran (2017-2021), GPA 3.77/4.0, 3x top-student recognition, Teaching Assistant for 14 semesters.",
  languages: ["Persian - Fluent", "Kurdish - Fluent", "English - Intermediate", "Spanish - Basic"],
};
