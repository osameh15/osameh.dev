// Repository shape and the checked-in fallback list. Project cards render
// from this immediately; live GitHub data is progressive enhancement.

export type GithubRepo = {
  id: number; name: string; description: string | null; language: string | null;
  topics: string[]; stargazers_count: number; forks_count: number; archived: boolean;
  updated_at: string; fork: boolean; default_branch: string;
};

export const fallbackRepos: GithubRepo[] = [
  { id: 111, name: "osameh.dev", description: "An IDE-inspired, repository-driven software engineering portfolio with secure GitHub integration and automated deployment.", language: "TypeScript", topics: ["react", "typescript", "php", "devops", "portfolio"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-09-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 101, name: "toast-notifications", description: "A beautiful, zero-dependency toast notification module for Nuxt 3 and 4.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 1, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 102, name: "confirm-dialogs", description: "Promise-based confirmation dialogs for Nuxt 3 and 4 with accessible RTL support.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 103, name: "input-dialog", description: "A clean input prompt module for fast user interactions in Nuxt applications.", language: "Vue", topics: ["nuxt", "vue", "typescript"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 107, name: "Form-Management", description: "A zero-dependency drag-and-drop form builder and renderer for Nuxt 3 and Nuxt 4.", language: "TypeScript", topics: ["nuxt", "vue", "typescript", "form-builder"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-08-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 104, name: "Mizekar", description: "A modern fullscreen Windows folder manager with full Persian language support.", language: "C#", topics: ["dotnet", "wpf", "windows"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 108, name: "YariZan", description: "A modern Persian launcher for educational mini-games for grades 1–6.", language: "C#", topics: ["dotnet", "education", "games"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-07-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 105, name: "Dialysis", description: "An Android application that helps dialysis patients with monitoring and reminders.", language: "Java", topics: ["android", "health"], stargazers_count: 2, forks_count: 0, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "master" },
  { id: 106, name: "ArappMain", description: "An Android rating and review application.", language: "Kotlin", topics: ["android", "kotlin"], stargazers_count: 2, forks_count: 1, archived: false, updated_at: "2026-04-30T00:00:00Z", fork: false, default_branch: "main" },
  { id: 109, name: "ArappMainBack-End", description: "The backend and supporting web application for the Arapp platform.", language: "PHP", topics: ["php", "backend", "web"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-03-01T00:00:00Z", fork: false, default_branch: "main" },
  { id: 110, name: "ArappOfficialSite", description: "The official web experience for the Arapp project.", language: "PHP", topics: ["php", "web"], stargazers_count: 0, forks_count: 0, archived: false, updated_at: "2026-03-01T00:00:00Z", fork: false, default_branch: "master" },
];

export const npmPackages: Record<string, string> = {
  "toast-notifications": "nuxt-toast-notification",
  "confirm-dialogs": "nuxt-confirm-dialog",
  "input-dialog": "nuxt-input-dialog",
  "Form-Management": "nuxt-form-management",
};

export const npmUrl = (repoName: string) => npmPackages[repoName]
  ? `https://www.npmjs.com/package/${npmPackages[repoName]}`
  : "";
