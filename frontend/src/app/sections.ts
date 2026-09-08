// The semantic page registry. Explorer order, scroll spy, the Command
// Palette and the sitemap all follow this one sequence.

export type SearchResult = { label: string; path: string; kind: "section" | "project" };

export const sections: SearchResult[] = [
  { label: "Home", path: "/home", kind: "section" },
  { label: "About me", path: "/about", kind: "section" },
  { label: "Projects", path: "/projects", kind: "section" },
  { label: "Case Studies", path: "/case-studies", kind: "section" },
  { label: "Experience", path: "/experience", kind: "section" },
  { label: "GitHub Activity", path: "/activity", kind: "section" },
  { label: "Now", path: "/now", kind: "section" },
  { label: "Changelog", path: "/changelog", kind: "section" },
  { label: "Engineering Notes", path: "/notes", kind: "section" },
  { label: "Contact", path: "/contact", kind: "section" },
];

export const sectionByPath = (path: string) => sections.find(section => section.path === path)!;
