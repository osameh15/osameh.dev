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
  { version: "3.1.0", title: "Interactive hero & source polish", items: ["Added pointer-responsive parallax to the custom home-screen engineering showcase", "Added animated live counters and a pulsing mini-terminal delivery status", "Stack Surface now follows the selected programming language and animates the matching technology lens", "Source Explorer file tree now has an explicit independent scrollbar and source previews show a visible loading state", "Project quick-access rail now visually passes behind opaque icon pads instead of through the icons", "README and release history were synchronized with the redesigned hero and recent repository-intelligence releases"] },
  { version: "3.0.5", title: "Hero showcase redesign", items: ["Replaced the generic hero orbit with a custom engineering showcase", "Introduced workflow, impact, stack, and build-rhythm panels for a stronger first impression", "Added dedicated dark/light theme styling for the redesigned home-screen visual"] },
  { version: "3.0.4", title: "Palette landing & ghost completion", items: ["Command Palette technology filters now land directly on the project filter controls instead of the Featured/Recruiter block", "Terminal autocomplete now previews the remaining completion as muted ghost text before Tab is pressed", "Tab and Shift+Tab cycling behavior remains unchanged while the preview makes the next completion discoverable"] },
  { version: "3.0.3", title: "Navigation & search reliability", items: ["Made Source Explorer code panes independently scrollable in both directions", "Reworked project quick-access tracking so selection follows both toolbar jumps and natural scrolling", "Expanded Terminal search and Command Palette indexing to repository-owned stack metadata such as Docker and WPF", "Added Tab and Shift+Tab command autocomplete for terminal commands, repositories, destinations, and technology searches"] },
  { version: "3.0.2", title: "Project navigation & readability", items: ["Balanced the changelog graph into equal-height independently scrollable panels", "Moved changelog version labels under their graph nodes to prevent hover overlays", "Added a low-profile floating quick-access rail for project Overview, README, Metadata, Metrics, Case Study, Architecture, Source, and Gallery", "Improved Recruiter Mode and repository-intelligence typography/contrast across dark and light themes", "Featured project cards now identify themselves to the custom context menu", "Fixed the Source Explorer request lifecycle that could leave a successful repository-tree response stuck in the loading state"] },
  { version: "3.0.1", title: "Release graph experience", items: ["Replaced the static changelog cards with an interactive release graph and detail panel", "Only the five newest releases render above the fold by default, with animated lazy loading for older history", "Version nodes now respond to hover, focus, and click to preview shipped changes without leaving the page", "The release archive can be expanded or collapsed without cluttering the first screen"] },
  { version: "3.0.0", title: "Repository intelligence", items: ["portfolio.json now drives project metadata and case studies", "Added featured project shortlist and guided Recruiter Mode", "Added per-project architecture viewer", "Added same-origin GitHub source explorer with repository policy and file-size safeguards", "Added cached live GitHub metrics with language percentages, license and release data", "Search/filter surfaces now understand repository-owned stack metadata"] },
  { version: "2.2.4", title: "CDN-safe IDE 404", items: ["Restored the in-app IDE 404 behind ParsPack CDN", "Unknown project deep links now use the same workspace 404", "Added noindex and diagnostic route-status headers for soft-404 responses"] },
  { version: "2.2.3", title: "Explorer state & resume plugin", items: ["Explorer files now track the visible section and selected route", "Project views keep Projects selected in the sidebar", "Moved the resume out of the file tree into a dedicated Portfolio Plugins card", "Resume plugin reflects the modal open state"] },
  { version: "2.2.2", title: "Release documentation", items: ["Added a complete repository CHANGELOG.md", "README now shows the five latest releases and links to full history", "Added the production screenshots to docs/img", "Finalized CI/CD documentation for scoped ParsPack deployment"] },
  { version: "2.2.1", title: "Automated delivery", items: ["GitHub Actions production build and FTPS deployment", "Scoped deployment credentials and CDN-aware live build verification", "Manual workflow dispatch for controlled redeploys", "Clarified the 30-day GitHub public activity window"] },
  { version: "2.2.0", title: "Interaction & polish", items: ["Command Palette selection now scrolls into view", "Resizable and maximizable IDE terminal panel", "Unified success, info, warning, and error toasts", "Contact filename follows the selected programming language", "Repository gallery discovers authored images across the full repository", "Status-bar build hover contrast refined"] },
  { version: "2.1.0", title: "Readability & contact polish", items: ["Improved typography and contrast across both themes", "Fixed contact form bootstrap with resilient same-origin CSRF handling", "Refined header wrapping and resume PDF actions", "Added ongoing freelance experience from 2017 to present"] },
  { version: "2.0.1", title: "Build UX & compile fixes", items: ["Build information now opens in an in-app modal", "Terminal build opens the modal while version remains text-only", "Fixed React event-handler typing and GitHub activity icon compatibility"] },
  { version: "2.0.0", title: "Portfolio OS", items: ["Case studies, project filtering and compare", "Resume viewer, PWA/offline support and contact form", "GitHub activity, system diagnostics and privacy-friendly analytics", "Advanced terminal, keyboard navigation and share tooling", "Dynamic project social metadata"] },
  { version: "1.3.0", title: "Developer interaction layer", items: ["Custom context menu", "Command Palette", "Terminal autofocus", "Deep project links and clipboard toasts"] },
  { version: "1.2.0", title: "Production diagnostics", items: ["Automatic build IDs and deployment fingerprints", "Social preview JPEG for broader crawler compatibility", "Expanded Open Graph and Twitter metadata", "Terminal version and build diagnostics"] },
  { version: "1.1.0", title: "Repository visuals", items: ["Project Gallery and fullscreen lightbox", "Repository-tree image discovery", "Root-relative and README image path fixes", "Server-side image-list caching"] },
  { version: "1.0.0", title: "Production launch", items: ["IDE-inspired responsive portfolio", "Shared-hosting React/Vite production build", "Server-side GitHub proxy and cache", "Sanitized README rendering and CDN-ready deployment"] },
];

export const resumeSummary = {
  headline: "Software Engineer (Backend | Full-Stack | Systems)",
  profile: "Software Engineer with 4+ years of experience designing and building scalable backend systems, full-stack web applications, and cross-platform software.",
  skills: ["C++", "C# / .NET", "Python", "Java", "JavaScript", "PHP", "Ruby", "SQL", "Nuxt.js", "PostgreSQL", "MySQL", "Cassandra", "Docker", "Linux", "ELK Stack"],
  education: "B.Sc. Software Engineering - University of Tehran (2017-2021), GPA 3.77/4.0, 3x top-student recognition, Teaching Assistant for 14 semesters.",
  languages: ["Persian - Fluent", "Kurdish - Fluent", "English - Intermediate", "Spanish - Basic"],
};
