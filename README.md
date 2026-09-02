# osameh.dev

![osameh.dev social cover](public/og-cover-social.jpg)

A production portfolio for **Osameh Irandoust**, designed as an IDE-inspired workspace rather than a conventional résumé page. The site combines a static React/Vite frontend with a small PHP backend for GitHub data, contact delivery, analytics, dynamic social cards, and shared-hosting integration.

**Live:** https://osameh.dev

## Highlights

- Responsive IDE-style interface with dark and light themes
- Custom interactive engineering showcase on the home screen with subtle pointer parallax, animated metrics, live build rhythm, and language-aware stack context
- Dynamic public GitHub repositories, README rendering, repository metadata, and project galleries
- Repository-owned `portfolio.json` metadata with a published JSON Schema
- Featured-project shortlist and guided Recruiter Mode
- Per-project architecture viewer and same-origin public source explorer
- Live project metrics with language percentages, license, repository size, update signals, and latest release data
- Metadata-driven project case studies, search, technology filters, sorting, and two-project comparison
- Published freelance/client case studies with deep links and crawler metadata, plus a separate “What I can build” capability layer
- Central availability status surfaced in the header and Terminal, driven by one config file with five preset states and an optional manual GitHub Actions updater
- Accessibility Control Center with persistent motion, contrast, text-size, and focus preferences
- Ranked Universal Search integrated into the IDE command surface, with a visible header action and `Ctrl/Cmd + Shift + P` shortcut
- English-only product interface with a fixed `lang="en"` / `dir="ltr"` document contract
- Context-aware custom context menu and IDE-style Universal Search palette
- Interactive terminal with the backtick (`) shortcut, autofocus, resize/maximize support, and developer commands
- Built-in resume viewer and packaged PDF CV
- Installable PWA with offline shell and service worker
- Secure contact form with same-origin checks, CSRF protection, honeypot validation, and rate limiting
- Dynamic Open Graph metadata and per-project social preview cards
- Privacy-friendly aggregate analytics without cookies or visitor identifiers
- Build fingerprints and diagnostics for CDN/deployment troubleshooting
- CDN-friendly immutable asset caching with no-store handling for dynamic APIs

## Screenshots

Production screenshots are committed under `docs/img/` and render directly on GitHub.

<table>
  <tr>
    <td><img src="docs/img/home-dark.webp" alt="Dark portfolio workspace" /></td>
    <td><img src="docs/img/home-light.webp" alt="Light portfolio workspace" /></td>
  </tr>
  <tr>
    <td><img src="docs/img/projects.webp" alt="Projects explorer" /></td>
    <td><img src="docs/img/project-detail.webp" alt="Project detail and README preview" /></td>
  </tr>
  <tr>
    <td><img src="docs/img/project-gallery.webp" alt="Project gallery" /></td>
    <td><img src="docs/img/compare-projects.webp" alt="Project comparison modal" /></td>
  </tr>
  <tr>
    <td><img src="docs/img/context-menu.webp" alt="Custom context menu" /></td>
    <td><img src="docs/img/command-palette.webp" alt="Command Palette" /></td>
  </tr>
  <tr>
    <td><img src="docs/img/terminal-neofetch.webp" alt="Resizable terminal with neofetch output" /></td>
    <td><img src="docs/img/changelog.webp" alt="In-site changelog" /></td>
  </tr>
  <tr>
    <td><img src="docs/img/contact-form.webp" alt="Contact form" /></td>
    <td><img src="docs/img/mobile.webp" alt="Responsive mobile experience" /></td>
  </tr>
</table>

## Architecture

```text
Browser / PWA
      │
      ▼
ParsPack CDN
      │
      ▼
Shared Linux Hosting
      │
      ├── React + Vite static frontend
      │     ├── portfolio UI
      │     ├── project explorer
      │     ├── portfolio.json metadata views
      │     ├── recruiter mode / featured projects
      │     ├── case studies + architecture viewer
      │     ├── source explorer
      │     ├── gallery / lightbox
      │     ├── Command Palette
      │     ├── terminal
      │     └── resume / diagnostics
      │
      └── PHP endpoints
            ├── GitHub proxy + origin cache
            ├── portfolio metadata / source tree / source file APIs
            ├── contact form
            ├── aggregate analytics
            ├── dynamic project metadata
            └── dynamic project OG cards
                  │
                  ▼
              GitHub REST API
```

The frontend never receives the GitHub token. API authentication stays server-side and the browser communicates with same-origin endpoints under `/api/`.

## GitHub integration

Public repositories are loaded dynamically from the GitHub API and sorted by recent activity. Archived repositories and the GitHub profile repository are excluded.

For each project the portfolio can load:

- repository metadata and topics
- README content
- a sanitized Markdown preview
- repository images and screenshots
- recent public GitHub activity
- project-specific social metadata

The gallery scans image files across the authored repository tree, including root-level images and folders such as `images/`, `docs/`, `screenshots/`, `media/`, and `assets/`. Generated/dependency directories such as `node_modules`, `vendor`, `dist`, `build`, `bin`, `obj`, and coverage/cache folders are ignored.

Repository images referenced with relative Markdown paths are normalized to the correct raw GitHub URL. This includes forms such as:

```text
./docs/Screenshots/main.png
/docs/Screenshots/main.png
Images/splash_screen.jpg
/Images/splash_screen.jpg
```

README HTML is rendered with `marked` and sanitized with DOMPurify before being inserted into the page.

### Repository-owned portfolio metadata

Each public project can include a `portfolio.json` file at the repository root. The canonical schema lives in this repository as [`portfolio.schema.json`](portfolio.schema.json). The portfolio reads this metadata through the same-origin GitHub proxy and uses it to drive:

- featured-project ordering
- Recruiter Mode headlines and talking points
- project type, lifecycle, ownership, responsibilities, and stack
- structured case studies
- architecture nodes and relationships
- Source Explorer entry points, exclusions, and file-size limits
- SEO metadata

If a repository does not publish valid metadata, the site falls back to GitHub repository data and the project remains usable.

### Architecture and source exploration

Project pages can render an architecture map directly from `architecture.nodes` and `architecture.edges` in `portfolio.json`. The public Source Explorer uses three same-origin endpoints:

```text
GET /api/github/meta/{repo}
GET /api/github/tree/{repo}
GET /api/github/file/{repo}?path=...
```

The backend validates the repository against the public portfolio repository set, applies repository-owned Source Explorer exclusions, ignores dependency/build trees, limits previewable file size, rejects binary files, and keeps the GitHub token server-side. Source files remain public GitHub content; the proxy exists for a consistent same-origin workspace and controlled rendering policy.

## Public repository behavior

This source tree is safe to publish **only after confirming that no secrets have ever been committed to Git history**.

This portfolio repository is public and participates in the same repository-driven project pipeline as the other projects.

- GitHub exposes the complete source tree through the repository itself.
- `osameh.dev` discovers the repository through the existing GitHub integration.
- Its root `portfolio.json` drives structured metadata, architecture, recruiter content, and source-explorer policy.
- Its README and committed screenshots can be rendered inside the portfolio.
- The Source Explorer renders previewable public text/source files inside the IDE workspace while GitHub remains the authoritative complete source browser.
- Generated/dependency trees and oversized/binary files are intentionally excluded from the in-site explorer.

## Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4 utilities / existing custom design system
- Lucide icons
- `marked`
- DOMPurify

### Backend / hosting

- PHP 8+
- Apache / `.htaccess`
- ParsPack shared hosting
- ParsPack CDN
- GitHub REST API

### Browser features

- Web App Manifest / PWA install
- Service Worker
- Web Share API with clipboard fallback
- Clipboard API
- IntersectionObserver
- History API / deep project URLs
- keyboard-first navigation

## Terminal

The terminal opens with the existing backtick (`) shortcut and focuses the command field immediately.

