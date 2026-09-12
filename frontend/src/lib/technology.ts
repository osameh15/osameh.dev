// Canonical technology identities.
//
// The same technology arrives from four places with four spellings: GitHub's
// lowercase topics, a repository's portfolio.json stack, the skills catalog, and
// the capability cards. Before Null that produced eighty "Filter projects by ..."
// commands, six of which were Android.
//
// This registry is the single matching authority. Keys are internal and stable;
// labels are what a human reads. Nothing here rewrites a display string that the
// portfolio already shows - a project that lists "Nuxt 3" still reads "Nuxt 3".
//
// Two rules that are easy to get wrong:
//   - C# and .NET are related but distinct, and so are Qt and QML. A combined
//     source token such as "C# / .NET" resolves to BOTH keys rather than being
//     collapsed into one.
//   - A token that is not a technology is not forced into the registry.
//     Descriptive portfolio.json concepts ("Repository-driven portfolio",
//     "CDN caching") are real metadata, but they are not something to filter
//     projects by, so they simply resolve to nothing.

export type TechnologyDefinition = {
  key: string;
  label: string;
  /** Every spelling seen in live repository metadata, topics, or the catalogs. */
  aliases: string[];
};

const DEFINITIONS: TechnologyDefinition[] = [
  // ---- languages ----
  { key: "csharp", label: "C#", aliases: ["C#", "C# 12", "csharp", "c-sharp"] },
  { key: "cpp", label: "C++", aliases: ["C++", "cpp", "cplusplus"] },
  { key: "java", label: "Java", aliases: ["Java", "java"] },
  { key: "kotlin", label: "Kotlin", aliases: ["Kotlin", "kotlin"] },
  { key: "php", label: "PHP", aliases: ["PHP", "php"] },
  { key: "typescript", label: "TypeScript", aliases: ["TypeScript", "typescript", "ts"] },
  { key: "javascript", label: "JavaScript", aliases: ["JavaScript", "javascript", "js"] },
  { key: "python", label: "Python", aliases: ["Python", "python"] },
  { key: "ruby", label: "Ruby", aliases: ["Ruby", "ruby"] },
  { key: "css", label: "CSS", aliases: ["CSS", "css"] },
  { key: "html", label: "HTML", aliases: ["HTML", "html"] },
  { key: "xaml", label: "XAML", aliases: ["XAML", "xaml"] },
  { key: "powershell", label: "PowerShell", aliases: ["PowerShell", "powershell"] },

  // ---- frameworks and runtimes ----
  { key: "dotnet", label: ".NET", aliases: [".NET", ".NET 8", ".NET 9", "dotnet", "dotnet CLI", "dotnet-cli"] },
  { key: "wpf", label: "WPF", aliases: ["WPF", "wpf", "wpf-application"] },
  { key: "qt", label: "Qt", aliases: ["Qt", "qt"] },
  { key: "qml", label: "QML", aliases: ["QML", "qml"] },
  { key: "laravel", label: "Laravel", aliases: ["Laravel", "Laravel 8", "laravel", "laravel-framework", "laravel8", "Laravel Artisan"] },
  { key: "nuxt", label: "Nuxt", aliases: ["Nuxt", "Nuxt 3", "Nuxt 4", "Nuxt 3 / 4", "nuxt", "nuxt3", "nuxt4", "nuxtjs"] },
  { key: "vue", label: "Vue", aliases: ["Vue", "Vue 3", "Vue 3.5", "vue", "vue3", "vuejs"] },
  { key: "react", label: "React", aliases: ["React", "React 19", "react", "reactjs", "React (repository topics)"] },
  { key: "vuetify", label: "Vuetify", aliases: ["Vuetify", "Vuetify 3.9", "vuetify"] },
  { key: "tailwind", label: "Tailwind CSS", aliases: ["Tailwind CSS", "Tailwind CSS 4", "tailwind", "tailwindcss"] },
  { key: "bootstrap", label: "Bootstrap", aliases: ["Bootstrap", "bootstrap"] },
  { key: "vite", label: "Vite", aliases: ["Vite", "Vite 8", "vite"] },
  { key: "unity", label: "Unity", aliases: ["Unity", "unity"] },

  // ---- data ----
  { key: "mysql", label: "MySQL", aliases: ["MySQL", "mysql"] },
  { key: "postgresql", label: "PostgreSQL", aliases: ["PostgreSQL", "Postgres", "postgres", "postgresql"] },
  { key: "cassandra", label: "Cassandra", aliases: ["Cassandra", "cassandra"] },
  { key: "elk", label: "ELK Stack", aliases: ["ELK", "ELK Stack", "elk", "Elasticsearch"] },

  // ---- platforms ----
  { key: "android", label: "Android", aliases: ["Android", "android", "android-app", "android-application", "Android SDK", "Android Studio"] },
  { key: "web", label: "Web", aliases: ["Web", "Web / API", "web", "web-application"] },
  { key: "pwa", label: "PWA", aliases: ["PWA", "pwa"] },
  { key: "windows-desktop", label: "Windows Desktop", aliases: ["Windows Desktop", "windows-desktop", "Windows"] },
  { key: "linux", label: "Linux", aliases: ["Linux", "linux", "Shared Linux hosting"] },

  // ---- tooling ----
  { key: "github-actions", label: "GitHub Actions", aliases: ["GitHub Actions", "github-actions", "GitHub Actions CI"] },
  { key: "docker", label: "Docker", aliases: ["Docker", "docker"] },
  { key: "git", label: "Git", aliases: ["Git", "git"] },
  { key: "gradle", label: "Gradle", aliases: ["Gradle", "gradle"] },
  { key: "playwright", label: "Playwright", aliases: ["Playwright", "playwright"] },
  { key: "vitest", label: "Vitest", aliases: ["Vitest", "vitest"] },
  { key: "npm", label: "npm", aliases: ["npm", "NPM"] },
  { key: "composer", label: "Composer", aliases: ["Composer", "composer"] },
  { key: "rest-api", label: "REST APIs", aliases: ["REST APIs", "REST API", "rest-api", "API design"] },

  // ---- concepts that behave like technologies in this portfolio ----
  { key: "service-worker", label: "Service Worker", aliases: ["Service Worker", "service-worker"] },
];

