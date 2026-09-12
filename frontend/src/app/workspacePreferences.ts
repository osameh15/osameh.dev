// Theme, font and code-language preferences, plus the language-specific
// sample sources the workspace renders.

export type ThemePreference = "dark" | "light" | "system";

export type FontPreference = "inter" | "mono" | "humanist" | "serif";

export type CodeLanguage = "typescript" | "cpp" | "csharp" | "java" | "go" | "python" | "php";

/**
 * The language the workspace presents on a first visit.
 *
 * This is the portfolio's selectable presentation language, not a claim about
 * how the site itself is built. A returning visitor's explicit choice always
 * wins; this is only the fallback when there is no valid stored preference.
 */
export const DEFAULT_CODE_LANGUAGE: CodeLanguage = "cpp";

export const codeProfiles: Record<CodeLanguage, { label: string; file: string; projects: string; stack: string; open: string; close: string; comment: string }> = {
  typescript: { label: "TypeScript", file: "home.tsx", projects: "projects.ts", stack: "stack.ts", open: "const engineer = {", close: "};", comment: "// based in Tehran, working globally" },
  cpp: { label: "C++", file: "main.cpp", projects: "projects.cpp", stack: "stack.cpp", open: "auto engineer = Engineer{", close: "};", comment: "// based in Tehran, working globally" },
  csharp: { label: "C#", file: "Portfolio.cs", projects: "Projects.cs", stack: "Stack.cs", open: "var engineer = new Engineer {", close: "};", comment: "// based in Tehran, working globally" },
  java: { label: "Java", file: "Portfolio.java", projects: "Projects.java", stack: "Stack.java", open: "Engineer engineer = new Engineer() {{", close: "}};", comment: "// based in Tehran, working globally" },
  go: { label: "Go", file: "main.go", projects: "projects.go", stack: "stack.go", open: "engineer := Engineer{", close: "}", comment: "// based in Tehran, working globally" },
  python: { label: "Python", file: "portfolio.py", projects: "projects.py", stack: "stack.py", open: "engineer = {", close: "}", comment: "# based in Tehran, working globally" },
  php: { label: "PHP", file: "index.php", projects: "projects.php", stack: "stack.php", open: "$engineer = [", close: "];", comment: "// based in Tehran, working globally" },
};

export const contactFiles: Record<CodeLanguage, string> = {
  typescript: "send-message.ts",
  cpp: "send_message.cpp",
  csharp: "SendMessage.cs",
  java: "SendMessage.java",
  go: "send_message.go",
  python: "send_message.py",
  php: "send-message.php",
};

export const fontOptions: { id: FontPreference; label: string; sample: string }[] = [
  { id: "inter", label: "Inter / System", sample: "Aa" },
  { id: "mono", label: "Developer Mono", sample: "{}" },
  { id: "humanist", label: "Humanist", sample: "Ag" },
  { id: "serif", label: "Editorial Serif", sample: "Ss" },
];

export const roles = [
  { years: "Apr 2026 — Present", company: "Navatel", role: "Software Engineer", detail: "Building and improving production software as part of Navatel’s engineering team." },
  { years: "2017 — Present", company: "Independent / Freelance", role: "Freelance Software Developer", detail: "Delivering end-to-end client work across full-stack web applications, backend services, WordPress solutions, custom themes and plugins, automation, integrations, deployment, and long-term maintenance. I enjoy taking freelance projects from requirements and architecture through implementation, launch, optimization, and support." },
  { years: "2024 — 2026", company: "Fluxudio", role: "Software Engineer", detail: "Scalable .NET and Ruby services, Nuxt applications, ELK observability, Docker, and AI-assisted workflows." },
  { years: "2021 — 2024", company: "Datall", role: "Full Stack Developer", detail: "High-performance C++/Qt systems, PostgreSQL and Cassandra optimization, architecture built for reliability." },
  { years: "2019 — 2021", company: "Arrap Startup", role: "Android Developer", detail: "End-to-end Android products with Java and Kotlin, backed by Laravel, MySQL, and Python automation." },
];

/**
 * Where a skill can actually be checked.
 *
 *   public-repo  a public repository in this portfolio demonstrates it
 *   professional an employment role listed in `roles` used it
 *   freelance    published client work or a capability area covers it
 *
 * A skill may carry several. None of these are rankings: there are no scores,
 * no percentages and no invented years anywhere in this model. "public-repo"
 * is a promise the test suite enforces - every skill claiming it must resolve
 * to at least one real project through the canonical technology registry.
 */
export type SkillEvidenceSource = "public-repo" | "professional" | "freelance";

export type Skill = {
  /** Canonical technology key where one exists, otherwise a stable slug. */
  key: string;
  label: string;
  group: string;
  evidence: SkillEvidenceSource[];
};

