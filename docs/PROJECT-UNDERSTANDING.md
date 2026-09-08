# osameh.dev Project Understanding Report

**Review date:** 2026-09-08 (updated for v5.3.1)
**Repository:** `osameh.dev`
**Review scope:** Tracked application source, configuration, workflows, tests, documentation, public endpoints, generated metadata, and static-asset inventory.

This report records a read-only architectural onboarding of the repository. The repository implementation is the source of truth for subsequent engineering work.

Companion references: [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the deployed system behaves at runtime, [`CI-CD.md`](./CI-CD.md) for the delivery pipeline, and [`TESTING.md`](./TESTING.md) for what is verified where.

## 1. Detected version

The repository version is **5.3.1**, codename **Vanta** under the Cyber Noir release theme (see [`ARCHITECTURE.md`](./ARCHITECTURE.md)). It is consistent across `package.json`, `package-lock.json`, `docs/CHANGELOG.md`, `README.md`, deployment documentation, and generated build metadata.

Generated build metadata is refreshed during validation and resolves the current release as v5.3.1 · VANTA.

## 2. Current branch and worktree

The current branch is **`develop`**.

v5.3.0 was prepared from a clean worktree. The release moved every frontend and
backend source file into the new architecture described below; `git` records
those as renames, so history follows each file.

## 3. Framework and tooling

- React 19
- ReactDOM 19
- TypeScript 5.9 in strict, no-emit mode
- Vite 8 with the React plugin
- Tailwind/PostCSS 4, supplemented by extensive custom CSS
- Lucide React icons
- Marked with DOMPurify for Engineering Notes
- PHP server-side endpoints and metadata layers
- Playwright Test 1.62.1
- GitHub Actions for quality, staging, production, and Mood automation

The package manifest and lockfile are synchronized. Application state is implemented through React state, hooks, and a feature-preferences context rather than an external state library.

## 4. Application architecture

`frontend/src/app/App.tsx` is the IDE shell and orchestration layer. It owns:

- route and browser-history state
- semantic section navigation and scroll spy
- open editor tabs under one shared lifecycle (see [`ARCHITECTURE.md`](./ARCHITECTURE.md))
- project, Note, Case Study, and not-found views
- top-level panels and Outline
- Terminal and Command Palette
- contextual menus
- galleries and project comparison
- theme, font, and code-language preferences
- scroll restoration and user-intent cancellation

Its own model lives beside it rather than inside it: `app/editorTabs.ts` (the one
ordered tab collection and its closing rules), `app/sections.ts` (the semantic
page registry), and `app/workspacePreferences.ts` (theme, font, and the
language-specific sample sources).

Feature modules under `frontend/src/features/` each own one product surface:

- `home/HeroShowcase.tsx`: brand mark, animated metrics, engineering showcase
- `notes/`: Engineering Notes rendering, adjacency, markdown pipeline, TOC
- `projects/`: repository intelligence, metadata, README gallery, compare, case study
- `portfolio/PortfolioFeatures.tsx`: availability, accessibility, public client case studies, capabilities
- `contact/ContactForm.tsx`: contact submission and reCAPTCHA verification flow
- `activity/`, `changelog/`, `now/`, `resume/`: their matching portfolio sections
- `diagnostics/`: Build Information and System Health
- `workspace/`: shortcut guide and PWA install control

Shared infrastructure under `frontend/src/lib/` knows nothing about features:
`modalScroll.ts` (the shared modal foundation), `universalSearch.ts` (Command
Palette ranking), `analytics.ts`, `share.ts`, `toast.ts`, `releaseMetadata*`
(codename resolution), and `githubAssetUrlCore.*` (README asset normalization).

Repository-owned content lives in `frontend/src/data/` (`portfolioData.ts`,
`caseStudiesData.ts`), public frontend configuration in `frontend/src/config/`,
and the build fingerprint in `frontend/src/generated/build.ts`.

Application state is implemented through React state, hooks, and a
feature-preferences context rather than an external state library.

## 5. Important directories

- `frontend/`: everything the browser runs - `index.html`, static `public/` assets, and `src/` (app shell, features, lib, config, data, styles, generated)
- `backend/`: everything the server runs - `api/` endpoints, `lib/` internal includes, `seo/` metadata layers and the true 404, `server/.htaccess`, `tests/`
- `config/`: centrally managed availability and release metadata
- `scripts/`: build metadata, deployment assembly, environment packaging, Mood CLI, quality gates, verifiers
- `tests/e2e/`: Playwright regression coverage
- `.github/workflows/`: quality, staging, production, and availability workflows
- `deploy/`: private server-configuration example
- `docs/`: screenshots and engineering documentation

The frontend imports no backend source and the backend references no component;
quality gates assert both, along with the absence of the superseded `src/`,
`app/`, `public/`, `vendor/` and `tests/php/` trees.

## 6. Main UI and navigation architecture

The site is consistently implemented as an IDE/editor portfolio. Its primary shell contains:

- fixed top bar and file menu
- activity rail
- Explorer sidebar
- editor tabs
- main editor/document surface
- Outline
- bottom panel and Terminal
- status bar

The semantic page registry, Explorer, and DOM order agree:

1. Home
2. About
3. Projects
4. Case Studies
5. Experience
6. GitHub Activity
7. Now
8. Changelog
9. Engineering Notes
10. Contact

GitHub Activity participates in Explorer navigation, page state, the Command Palette, and Terminal commands. Most navigation uses semantic IDs and paths rather than brittle numeric indexes.

## 7. Theme architecture

Stylesheets load in this order:

```text
globals.css
    ↓
light-theme.css
    ↓
features-v5.css
```

Dark Theme is the base visual system. `light-theme.css` provides semantic canvas, surface, text, border, accent, modal, source-viewer, navigation, and feature overrides. System mode resolves through `prefers-color-scheme`.

Light, Dark, and System support is present across Case Studies, capabilities, availability, accessibility, Command Palette, diagnostics, project navigation, Engineering Notes, and floating UI. Because `features-v5.css` loads last and contains compatibility overrides, cascade order remains a high-risk regression boundary.

## 8. Modal and scroll architecture

`frontend/src/lib/modalScroll.ts` implements a reference-counted shared body lock. All eleven `role="dialog"` consumers route through the shared `useModalDialog` hook, which composes the lock with Escape handling, focus containment, focus return, and per-viewport geometry measurement.

The first active lock:

1. Captures the current viewport position and relevant inline styles.
2. Marks the root with `data-modal-open`.
3. Dispatches the shared modal-open event.
4. Freezes the body using fixed positioning and negative scroll offsets.
5. Hides root/body overflow.
6. Compensates the body only when the fixed workspace would otherwise lose its native scrollbar width.

The final unlock restores the prior styles and exact covered workspace position with temporary automatic scroll behavior.

`App` cancels obsolete section-restoration work on wheel, touch, pointer, and keyboard intent. Feature, advanced, Recruiter, and Command Palette surfaces keep their header/footer chrome outside a `.modal-scroll-viewport`; that viewport owns vertical scrolling and contains a `.modal-content` wrapper. Modal CSS uses internal scrolling, overscroll containment, transparent tracks, low-opacity scrollbar thumbs, stronger hover visibility, and `scrollbar-gutter: auto` rather than a permanent stable gutter.

The old global scrollbar probe was removed. `useModalDialog` measures each actual scroll viewport as `offsetWidth - clientWidth - horizontal borders`, so overlay scrollbars contribute zero and classic scrollbars reclaim only the width consumed by that viewport through `--modal-scrollbar-width`. Headers, dividers, and Recruiter progress remain edge-to-edge and never receive scrollbar compensation. Responsive caps keep modal scrolling internal on desktop, tablet, and mobile.

## 9. Engineering Notes architecture

Four Engineering Notes are registered through typed metadata and a public JSON index. Markdown is fetched at runtime, rendered with Marked, and sanitized with DOMPurify. Unsafe elements and attributes are forbidden, and external HTTPS links receive safe target/relationship attributes.

Heading IDs are generated for `h2` and `h3` elements. Desktop TOC behavior is sticky and synchronized through scroll spy. On mobile, the TOC becomes a horizontally scrollable sticky rail positioned below the top bar and editor tabs with an explicit gap.

Heading offsets account for the active sticky chrome. Manual wheel/touch movement cancels obsolete TOC navigation locks, and the active mobile TOC entry is kept visible.

Deep links, browser Back, canonical close-to-Notes behavior, code-copy actions, sharing, and Note-specific context-menu actions are implemented.

## 10. Case Study architecture

The public client case-study model contains exactly one confirmed client engagement:

- **Amorella Beauty** — <https://amorellabeauty.ir/>

The three entries under **What I can build** are stored separately as engineering capabilities and are explicitly not represented as completed client work.

Repository project-detail pages also contain engineering case-study narratives for portfolio repositories. These describe project engineering decisions and are distinct from the public freelance/client Case Study model.

Case Studies appear immediately after Projects in both the main page and Explorer ordering.

## 11. Mood and Availability architecture

`config/availability.json` is the central source of truth. It contains exactly five profiles:

- `open`
- `selective`
- `freelance`
- `focused`
- `unavailable`

The active state is **`selective`**, with the complete user-facing label **“Open to selected opportunities.”**

The full label is consumed by the header and is also represented through the Availability modal, Now content, Terminal Mood command, Command Palette, and generated build metadata.

Mood automation consists of:

- `npm run mood`
- `npm run mood:list`
- `scripts/set-availability.mjs`
- `.github/workflows/availability.yml`

The GitHub Action checks out `develop`, changes only the central configuration, runs repository quality validation, commits the config, and pushes to `develop`, which then activates staging.

## 12. Accessibility architecture

Accessibility preferences are stored in `localStorage` and projected onto root data attributes:

- Reduce Motion
- Increased Contrast
- Larger Interface Text
- Enhanced Focus Indicators

Controls use `role="switch"` and `aria-checked`. The switch track position communicates state; no checkmark is rendered inside a switch.

Effects are immediately visible through CSS. The site also independently respects the operating system’s `prefers-reduced-motion` setting. The toolbar icon uses Lucide and follows the existing theme/IDE visual language.

## 13. Command Palette architecture

Universal Search and the Command Palette are one feature. The single primary shortcut is:

```text
Ctrl/Cmd + Shift + P
```

Search ranking considers exact matches, prefixes, substrings, punctuation-neutral tokens, token coverage, and subsequence matches.

The index includes:

- page navigation
- projects and technologies
- client Case Studies and capabilities
- Engineering Notes
- skills and experience
- GitHub Activity
- availability and accessibility
- diagnostics and build information
- theme and Terminal actions
- resume, recruiter, PWA, sharing, and social commands

Keyboard handling supports arrows, Enter, and Escape, while maintaining visibility of the active result.

## 14. Context Menu architecture

Context discovery checks specific content types before generic links. Dedicated handling exists for:

- projects
- Engineering Notes
- client Case Studies
- images
- selected text
- generic links

Notes and Case Studies expose their own open, copy, share, and live-site actions. Context menus support keyboard navigation, viewport-aware positioning, and dismissal on scrolling, pointer input, resizing, and focus changes.

## 15. Terminal architecture

The Terminal is functional rather than decorative. Verified command families include:

```text
whoami        ls             exp            skills
projects      cat            contact        open
clear         activity       notes          note
case-studies  cases          case           capabilities
palette       availability   mood           mood:list
accessibility health         status         diagnostics
theme         resume         recruiter      install
shortcuts     share          version        build/system commands
```

`ls` is derived from live editor tabs rather than a static list. Backtick toggles the Terminal, opening it focuses the input, new output scrolls to the end, Tab supports completion, and Escape cooperates with active editor views.

## 16. SEO and API architecture

Apache routing sends dynamic project, Engineering Note, and Case Study URLs through PHP metadata layers. These inject appropriate titles, descriptions, canonical URLs, social metadata, and JSON-LD.

Since v5.1.1 an unknown route returns a **true HTTP 404** carrying the portfolio's own IDE-style shell, rather than the previous soft-404 that answered HTTP 200. Four handlers own this — `not-found.php`, `note.php`, `case-study.php`, and `project.php` — and each returns 404 only where authoritative data proves the route invalid. Routing is an internal Apache rewrite, never a redirect, so the browser keeps the original URL. 404 responses carry `no-store`; valid dynamic routes keep their normal cache policy. This depends on the ParsPack CDN setting **Show origin server errors**, which is enabled.

Server endpoints provide:

- GitHub repositories, activity, metrics, metadata, README, source tree, and file content
- application health diagnostics
- privacy-preserving analytics counters
- contact-form processing
- project social images
- dynamic sitemap generation

The GitHub source endpoint filters dependency/build trees, environment and secret-oriented paths, traversal attempts, binary content, and oversized files.

The GitHub API token is read only from environment or private server-side configuration outside the public frontend. It is never moved into a Vite variable or frontend bundle. Contact and analytics endpoints apply method, origin, input, rate-limit, and privacy controls.

## 17. Staging architecture

A push to `develop` invokes the reusable quality workflow in staging mode. Deployment runs only after the quality job succeeds and downloads that job’s tested artifact.

Staging preparation runs `scripts/package-env.mjs staging` **after** all application validation, deriving `dist-staging/` from the tested `dist/` rather than mutating it:

- injects `noindex,nofollow,noarchive`
- installs a disallowing `robots.txt` carrying no `Sitemap:` line
- applies a global `X-Robots-Tag` to the first `mod_headers` block, leaving the `.md`-scoped rule intact
- removes production canonical/`og:url` metadata
- stamps `environment: staging` into `build-info.json`
- `scripts/verify-env.mjs staging` (`npm run verify:staging`) then fails the pipeline if any of the above is missing, before an artifact exists

Deployment targets `staging.osameh.dev` and uses only:

- `STAGING_FTP_HOST`
- `STAGING_FTP_PORT`
- `STAGING_FTP_USERNAME`
- `STAGING_FTP_PASSWORD`
- `STAGING_FTP_CERT_FINGERPRINT`

There is no production-secret fallback.

## 18. Production architecture

A push to `main`, excluding documentation-only changes, or a manual dispatch invokes the production quality pipeline. Production deployment runs only after that quality job succeeds and consumes its tested artifact.

Production packaging runs `scripts/package-env.mjs production`, which derives `dist-production/` from the same tested `dist/` and applies no indexing policy at all. `scripts/verify-env.mjs production` (`npm run verify:production`) then asserts the inverse contract — indexable robots meta, no site-wide `Disallow: /`, no inherited global `X-Robots-Tag` noindex, a production canonical and `og:url`, and a valid sitemap — so a staging transform leaking into production fails CI before deployment.

Production remains indexable, targets `osameh.dev`, and uses only:

- `FTP_HOST`
- `FTP_PORT`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_CERT_FINGERPRINT`

There is no staging-secret fallback.

## 19. GitHub Actions workflow graph

`.github/workflows/quality.yml` runs for pull requests targeting `develop` or `main`, by manual dispatch, and as a reusable workflow.

The full technical reference for the pipeline — inputs, step order, artifact strategy, indexing contracts, deployment gating and local gaps — is [`CI-CD.md`](./CI-CD.md).

Its effective order is:

```text
Install dependencies
    ↓
Repository quality gates
    ↓
TypeScript
    ↓
PHP lint
    ↓
Build (one indexable application bundle)
    ↓
Verify dist
    ↓
Playwright
    ↓
Lighthouse (strict SEO against the indexable build)
    ↓
Package dist-<env>/ and verify its indexing policy
    ↓
Upload verified environment artifact
```

The workflow takes a `deploy_env` input (`staging` or `production`) that selects only the packaging/verification phase. It no longer takes a build mode: the build itself is identical for every environment, which is what keeps the Lighthouse SEO category measuring the real application. Applying the staging noindex transform before the audit made `is-crawlable` fail and dropped the SEO category to 63 while the application itself scored 100.

`.github/workflows/staging.yml` and `.github/workflows/deploy.yml` explicitly require successful quality jobs before deployment. `.github/workflows/availability.yml` updates Mood through `develop` and therefore the staging path.

## 20. Testing architecture

The Playwright suite contains **76 tests** in `tests/e2e/portfolio.spec.ts`.

Coverage includes:

- primary and deep-link routing
- Engineering Notes TOC and repeated navigation
- browser Back and close behavior
- Case Study routes and restoration
- modal scroll restoration
- accessibility persistence and immediate effects
- Mood state and full-label rendering
- Command Palette ranking and shortcut behavior
- mobile Gallery selection and visibility
- Light Theme surfaces
- contextual menus
- header control sizing
- modal gutter symmetry
- GitHub Activity ordering
- diagnostics and project comparison
- responsive layout behavior

Playwright is a pinned project dependency. CI invokes the repository installation and installs its matching browser rather than relying on an unrelated ephemeral Playwright package.

## 21. Quality gates

`scripts/quality-gates.mjs` enforces architectural and product contracts including:

- valid availability profiles and update workflow
- English-only application UI
- Engineering Note and client Case Study metadata
- SEO and route-support files
- README’s maximum of six releases
- GitHub Activity ordering
- one Command Palette shortcut
- dedicated Note and Case Study context-menu behavior
- required Terminal feature coverage
- header sizing and modal scrollbar contracts
- absence of stable scrollbar gutters
- complete availability text in the header
- deterministic modal scroll restoration
- exact project-owned Playwright dependency
- staging/production secret separation
- deployment only after E2E and Lighthouse
- workflow step order: build → E2E → Lighthouse → environment packaging → artifact upload
- no environment-specific build mode may reappear ahead of the SEO audit
- packaging derives `dist-<env>/` and never mutates the tested `dist/`
- staging packaging applies noindex; production packaging never does
- the deploy artifact upload preserves hidden files so `.htaccess` survives
- Service Worker clones before body consumption and never caches `/api/` responses

The quality script performs structural JSON checks but is not a complete JSON-Schema validator. It also does not provide generic YAML parsing or a standalone secret scanner; PHP lint and other checks are separate CI steps.

## 22. Release and documentation rules

`README.md` currently lists exactly six releases:

1. 5.2.2
2. 5.2.1
3. 5.2.0
4. 5.1.1
5. 5.1.0
6. 5.0.0

The complete release history remains in `docs/CHANGELOG.md`. The quality gate enforces the six-release README maximum.

Release notes are expected to describe user-visible differences from the previous published version, excluding temporary debugging, failed experiments, intermediate CI failures, and pre-release behavior that users never received.

## 23. Fragile and regression-prone areas

- Shared modal locking, focus, restoration, and per-viewport geometry across eleven consumers
- Mobile project quick-access end detection after asynchronous content changes
- Engineering Notes offsets across the top bar, editor tabs, and mobile TOC
- Manual SPA history combined with PHP/CDN deep-link routing
- Light Theme override coverage and stylesheet cascade order
- Context-menu specificity
- Per-viewport scrollbar measurement and modal edge-to-edge chrome
- Header control sizing at responsive breakpoints
- Generated build metadata and PWA cache consistency

## 24. Contradictions and suspicious implementation

### Resolved since the original review

All six discrepancies recorded in the first review have been fixed and verified:
`/activity` is present in the Apache rewrite list as an application deep link; the contact
origin allowlist includes `https://staging.osameh.dev`; the Gallery context action
and the diagnostics test selector both target the rendered identifiers; the Mood
CLI distinguishes preset, short label and public header label; and the documented
Node.js floor matches Vite 8.

### Resolved in v5.1.1

- The Service Worker cloned a response inside the `caches.open()` callback, after
  the body had been handed to the browser, producing an unhandled
  `Failed to execute 'clone' on 'Response'`. The clone is now taken synchronously
  and cache failures are contained.
- Unknown routes answered HTTP 200 with a 404 body. They now return a real 404.
- The Recruiter Mode tour panel sized itself from the viewport while its backdrop
  inset it by its own padding, so it overflowed its container on narrow screens
  and the footer pushed the Next button off-screen at 320px.
- A slow or failed Source Explorer request could overwrite a newer file selection.

### Corrected diagnosis worth recording

The Source Explorer outage was **not** an application path-validation bug. Every
file request failed identically — including `frontend/src/app/App.tsx` and `package.json` —
because the edge cache stripped client query strings, so `$_GET['path']` arrived
empty. `.idea/`-prefixed paths were never rejected by the validator: the traversal
pattern only ever matched a segment equal to `..`. The fix was an external CDN
configuration change; the code changes in v5.1.1 are defensive hardening
(segment-based normalization, no double-decoding) and stale-request recovery.

### Standing risks

- Focus trapping and Escape handling are consistent in central feature dialogs but
  are not uniformly implemented by every older advanced modal.
- Production live-build verification warns rather than fails when CDN content
  remains stale after its retries.
- The quality script performs partial contract checks rather than complete
  JSON-Schema validation.
- `vite preview` runs no PHP and no `.htaccess`, so the 404 status contract, every
  `/api/*` endpoint, and CDN behavior are staging-only acceptance checks.
- Source Explorer availability depends on the edge preserving client query
  strings. That is external configuration and can regress silently.

## 25. v5.3.0 Vanta additions

**Architecture.** Frontend and backend are separate source trees assembled into
the same deploy artifact. The public runtime contract is unchanged: `dist/`
mirrored into the document root, APIs at `/api/...`. `AdvancedUI.tsx` was
decomposed into eleven feature modules, and App's module-scope model moved into
`app/` and `features/`. Backend includes live in `backend/lib/`, are published
beside the endpoint that requires them, and are refused over the web.

**Adjacent Engineering Notes.** Every Note links to its neighbours, ordered by
the same authoritative `engineeringNotes` array the index renders, as real
crawlable anchors handed to the shared editor-tab lifecycle. Ends render no
control at all rather than a disabled one.

**Contact verification.** Google reCAPTCHA v3 protects the server-side contact
submission. Public site keys are selected by exact hostname with no production
fallback; private secrets stay outside the repository; the server verifies
success, action, hostname and score and fails closed on every rejection path;
rate limiting, CORS, CSP strictness and the Service Worker `/api/*` rule are
unchanged.

## 26. v5.3.1 Vanta additions

**Configuration.** `backend/lib/config.php` is the single environment and
private-path resolver. One candidate path per environment, no `$HOME` lookup, no
cross-environment fallback, and fail-closed silence on anything missing or
malformed.

**Health.** `/api/health` reports contact-protection readiness and GitHub
authentication as booleans, Contact depends on verification readiness, and both
deployments gate on the result.

**Navigation.** Project, Note and Case Study cards navigate from their whole
surface through a stretched primary link, with secondary controls preserved.

**Search readiness.** A stable root favicon from the approved artwork declared in
the initial HTML, plus metadata, sitemap and legacy-placeholder guards. Search
Console stays manual and SSR/prerendering stays deferred.

## 27. Current engineering priorities

1. Complete the v5.2.0 staging acceptance pass: release identity, Neural Cipher
   assets, active-tab auto-scroll, plus the mature 404, Source Explorer, Service
   Worker, and Recruiter Mode contracts.
2. Keep Lighthouse pointed at the indexable build; never let environment packaging
   move ahead of it. See [`CI-CD.md`](./CI-CD.md).
3. Audit the remaining older advanced modals for consistent focus trapping,
   Escape handling, and scroll restoration.
4. Consider making the Source Explorer file endpoint path-encoded so it no longer
   depends on edge query-string handling.
5. Keep future changes routed through the existing navigation, theme, modal, and
   configuration systems.

## Dependency and feature flow

```text
App
├── IDE Shell
│   ├── Top Bar / Header Controls
│   ├── Activity Bar
│   ├── Explorer
│   ├── Editor Tabs
│   ├── Outline
│   ├── Bottom Panel / Terminal
│   └── Status Bar
├── Navigation / History / Scroll Spy
├── Projects
│   ├── GitHub Metadata and Metrics
│   ├── Architecture / Source Explorer
│   └── Gallery / Mobile Quick Access
├── Case Studies
│   ├── Amorella Beauty
│   └── Capabilities: What I Can Build
├── GitHub Activity
├── Engineering Notes
├── Availability / Mood
├── Accessibility
├── Command Palette
├── Context Menus
├── Terminal
└── Shared UI
    ├── Theme
    ├── Modal Scroll Lock
    ├── Responsive Layout
    └── PWA / Build Metadata
```

## Delivery flow

```text
feature/*
   ↓ pull request
develop
   ↓ quality / TypeScript / PHP / build / E2E / Lighthouse
staging.osameh.dev
   ↓ manual verification and develop → main
main
   ↓ quality / TypeScript / PHP / build / E2E / Lighthouse
osameh.dev
```

## Onboarding validation record

- **Passed:** `npm run quality`
- **Passed:** `npm run typecheck`
- **Passed:** `git diff --check`
- **Not run:** PHP lint because PHP was unavailable in the onboarding environment
- **Not run:** build, Playwright, and Lighthouse because onboarding was intentionally read-only and the worktree already contained generated/build-related changes

Repository onboarding complete. The codebase is ready for the next engineering task.