/** key -> definition */
export const TECHNOLOGIES: Record<string, TechnologyDefinition> = Object.fromEntries(
  DEFINITIONS.map(definition => [definition.key, definition]),
);

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** alias (normalized) -> canonical keys */
const ALIAS_INDEX: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const definition of DEFINITIONS) {
    for (const alias of [definition.label, ...definition.aliases]) {
      const normalized = normalize(alias);
      const existing = index.get(normalized) || [];
      if (!existing.includes(definition.key)) index.set(normalized, [...existing, definition.key]);
    }
  }
  return index;
})();

/**
 * A combined token names more than one technology. These are spelled out rather
 * than split on a separator, because "Tailwind CSS" and "lftp / FTPS" would both
 * be mangled by a naive split.
 */
const COMBINED: Record<string, string[]> = {
  "c# / .net": ["csharp", "dotnet"],
  "c#/.net": ["csharp", "dotnet"],
  "qt / qml": ["qt", "qml"],
  "qt/qml": ["qt", "qml"],
  "nuxt / vue": ["nuxt", "vue"],
  "nuxt/vue": ["nuxt", "vue"],
  "laravel / php": ["laravel", "php"],
  "laravel/php": ["laravel", "php"],
  "html-css-javascript": ["html", "css", "javascript"],
};

/**
 * Canonical keys for one source token. Returns an empty array when the token is
 * not a technology, which is the common case for descriptive concepts.
 */
export function canonicalKeys(token: string): string[] {
  if (!token) return [];
  const normalized = normalize(token);
  if (COMBINED[normalized]) return COMBINED[normalized];
  return ALIAS_INDEX.get(normalized) || [];
}

/** Canonical keys for many tokens, de-duplicated and order-stable. */
export function canonicalKeysFor(tokens: (string | null | undefined)[]): string[] {
  const keys: string[] = [];
  for (const token of tokens) {
    for (const key of canonicalKeys(token || "")) if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Human-readable label for a canonical key. */
export function technologyLabel(key: string): string {
  return TECHNOLOGIES[key]?.label || key;
}

/** True when a source token names this canonical technology. */
export function tokenMatchesTechnology(token: string, key: string): boolean {
  return canonicalKeys(token).includes(key);
}

/** Every canonical key, sorted by display label. */
export function allTechnologyKeys(): string[] {
  return Object.keys(TECHNOLOGIES).sort((a, b) => technologyLabel(a).localeCompare(technologyLabel(b)));
}
