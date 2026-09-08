# osameh.dev

![osameh.dev social cover](frontend/public/og-cover-social.jpg)

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
- Ranked Command Palette search integrated into the IDE command surface, with one visible header action and one `Ctrl/Cmd + Shift + P` shortcut
- English-only product interface with a fixed `lang="en"` / `dir="ltr"` document contract
- Context-aware custom context menu and IDE-style ranked Command Palette
- Interactive terminal with the backtick (`) shortcut, autofocus, resize/maximize support, and developer commands
- Built-in resume viewer and packaged PDF CV
- Installable PWA with offline shell and service worker
- Secure contact form with same-origin checks, CSRF protection, honeypot validation, rate limiting, and server-verified Google reCAPTCHA v3
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

Project identity renders immediately from the checked-in portfolio fallback. Public repositories and live metrics then refresh progressively from the GitHub API and are sorted by recent activity. Archived repositories and the GitHub profile repository are excluded.

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
Ctrl/Cmd + Shift + P   Command Palette
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

- Node.js >=20.19.0 or >=22.12.0
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

`/sitemap.xml` is generated dynamically from the current public GitHub repositories, Engineering Notes, and case-study manifest, with a checked-in static sitemap retained as a fallback. It lists only independently indexable documents: homepage, Project details, Note details, and Case Study details. Application section deep links remain functional but canonicalize to the homepage and therefore stay out of the sitemap.

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

Notes are stored as Markdown under `frontend/public/notes-content/` and indexed by `frontend/public/notes-index.json`. The index renders notes in batches of six as the library grows. Each article provides reading time, tags, deep links, a scroll-synchronized table of contents with active-section state, copyable code blocks, and sharing. Notes are also discoverable from Command Palette and Terminal (`notes`, `notes <text>`, `cat note <slug>`).

On tablet and mobile, the table of contents becomes a sticky horizontal navigation strip instead of disappearing. Returning from an article restores the Engineering Notes index at its section anchor.

## v5 product layer

Version 5.0.0 expands the portfolio with four product-facing capabilities built on top of the 4.2.2 IDE shell and semantic theme system:

- **Freelance / Client Case Studies** — public, verifiable client work is separated from capability cards. The first published case study is **Amorella Beauty** (`https://amorellabeauty.ir/`); three experience-backed capability areas describe the kinds of systems I can build without presenting them as named client projects.
- **Portfolio Mood / Availability Control** — one central availability configuration drives the header status, recruiter-facing availability details, Terminal/Search metadata, and contact CTA.
- **Accessibility Control Center** — persistent reduced-motion, increased-contrast, larger-text, and enhanced-focus preferences with OS reduced-motion support.
- **Ranked search** — the IDE Command Palette ranks navigation, projects, notes, case studies, skills, experience, and settings instead of relying on raw substring filtering.

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

The active profile controls the header badge, Availability modal, Terminal/Command Palette status, CTA visibility, description, opportunity types, work modes, and timezone from the same config. To see all presets locally, run `npm run mood:list`. Legacy commands `open-selective` and `limited` are accepted as aliases for `selective` and `focused`. Every generated `build-info.json` also exposes `availabilityMood`, so staging/production can be checked to confirm which mood is actually deployed.

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
│   └── recaptcha.php        (internal include, refused over the web)
├── notes-content/
├── notes-index.json
├── case-studies-index.json
├── case-study.php
├── icons/
├── resume/
├── og-cover-social.jpg
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

The **six most recent releases** are summarized here. See **[CHANGELOG.md](docs/CHANGELOG.md)** for the complete production history. This section is intentionally capped at six releases.

### v5.3.0 — Vanta

- Separated **frontend** and **backend** source trees, reorganized the frontend by feature, and decomposed the largest mixed-responsibility modules. The deploy artifact and every public URL are unchanged.
- Added **Previous / Next** navigation between Engineering Notes, ordered by the same authoritative Notes list the index renders, as real crawlable `/notes/{slug}` links that still open as editor tabs.
- Added **Google reCAPTCHA v3** to server-side contact submission: a fresh token per attempt, generated at submit time, verified server-side for success, action, hostname and score.
- Environment-specific public site keys are selected by exact hostname; an unknown host gets no configuration rather than production. Private secrets stay server-side and never enter the repository or a build.
- Rate limiting, the exact origin allowlist, the strict CSP, and the Service Worker `/api/*` network-only rule are unchanged.

### v5.2.3 — Cipher

- Fixed double URL-encoding of GitHub README asset paths, which returned HTTP 404 for filenames containing spaces or existing percent escapes.
- Stopped rewriting third-party `raw.githubusercontent.com` assets onto this repository; well-formed raw URLs keep their own owner, repository and ref.
- Added idempotent, segment-safe path normalization covering Unicode, reserved characters, malformed escapes, and encoded slashes.

### v5.2.2 — Cipher

- Added crawlable native links for Projects, Engineering Notes, and the Amorella Beauty Case Study while preserving SPA/editor-tab behavior; **Explore my work** now consistently opens Projects.
- Aligned sitemap membership with independent canonical documents and clarified WebSite structured-data identity.
- Improved native semantics, heading order, targeted contrast, and the hero status animation.
- Decoupled core project rendering from live GitHub metadata; SSR/prerendering remains deferred pending Search Console evidence.

### v5.2.1 — Cipher

- Build Information now reports the runtime environment only once it is known, instead of briefly showing production while the metadata request is still in flight or after it fails.
- HSTS is owned solely by the CDN edge, removing a duplicate header on error responses.
- Staging and production run from separate document roots with directory-scoped deployment credentials.
- Added guards preventing an origin HSTS directive and a fabricated environment label from returning.

### v5.2.0 — Cipher

- New **Neural Cipher** visual identity across the header, favicons, Apple touch icon, PWA install icons, and the Resume Viewer.
- Release codenames under the **Cyber Noir** theme. Starting with 5.2, each official major/minor family receives one codename, so every 5.2.x patch is Cipher. The version and codename appear in the status bar, Build Information, and Terminal.
- Refreshed social sharing artwork.
- Editor tabs now scroll the active tab into view on narrow screens instead of leaving it off-strip.

### v5.1.1 — Editor tabs, Source Explorer, Service Worker, 404 & mobile tour hotfix

- Hardened GitHub repository path normalization so dot-prefixed directories stay previewable while traversal, absolute paths, and protocol injection remain blocked.
- Source Explorer now recovers from a failed or stale file request: the tree stays usable, the failure is shown inline with a retry, and a late response can no longer replace the file you selected.
- Fixed the Service Worker `Response.clone()` failure and kept `/api/` responses out of the cache entirely.
- Made the Recruiter Mode tour fully usable on 320-412px mobile viewports.
- Unknown URLs return a real HTTP 404 while keeping the custom IDE 404 UI.
- Unified the editor-tab lifecycle: projects and Engineering Notes coexist as independent tabs, selecting Home no longer closes them, closing a tab activates the one to its left, and returning Home restores the section that tab came from.
- Closing a project returns to the Projects section.
- The build-information panel reports the environment it is actually running in.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime architecture — request path, routing and the true-404 contract, CDN contracts, GitHub proxy, Service Worker, shared modal foundation |
| [`docs/CI-CD.md`](docs/CI-CD.md) | CI/CD pipeline reference — workflow inputs, step ordering, artifact phases, indexing contracts, quality gates, deployment gating |
| [`docs/TESTING.md`](docs/TESTING.md) | What each command verifies, local vs CI vs staging boundaries, Playwright coverage, staging acceptance checklist |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Hosting, CDN, DNS, FTPS credentials, 404 behavior, smoke tests, operational troubleshooting |
| [`docs/PROJECT-UNDERSTANDING.md`](docs/PROJECT-UNDERSTANDING.md) | Feature-level onboarding — application structure, feature layers, fragile areas, current priorities |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Full release history. README summarizes only the six latest releases |

## License

Choose and add a license before publishing if you want to explicitly define reuse rights. Until a license is included, normal copyright rules apply to the source code and visual design.

## Continuous deployment

CI/CD uses three separate responsibilities instead of mixing build/test/deploy credentials:

1. `.github/workflows/quality.yml` — reusable **secret-free** quality gate: repository validation → TypeScript/PHP → one indexable build → bundle verification → Playwright → Lighthouse → environment packaging and indexing-policy verification → verified artifact.
2. `.github/workflows/staging.yml` — runs only for `develop`, waits for the quality job, then deploys the verified staging artifact with staging-only credentials.
3. `.github/workflows/deploy.yml` — runs only for `main`, waits for the quality job, then deploys the verified production artifact with production-only credentials.

The application is built **once** as a normal indexable bundle, and every check runs against it. Environment indexing policy is applied afterwards into a separate `dist-<env>/` directory, so a strict SEO audit can never grade a deliberately non-indexable staging document. Full technical reference: [`docs/CI-CD.md`](docs/CI-CD.md).

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

See [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) for rollout, staging protection, secret setup, FTPS troubleshooting, and rollback.