export const skillCatalog: Skill[] = [
  { key: "nuxt", label: "Nuxt 3 / 4", group: "Frontend", evidence: ["public-repo", "professional"] },
  { key: "vue", label: "Vue", group: "Frontend", evidence: ["public-repo", "professional"] },
  { key: "typescript", label: "TypeScript", group: "Frontend", evidence: ["public-repo", "professional"] },
  { key: "javascript", label: "JavaScript", group: "Frontend", evidence: ["professional", "freelance"] },

  { key: "csharp", label: "C# / .NET", group: "Backend", evidence: ["public-repo", "professional"] },
  { key: "php", label: "Laravel / PHP", group: "Backend", evidence: ["public-repo", "professional", "freelance"] },
  { key: "ruby", label: "Ruby", group: "Backend", evidence: ["professional"] },
  { key: "rest-api", label: "REST APIs", group: "Backend", evidence: ["professional"] },

  { key: "cpp", label: "C++", group: "Desktop & Systems", evidence: ["professional"] },
  { key: "qt", label: "Qt / QML", group: "Desktop & Systems", evidence: ["professional"] },
  { key: "wpf", label: "WPF", group: "Desktop & Systems", evidence: ["public-repo"] },
  { key: "dotnet", label: ".NET 8", group: "Desktop & Systems", evidence: ["public-repo", "professional"] },

  { key: "android", label: "Android", group: "Mobile & Games", evidence: ["public-repo", "professional"] },
  { key: "java", label: "Java", group: "Mobile & Games", evidence: ["public-repo", "professional"] },
  { key: "kotlin", label: "Kotlin", group: "Mobile & Games", evidence: ["public-repo", "professional"] },
  { key: "unity", label: "Unity", group: "Mobile & Games", evidence: ["professional"] },

  { key: "postgresql", label: "PostgreSQL", group: "Data & DevOps", evidence: ["professional"] },
  { key: "mysql", label: "MySQL", group: "Data & DevOps", evidence: ["professional"] },
  { key: "cassandra", label: "Cassandra", group: "Data & DevOps", evidence: ["professional"] },
  { key: "docker", label: "Docker", group: "Data & DevOps", evidence: ["professional"] },
  { key: "elk", label: "ELK Stack", group: "Data & DevOps", evidence: ["professional"] },

  { key: "linux", label: "Linux", group: "Tooling", evidence: ["professional"] },
  { key: "python", label: "Python", group: "Tooling", evidence: ["professional"] },
  { key: "vitest", label: "Vitest", group: "Tooling", evidence: ["professional"] },
  { key: "github-actions", label: "GitHub Actions", group: "Tooling", evidence: ["professional"] },
  { key: "git", label: "Git", group: "Tooling", evidence: ["professional", "freelance"] },
];

export const skillGroups: string[] = Array.from(new Set(skillCatalog.map(skill => skill.group)));

/** The grouped shape the workspace code renderer has always consumed. */
export const skills: string[][] = skillGroups.map(group => [group, ...skillCatalog.filter(skill => skill.group === group).map(skill => skill.label)]);

export const EVIDENCE_LABEL: Record<SkillEvidenceSource, string> = {
  "public-repo": "Public work",
  professional: "Professional",
  freelance: "Freelance",
};

export function skillSource(language: CodeLanguage) {
  const values = skills.map(([group, ...items]) => ({ group, items }));
  if (language === "python") return ["class OsamehStack:", ...values.map(({ group, items }) => `    ${group.toLowerCase().replace(/[^a-z]+/g, "_")} = [${items.map(item => `\"${item}\"`).join(", ")}]`)];
  if (language === "php") return ["<?php", "$stack = [", ...values.map(({ group, items }) => `  '${group}' => [${items.map(item => `'${item}'`).join(", ")}],`), "];" ];
  if (language === "cpp") return ["struct OsamehStack {", ...values.map(({ group, items }) => `  vector<string> ${group.toLowerCase().replace(/[^a-z]+/g, "_")} { ${items.map(item => `\"${item}\"`).join(", ")} };`), "};" ];
  if (language === "csharp") return ["public sealed class OsamehStack", "{", ...values.map(({ group, items }) => `  public string[] ${group.replace(/[^a-zA-Z]+/g, "")} => [${items.map(item => `\"${item}\"`).join(", ")}];`), "}" ];
  if (language === "java") return ["public final class OsamehStack {", ...values.map(({ group, items }) => `  List<String> ${group.toLowerCase().replace(/[^a-z]+/g, "_")} = List.of(${items.map(item => `\"${item}\"`).join(", ")});`), "}" ];
  if (language === "go") return ["var osamehStack = map[string][]string{", ...values.map(({ group, items }) => `  \"${group}\": {${items.map(item => `\"${item}\"`).join(", ")}},`), "}" ];
  return ["const osamehStack = {", ...values.map(({ group, items }) => `  ${group.toLowerCase().replace(/[^a-z]+/g, "_")}: [${items.map(item => `\"${item}\"`).join(", ")}],`), "};" ];
}
