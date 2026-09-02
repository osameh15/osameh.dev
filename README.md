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
- Context-aware custom context menu and `Ctrl/Cmd + K` Command Palette
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
Ctrl/Cmd + K   Command Palette
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

Production remains tied to `main`. The `develop` branch has a dedicated `staging.yml` workflow for `staging.osameh.dev`; the staging bundle removes canonical/OG URL metadata from the base document and forces `noindex,nofollow,noarchive` through both HTML/robots and response headers.

Quality gates now cover repository metadata, PHP syntax, TypeScript, deployment-bundle verification, local-link checks, browser E2E smoke, baseline accessibility assertions, and Lighthouse accessibility/best-practices/SEO thresholds.

## System Health Center

`/api/health` reports safe operational signals for the portfolio origin, GitHub upstream reachability, API deployment presence, notes manifest, private-cache writability, and build metadata. The Health Center combines those server checks with browser-to-origin latency, Service Worker state, client connectivity, and the deployed build fingerprint. No credentials, raw paths, visitor identifiers, or IP addresses are returned.

## Engineering Notes

Notes are stored as Markdown under `public/notes-content/` and indexed by `public/notes-index.json`. The index renders notes in batches of six as the library grows. Each article provides reading time, tags, deep links, a scroll-synchronized table of contents with active-section state, copyable code blocks, and sharing. Notes are also discoverable from Command Palette and Terminal (`notes`, `notes <text>`, `cat note <slug>`).

On tablet and mobile, the table of contents becomes a sticky horizontal navigation strip instead of disappearing. Returning from an article restores the Engineering Notes index at its section anchor.

## v5 product layer

The original 15-feature roadmap is now complete. The final product layer adds:

- **Freelance / Client Case Studies** — privacy-safe, data-driven professional stories with deep links, SEO metadata, sitemap entries, and no fabricated client metrics.
- **Availability Control** — one central availability configuration surfaced in the header, Terminal, and recruiter-facing workflow.
- **English / Persian i18n** — persistent locale selection, `lang`/`dir` synchronization, localized core copy, RTL-aware layout behavior, and LTR isolation for code/repository identifiers.
- **Accessibility Control Center** — persistent reduced-motion, increased-contrast, larger-text, and enhanced-focus preferences with OS reduced-motion support.
- **Universal Search** — the existing `Ctrl/Cmd + K` palette now ranks navigation, projects, notes, case studies, skills, experience, and settings instead of relying on raw substring filtering.

These preferences share a single `FeaturePreferencesProvider` rather than separate global state systems.

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

The most recent releases are summarized here. See **[CHANGELOG.md](CHANGELOG.md)** for the complete production history.

### v5.0.0 — Roadmap complete

- completes all 15 major roadmap features with professional case studies, availability, EN/FA i18n, accessibility controls, and Universal Search
- adds case-study deep links plus server-side crawler metadata and sitemap discovery
- adds persistent language/accessibility preferences without duplicating the existing theme architecture
- upgrades `Ctrl/Cmd + K` into ranked site-wide discovery and extends Terminal integration

### v4.2.2 — Light-theme regression hardening

- keeps the 4.2 semantic light-theme redesign protected by stricter Engineering Notes and primary-surface contrast regressions
- follows the 4.2.1 mobile gallery/notes restoration fixes and the 4.2.0 cross-shell light-theme redesign

### v4.1.1 — Notes navigation stability

- restores Engineering Notes at the exact section anchor after note close and browser Back
- keeps the article TOC selected reliably across repeated clicks, smooth scrolling, and manual scrolling
- vertically centers the PWA download/install action across desktop, tablet, and mobile header layouts
- adds focused Playwright regressions for the remaining 4.1.0 navigation issues

### v4.1.0 — Responsive polish & notes navigation

- strengthened light-theme contrast across activity, Notes, Source Explorer, Health Center, Changelog, and modal surfaces
- Engineering Notes render six at a time and article TOC selection now follows scrolling/clicks reliably
- fixed note-return scroll position, Health Center incomplete-row background, and release-node selection behavior
- modals are capped to a scrollable 75vh and project quick access becomes a mobile bottom navigation rail

### v4.0.0 — Production engineering layer

- added dynamic project/note structured data and a runtime sitemap covering public repositories and engineering notes
- added `develop` → `staging.osameh.dev` delivery with explicit noindex protection
- added CI quality gates, Playwright browser smoke, accessibility checks, bundle/link validation, and Lighthouse thresholds
- upgraded System Diagnostics into a live privacy-safe Health Center backed by `/api/health`
- added Markdown Engineering Notes with deep links, TOC, code copy, share, Terminal search, and Command Palette access

### v3.1.1 — Alignment & source status polish

- aligned the changelog intro label with its adjacent explanatory copy
- fixed Source Explorer footer clipping and vertically centered language, file size, and line count
- added subtle status separators with dark/light theme support

### v3.1.0 — Interactive hero & source polish

- added subtle pointer parallax, animated counters, mini-terminal status, and language-aware Stack Surface content to the custom hero showcase
- Source Explorer gives the repository tree its own visible scroll area and shows a dedicated loading state while file content is fetched
- project quick-access rail is masked behind opaque icon pads so the vertical line never crosses through toolbar icons

### v3.0.5 — Hero showcase redesign

- replaced the generic orbit-style hero graphic with a custom engineering showcase
- added workflow, impact, stack, and build-rhythm panels tailored to the portfolio’s engineering identity
- introduced dedicated dark/light styling for the new first-screen experience

**Full history:** [CHANGELOG.md](CHANGELOG.md)

## License

Choose and add a license before publishing if you want to explicitly define reuse rights. Until a license is included, normal copyright rules apply to the source code and visual design.

## Continuous deployment

Production delivery is automated with GitHub Actions. A push to `main` runs the TypeScript/Vite production build, validates the deployment bundle, uploads `dist/` to a dedicated ParsPack `public_html` FTP account over FTPS, and checks the public `build-info.json` fingerprint after deployment.

Deployment credentials are stored as GitHub Actions repository secrets and the hosting account is scoped only to the web root. Runtime secrets such as the GitHub API token remain server-side outside `public_html` and are never copied by CI.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the required secrets and rollout procedure.
