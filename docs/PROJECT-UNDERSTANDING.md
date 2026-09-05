# osameh.dev Project Understanding Report

**Review date:** 2026-09-05 (updated for v5.1.1)
**Repository:** `osameh.dev`
**Review scope:** Tracked application source, configuration, workflows, tests, documentation, public endpoints, generated metadata, and static-asset inventory.

This report records a read-only architectural onboarding of the repository. The repository implementation is the source of truth for subsequent engineering work.

Companion references: [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the deployed system behaves at runtime, [`CI-CD.md`](./CI-CD.md) for the delivery pipeline, and [`TESTING.md`](./TESTING.md) for what is verified where.

## 1. Detected version

The repository version is **5.1.1**. It is consistent across `package.json`, `package-lock.json`, `docs/CHANGELOG.md`, `README.md`, deployment documentation, and generated build metadata.

The reviewed generated build identifies `v5.1.1-20260905T134339Z`. v5.1.1 is a hotfix release over v5.1.0.

## 2. Current branch and worktree

The current branch is **`develop`**.

At onboarding time, the worktree contained 12 pre-existing unstaged modified files:

- `docs/CHANGELOG.md`
- `README.md`
- `app/features-v5.css`
- `app/globals.css`
- `scripts/quality-gates.mjs`
- `src/App.tsx`
- `src/PortfolioFeatures.tsx`
- `src/ProjectIntelligence.tsx`
- `src/generated/build.ts`
- `src/main.tsx`
- `src/modalScroll.ts`
- `tests/e2e/portfolio.spec.ts`

These changes must be preserved and reviewed before editing overlapping areas.

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

`src/App.tsx` is the central IDE shell and orchestration layer. It owns:

- route and browser-history state
- semantic section navigation and scroll spy
- open editor tabs
- project, Note, Case Study, and not-found views
- top-level panels and Outline
- Terminal and Command Palette
- contextual menus
- galleries and project comparison
- theme, font, and code-language preferences
- scroll restoration and user-intent cancellation

Major feature modules are:

- `src/PortfolioFeatures.tsx`: availability, accessibility, public client case studies, and capabilities
- `src/AdvancedUI.tsx`: GitHub Activity, Now, changelog, diagnostics, build information, PWA, recruiter, resume, sharing, and comparison UI
- `src/ProjectIntelligence.tsx`: repository metadata, metrics, project engineering case studies, architecture, source explorer, gallery, and mobile project navigation
- `src/EngineeringNotes.tsx`: Markdown loading, sanitization, TOC, scroll spy, code copying, and sharing
- `src/projectMetadata.ts`: project metadata types, normalization, fallbacks, and loading
- `src/portfolioData.ts`: repository, experience, activity fallback, changelog, resume, and Now data
- `src/caseStudiesData.ts`: public client case study and capability data
- `src/notesData.ts`: Engineering Notes registry
- `src/modalScroll.ts`: shared modal/body scroll locking
- `src/generated/build.ts`: generated build, environment, and Mood metadata

## 5. Important directories

- `src/`: React application logic and components
- `app/`: global, Light Theme, and v5 feature CSS
- `config/`: centrally managed availability configuration
- `public/`: PHP APIs, routing, SEO endpoints, Notes, PWA resources, sitemap, and robots files
- `scripts/`: build metadata, deployment preparation, Mood CLI, quality gates, and distribution verification
- `tests/e2e/`: Playwright regression coverage
- `.github/workflows/`: quality, staging, production, and availability workflows
- `deploy/`: private server-configuration examples
- `docs/`: screenshots and engineering documentation
- `vendor/`: imported shadcn/Tailwind CSS baseline

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

`src/modalScroll.ts` implements a reference-counted shared body lock. All eleven `role="dialog"` consumers route through the shared `useModalDialog` hook, which composes the lock with Escape handling, focus containment, focus return, and per-viewport geometry measurement.

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

The Playwright suite contains **48 tests** in `tests/e2e/portfolio.spec.ts`.

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

1. 5.1.1
2. 5.1.0
3. 5.0.0
4. 4.2.2
5. 4.2.1
6. 4.2.0

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
`/activity` is present in the Apache rewrite list and both sitemaps; the contact
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
file request failed identically — including `src/App.tsx` and `package.json` —
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

## 25. Current engineering priorities

1. Verify the v5.1.1 staging acceptance checks after deployment: true 404 status
   and body, Source Explorer file loads, and the Recruiter tour on a real device.
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