Useful commands:

```text
help
whoami
neofetch
ls
exp
skills
projects
case-studies
activity
availability
accessibility
cat <repo>
contact
open <service>
search <text>
version
build
resume
recruiter
now
changelog
status
install
shortcuts
share <repo>
hire
clear
```

Press `Tab` to autocomplete a command, repository name, service destination, or technology search. Keep pressing `Tab` to cycle forward through matching suggestions; `Shift+Tab` cycles backward. Terminal search and the Command Palette both index repository-owned `portfolio.json` stack metadata, so terms such as `Docker` and `WPF` can resolve directly to relevant projects and filters.

`version` prints the deployed version in the terminal. `build` opens the build-information modal.

The terminal panel can be vertically resized by dragging its top handle, maximized/restored from the panel controls, or maximized by double-clicking the resize handle.

## Keyboard navigation

```text
Ctrl/Cmd + Shift + P   Universal Search
`              Toggle terminal
G then H       Home
G then A       About
G then P       Projects
G then E       Experience
G then N       Now
G then C       Contact
/              Focus project search
?              Keyboard shortcuts
Esc            Close active modal/tab
```

Command Palette keyboard selection automatically follows the active item while scrolling through long result lists.

## Notifications

User-facing operational feedback is routed through a shared toast system with separate visual states for:

- success
- information
- warning
- error

This includes contact submission results, clipboard failures, connectivity changes, PWA installation feedback, unavailable GitHub activity, and invalid terminal actions.

## Contact form

`POST /api/contact` provides the production contact endpoint. Protection includes:

- same-origin validation
- `Sec-Fetch-Site` checks
- CSRF token/cookie validation when available
- honeypot field
- server-side input validation
- IP-based rate limiting
- no-store response headers

The file label shown in the contact section follows the selected code language, for example `send-message.ts`, `SendMessage.cs`, `send_message.py`, or `send-message.php`.

## Secrets

Never put the GitHub token inside `public_html`, frontend environment variables, JavaScript bundles, or the Git repository.

Recommended production layout:

```text
domains/osameh.dev/
├── private/
│   └── osameh-portfolio-secrets.php
├── public_html/
│   └── production build
└── private_html -> public_html
```

Example private secret file:

```php
<?php

return [
    'GITHUB_TOKEN' => 'github_pat_xxxxxxxxx',
];
```

A read-only fine-grained token scoped to public repository contents is sufficient for the current integration.

## Development

Requirements:

- Node.js 20+
- npm
- PHP 8+ for local API testing

Install dependencies:

```bash
npm install
```

Run the frontend development server:

```bash
npm run dev
```

Create the production build:

```bash
npm run build
```

Run the browser regression suite locally:

```bash
npm run test:e2e:install   # one-time Chromium + OS dependencies
npm run test:e2e
```

Playwright Test is pinned as a project devDependency, so local and CI runs use the same test-runner version instead of downloading an ephemeral `npx playwright` CLI.

The build pipeline:

1. generates the current build ID and timestamp
2. prepares CSP metadata
3. runs TypeScript validation
4. creates the Vite production bundle
5. copies PHP/API/PWA/deployment files into `dist/`
6. finalizes the production `.htaccess`

## Dynamic SEO and discovery

Project deep links are rendered through a small PHP metadata layer before React starts. Each `/projects/<repo>` response can include repository-owned title/description data, project-specific Open Graph metadata, `SoftwareSourceCode` / `SoftwareApplication` structured data, and breadcrumbs. Engineering-note deep links receive `TechArticle` structured data. Professional case-study deep links receive privacy-safe Article/breadcrumb metadata through the same server-rendered discovery layer.

`/sitemap.xml` is generated dynamically from the current public GitHub repositories, Engineering Notes, and case-study manifest, with a checked-in static sitemap retained as a fallback.

## Staging and quality gates

Production and staging are deliberately isolated deployment channels:

```text
feature/* → develop → quality/E2E/Lighthouse → staging.osameh.dev
                                      ↓ approved promotion
                                    main → quality/E2E/Lighthouse → osameh.dev
```

`develop` uses `.github/workflows/staging.yml` and **only** the five `STAGING_FTP_*` secrets. `main` uses `.github/workflows/deploy.yml` and **only** the five production `FTP_*` secrets. Both call the reusable `quality.yml` workflow first. The deploy job cannot start until that quality job passes, and it downloads the exact `dist/` artifact that already passed build verification, Playwright E2E, and Lighthouse. The five names are intentionally asymmetric and must stay exactly as configured: staging uses `STAGING_FTP_HOST`, `STAGING_FTP_PORT`, `STAGING_FTP_USERNAME`, `STAGING_FTP_PASSWORD`, `STAGING_FTP_CERT_FINGERPRINT`; production uses `FTP_HOST`, `FTP_PORT`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_CERT_FINGERPRINT`.

The staging bundle removes canonical/OG URL metadata from the base document and forces `noindex,nofollow,noarchive` through HTML, `robots.txt`, and response headers. Production remains indexable.

Quality gates cover repository metadata, availability configuration, PHP syntax, TypeScript, deployment-bundle verification, local-link checks, browser E2E smoke, accessibility behavior, modal-scroll regressions, navigation ordering, and Lighthouse accessibility/best-practices/SEO thresholds.

## System Health Center

`/api/health` reports safe operational signals for the portfolio origin, GitHub upstream reachability, API deployment presence, notes manifest, private-cache writability, and build metadata. The Health Center combines those server checks with browser-to-origin latency, Service Worker state, client connectivity, and the deployed build fingerprint. No credentials, raw paths, visitor identifiers, or IP addresses are returned.

## Engineering Notes

Notes are stored as Markdown under `public/notes-content/` and indexed by `public/notes-index.json`. The index renders notes in batches of six as the library grows. Each article provides reading time, tags, deep links, a scroll-synchronized table of contents with active-section state, copyable code blocks, and sharing. Notes are also discoverable from Command Palette and Terminal (`notes`, `notes <text>`, `cat note <slug>`).

On tablet and mobile, the table of contents becomes a sticky horizontal navigation strip instead of disappearing. Returning from an article restores the Engineering Notes index at its section anchor.

## v5 product layer

Version 5.0.0 expands the portfolio with four product-facing capabilities built on top of the 4.2.2 IDE shell and semantic theme system:

- **Freelance / Client Case Studies** — public, verifiable client work is separated from capability cards. The first published case study is **Amorella Beauty** (`https://amorellabeauty.ir/`); three experience-backed capability areas describe the kinds of systems I can build without presenting them as named client projects.
- **Portfolio Mood / Availability Control** — one central availability configuration drives the header status, recruiter-facing availability details, Terminal/Search metadata, and contact CTA.
- **Accessibility Control Center** — persistent reduced-motion, increased-contrast, larger-text, and enhanced-focus preferences with OS reduced-motion support.
- **Universal Search** — the IDE palette opens from the header or `Ctrl/Cmd + Shift + P` and ranks navigation, projects, notes, case studies, skills, experience, and settings instead of relying on raw substring filtering. `Ctrl/Cmd + K` remains a best-effort alias where the browser does not reserve it.

Accessibility preferences are centralized in `FeaturePreferencesProvider`, while availability is driven by the repository-owned mood configuration described below.

### Changing Portfolio Mood

Availability is intentionally data-driven. The UI does not need to be edited when your status changes. The single source of truth is:

```text
config/availability.json
```

The built-in profiles are:

```text
open            Open to opportunities
selective       Open to selected opportunities
freelance       Available for freelance work
focused         Heads down — limited availability
unavailable     Not currently available
```

Change it locally with:

```bash
npm run mood -- freelance
```

Or run **Actions → Set portfolio mood** and choose a preset. The workflow commits only `config/availability.json` to `develop`; the normal staging quality/deploy pipeline then verifies the change on `staging.osameh.dev`. Production still requires the normal `develop → main` promotion.

The active profile controls the header badge, Availability modal, Terminal/Universal Search status, CTA visibility, description, opportunity types, work modes, and timezone from the same config. To see all presets locally, run `npm run mood:list`. Legacy commands `open-selective` and `limited` are accepted as aliases for `selective` and `focused`. Every generated `build-info.json` also exposes `availabilityMood`, so staging/production can be checked to confirm which mood is actually deployed.

## Deployment

Upload the **contents** of `dist/` to `public_html` rather than uploading the `dist` folder itself.

Typical production output:

```text
public_html/
├── .htaccess
├── index.html
├── assets/
├── api/
│   ├── github.php
│   ├── contact.php
│   ├── analytics.php
│   └── health.php
├── notes-content/
├── notes-index.json
├── case-studies-index.json
├── case-study.php
├── icons/
├── resume/
├── favicon.svg
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
├── sitemap.php
├── build-info.json
├── project.php
├── project-og.php
├── note.php
└── not-found.php
```

After deployment, purge the CDN cache and compare the version shown in the status bar with:

```text
https://osameh.dev/build-info.json
```

`build-info.json` is intentionally revalidated instead of being stored as a long-lived immutable asset.

## Caching and resilience

- Vite-hashed JS/CSS assets use long immutable cache lifetimes.
- HTML and build metadata revalidate quickly.
- Dynamic API routes use no-store/CDN no-store headers.
- Repository metadata is cached server-side for a short interval.
- READMEs and image discovery use longer origin caches with stale fallback.
- Embedded fallback projects keep the portfolio usable if GitHub is unavailable or rate-limited.

## Security

Production hardening includes:

- HTTPS / HSTS
- strict Content Security Policy
- anti-framing headers
- `nosniff`
- restrictive Permissions Policy
- same-origin browser API architecture
- server-side GitHub token isolation
- repository allow-listing for proxy requests
- sanitized README rendering
- contact abuse controls
- no public secret/config files

Before publishing the repository, inspect the complete Git history for credentials. Removing a token from the current working tree is not sufficient if that token was previously committed.

## Resume

The packaged CV is available at:

```text
/resume/Osameh_Irandoust_CV.pdf
```

The site also includes an in-app resume viewer and download/open controls.

## Release history

The **six most recent releases** are summarized here. See **[CHANGELOG.md](CHANGELOG.md)** for the complete production history. This section is intentionally capped at six releases.

### v5.0.0 — Portfolio product layer

- adds published freelance/client Case Studies, beginning with Amorella Beauty, plus a separate **What I can build** capability layer
- introduces a five-state **Portfolio Mood** system for availability, editable from `config/availability.json`, local npm commands, or the **Set portfolio mood** GitHub Action
- adds an Accessibility Control Center with persistent Reduce Motion, Increased Contrast, Larger Text, and Enhanced Focus preferences
- upgrades the IDE command surface into ranked Universal Search for projects, Engineering Notes, case studies, skills, experience, navigation, and settings
- adds GitHub Activity to Explorer/Outline navigation in the same sequence as the document and extends the v4.2 semantic light-theme system across every new v5 surface
- separates staging and production deployment credentials while requiring the reusable quality pipeline and tested artifact before either environment can deploy

### v4.2.2 — Light-theme regression hardening

- keeps the 4.2 semantic light-theme redesign protected by stricter Engineering Notes and primary-surface contrast regressions
- follows the 4.2.1 mobile gallery/notes restoration fixes and the 4.2.0 cross-shell light-theme redesign

### v4.2.1 — Light-theme and mobile regressions

- tightened light-theme Skills Preview contrast checks
- kept the mobile project Gallery quick-access item visible when active at the end of the document
- made Engineering Notes restoration deterministic by bypassing smooth scrolling on return

### v4.2.0 — Semantic light-theme redesign

- moved light-theme behavior into a dedicated semantic override layer loaded after the base styles
- aligned IDE shell, project intelligence, Notes, modals, compare surfaces, and interactive states with the redesigned palette
- expanded browser contrast coverage for the light-theme system

### v4.1.1 — Notes navigation stability

- restores Engineering Notes at the exact section anchor after note close and browser Back
- keeps the article TOC selected reliably across repeated clicks, smooth scrolling, and manual scrolling
- vertically centers the PWA download/install action across desktop, tablet, and mobile header layouts

### v4.1.0 — Responsive polish & notes navigation

- strengthened light-theme contrast across activity, Notes, Source Explorer, Health Center, Changelog, and modal surfaces
- Engineering Notes render six at a time and article TOC selection follows scrolling/clicks reliably
- capped large modals to a scrollable 75% viewport and added mobile project bottom navigation

**Full history:** [CHANGELOG.md](CHANGELOG.md)

## License

Choose and add a license before publishing if you want to explicitly define reuse rights. Until a license is included, normal copyright rules apply to the source code and visual design.

## Continuous deployment

CI/CD uses three separate responsibilities instead of mixing build/test/deploy credentials:

1. `.github/workflows/quality.yml` — reusable **secret-free** quality gate: repository validation → TypeScript/PHP → build → bundle verification → Playwright → Lighthouse → tested artifact.
2. `.github/workflows/staging.yml` — runs only for `develop`, waits for the quality job, then deploys the tested staging artifact with staging-only credentials.
3. `.github/workflows/deploy.yml` — runs only for `main`, waits for the quality job, then deploys the tested production artifact with production-only credentials.

The ten deployment secrets stay separated:

```text
Production                         Staging
FTP_HOST                           STAGING_FTP_HOST
FTP_PORT                           STAGING_FTP_PORT
FTP_USERNAME                       STAGING_FTP_USERNAME
FTP_PASSWORD                       STAGING_FTP_PASSWORD
FTP_CERT_FINGERPRINT               STAGING_FTP_CERT_FINGERPRINT
```

Neither deployment job falls back to credentials from the other environment. Both validate the FTPS certificate fingerprint and perform a dedicated login preflight before `mirror --reverse`. This makes a `530 Login incorrect` failure explicit: verify the username/password/host for that environment in GitHub Actions; a remote-directory mistake occurs only *after* authentication and does not produce 530.

Runtime secrets such as the GitHub API token remain server-side outside `public_html` and are never copied by CI.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for rollout, staging protection, secret setup, FTPS troubleshooting, and rollback.
