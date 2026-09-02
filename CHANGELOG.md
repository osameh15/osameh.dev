# Changelog

All notable changes to **osameh.dev** are documented here.

The project follows [Semantic Versioning](https://semver.org/). The early production releases were shipped in rapid succession while the portfolio was moved from its hosted prototype to the current ParsPack/CDN deployment.

## 4.2.2 - 2026-09-02

### Fixed
- Updated the Engineering Notes light-theme contrast regression to target the section label that is actually rendered by the Notes index instead of the article-only eyebrow selector.
- Contrast targets now assert visibility with a focused five-second failure message before evaluating computed colors, avoiding opaque full-test timeouts when markup changes.

## 4.2.1 - 2026-09-02

### Fixed
- Made the Skills Preview contrast test use an exact accessible-name match, preventing the Resume Viewer preview plugin from triggering a Playwright strict-mode collision.
- The mobile project toolbar now scrolls horizontally to keep the automatically selected Gallery control fully visible at the end of the document.
- Returning from an Engineering Note now bypasses the global smooth-scroll rule and lands at the Notes index immediately.

### Tests
- Tightened the Notes return regression to reject multi-second smooth scrolling.
- Extended the mobile Gallery regression to verify both selected state and full toolbar visibility.

## 4.2.0 - 2026-09-02

### Changed
- Rebuilt the light theme around semantic canvas, surface, text, accent and border tokens so new feature styles cannot silently restore dark surfaces.
- Redesigned the Hero engineering showcase, including Primary lanes, metrics, terminal output and stack chips, for strong light-theme readability.
- Converted Skills Preview and Skills Code into cohesive light workbench surfaces with clear hover and active states.
- Unified light-theme styling across the IDE shell, tabs, project routes, Engineering Notes, Recruiter Mode, 404, command surfaces, modals and project navigation.
- Reworked Compare, selected Compare chips and the floating compare queue to remove dark-on-dark controls.

### Quality
- Added contrast-ratio regression checks for the Hero, Skills Preview, Notes, project tabs, 404 and floating Compare UI.

## 4.1.2 - 2026-09-01

### Fixed
- Rebuilt the compact PWA install control with a dedicated square icon frame so the download glyph is geometrically centered inside both its button and the mobile header.
- The mobile project quick-access toolbar now selects Gallery automatically when the document reaches its end, even when the final section cannot cross the normal scroll-spy probe line.
- The Engineering Note toolbar now sticks below the complete top-bar and editor-tab stack (`94px` on tablet and `90px` on mobile) instead of being obscured beneath the tabs.

### Changed
- Added responsive browser regressions for PWA icon geometry, Gallery end-of-document selection, and Notes toolbar stacking.

## 4.1.1 - 2026-09-01

### Fixed
- Engineering Note return navigation now runs after the portfolio DOM is committed and corrects late layout shifts, so both the in-page back control and browser Back land at the beginning of Engineering Notes.
- Browser history scroll restoration can no longer override the application’s section navigation with the previous article position.
- Engineering Note heading IDs are namespaced per article and TOC queries are scoped to the rendered Markdown, eliminating collisions with the surrounding IDE shell.
- Repeated TOC clicks keep the selected entry stable throughout smooth scrolling; manual wheel/touch navigation immediately returns control to scroll-based selection.
- The compact PWA download/install control now occupies the header alignment context and centers its icon vertically on narrow screens.

### Changed
- Added browser regression scenarios for exact Notes restoration, repeated TOC selection, and mobile header icon centering.

## 4.1.0 - 2026-09-01

### Added
- Six-at-a-time lazy rendering for the Engineering Notes index, ready to scale as the article library grows.
- Scroll-synchronized Engineering Note table of contents with persistent selected state and reliable heading jumps.
- Mobile project bottom navigation derived from the existing project quick-access sections.

### Fixed
- Returning from an Engineering Note now restores the beginning of the Engineering Notes section instead of landing at an offset scroll position.
- Removed the gray backing exposed by the incomplete final row in the System Health check grid.
- Release graph hover no longer replaces the detail panel; the panel now follows the explicitly selected release node.
- Improved mobile modal overflow so large dialogs remain capped and internally scrollable rather than taking over the whole viewport.
- Centered compact download/install controls and improved narrow-screen source/editor status layouts.

### Changed
- Audited light-theme contrast across Recent GitHub Activity, Notes, Source Explorer, Health Center, Changelog, modals, and interactive controls.
- Tablet/mobile Engineering Note navigation becomes a horizontally scrollable sticky TOC instead of disappearing.
- Responsive layouts now reserve space for the mobile project bottom navigation and reduce oversized typography/padding on narrow screens.
- Expanded Playwright regression coverage for note navigation, viewport-capped diagnostics, mobile project quick access, and light-theme controls.
- Lighthouse preview readiness retries are now silent until a real timeout/failure, avoiding misleading transient curl errors in CI logs.

## 4.0.0 - 2026-09-01

### Added
- Dynamic project structured data using `SoftwareSourceCode` / `SoftwareApplication` plus breadcrumb markup.
- Dynamic `sitemap.xml` generation from live public repositories and engineering notes, with a static fallback sitemap.
- `develop` → `staging.osameh.dev` deployment channel with staging-specific `noindex`, `nofollow`, and `noarchive` protection.
- Repository quality gates for metadata, notes, PHP lint, TypeScript, built-file verification, browser E2E smoke, accessibility checks, and Lighthouse SEO/accessibility/best-practices thresholds.
- Live `/api/health` endpoint and an expanded System Health Center with safe dependency checks and client-to-origin latency history.
- Engineering Notes section with Markdown-backed articles, deep links, table of contents, code-copy controls, tags, reading time, sharing, Terminal integration, and Command Palette integration.
- Note-specific `TechArticle` and breadcrumb structured data for `/notes/<slug>`.

### Changed
- Production deployment now runs repository quality checks, PHP linting, deployment-bundle verification, and browser smoke tests before FTPS upload.
- `portfolio.json` now advertises staging, quality gates, dynamic SEO, health checks, and engineering notes as first-class project capabilities.
- System Diagnostics is now a live privacy-safe operational health view rather than a mostly local client snapshot.

### Security
- Staging responses are explicitly excluded from indexing.
- Health diagnostics expose only operational status, safe labels, build metadata, and latency — never secrets, raw filesystem paths, IPs, or credentials.
- Project and note deep links preserve the existing noindex behavior for invalid soft-404 routes.

## 3.1.1 - 2026-09-01

### Fixed
- Aligned the `RELEASE GRAPH / LIVE HISTORY` label with the explanatory text in the changelog intro by overriding the inherited global eyebrow top margin only inside that panel.
- Fixed Source Explorer status-bar clipping so language, file size, and line count remain vertically centered and fully visible.
- Added subtle status separators that remain consistent in dark and light themes.

## 3.1.0 - 2026-09-01

### Added
- Pointer-responsive parallax for the custom engineering showcase on the home screen.
- Animated hero counters for production experience, public repositories, and engineering focus modes.
- Mini-terminal readiness pulse inside the hero Build Rhythm panel.
- Programming-language-aware Stack Surface cards that react to the existing language preference.
- Explicit source-file loading skeleton and status before code rendering.

### Fixed
- Source Explorer left repository tree now keeps its own visible scroll area for long file trees.
- Project quick-access rail is visually masked behind the icon pads so the vertical line never cuts through toolbar icons.

### Changed
- Refined hero motion for reduced-motion preferences and responsive layouts.
- Synchronized README release notes with the hero redesign and current repository-intelligence release history.

## 3.0.5 - 2026-09-01

### Changed
- Replaced the generic hero orbit on the home screen with a custom engineering showcase panel.
- Redesigned the right side of the opening section into a layered snapshot of workflow, impact metrics, stack surface, and shipping rhythm.
- Tuned the hero layout for both dark and light themes and improved the first impression away from template-like visuals.

## 3.0.4 - 2026-09-01

### Fixed
- Command Palette technology-filter actions now scroll directly to the project search/filter controls instead of stopping at the Featured/Recruiter shortlist.

### Added
- Terminal ghost autocomplete preview. Typing a partial command such as `he` shows the remaining `lp` in muted text before the user presses Tab.
- Existing Tab/Shift+Tab completion cycling remains available for commands, projects, services, and search terms.

## 3.0.3 - 2026-09-01

### Added
- Terminal Tab autocomplete with forward/backward cycling for commands, repositories, service destinations, and technology search terms.
- Technology-aware Command Palette entries for fast project filtering.

### Fixed
- Source Explorer code panes now keep their own vertical and horizontal scroll areas instead of clipping long files to the visible viewport.
- Project quick-access selection now follows natural scrolling reliably and remains selected during smooth toolbar navigation.
- Terminal search now indexes repository `portfolio.json` metadata, stack, recruiter skills, and project content, so searches such as `Docker` and `WPF` resolve correctly.
- Command Palette project search now uses the same repository metadata index.

## 3.0.2 - 2026-09-01

### Added
- Floating project quick-access rail for Overview, README, Metadata, Metrics, Case Study, Architecture, Source, and Gallery.

### Fixed
- Source Explorer request lifecycle so a successful repository-tree response can no longer remain stuck on `Loading repository tree…`.
- Featured project cards now expose project context to the custom right-click menu.
- Changelog graph panels now share the same height and scroll independently, keeping release details visible while browsing older history.
- Changelog version labels no longer overlap release titles.

### Changed
- Increased Recruiter Mode typography, progress/navigation visibility, and dark-theme contrast.
- Applied a readability pass to repository metadata, architecture, source explorer, and featured-project microcopy in both themes.

## 3.0.1 - 2026-09-01

### Added
- Interactive changelog release graph with focusable version nodes and a dedicated detail panel.
- Lazy-loaded archive behavior: the latest five releases render first, with an animated control to reveal or collapse older versions.

### Changed
- Redesigned the changelog from static release boxes into a graph/timeline experience better matched to the IDE-style portfolio UI.
- Hovering, focusing, or clicking a release node now updates the release details panel without moving the user away from the changelog section.

## 3.0.0 - 2026-09-01

### Added
- Repository-owned `portfolio.json` loader backed by the canonical `portfolio.schema.json`.
- Featured-project shortlist driven by `project.featured` and `featuredOrder`.
- Guided Recruiter Mode with project-specific skills, talking points, role, and direct project navigation.
- Per-project architecture viewer rendered from `architecture.nodes` and `architecture.edges`.
- Same-origin GitHub Source Explorer with repository tree browsing, entry points, file search, code preview, basic syntax highlighting, copy, and GitHub deep links.
- Live project metrics with language percentages, repository size, license, update signals, and latest release data.
- New GitHub proxy endpoints for project metadata, metrics, source trees, and source files.

### Changed
- Project names, taglines, type, lifecycle, ownership, responsibilities, stack, case studies, recruiter content, and SEO can now come directly from repository metadata.
- Project search and technology filtering include richer `portfolio.json` stack metadata.
- The public `osameh.dev` repository is included in the embedded fallback project set.
- Project deep-link metadata uses repository `portfolio.json` SEO fields when available.

### Security
- Source Explorer requests are restricted to repositories already exposed by the portfolio.
- Source paths reject traversal, generated/dependency trees, configured exclusions, binary content, and files above each repository's preview limit.
- GitHub credentials remain server-side; the browser only talks to same-origin PHP endpoints.

## 2.2.4 - 2026-08-31

### Fixed
- Restored the IDE-style 404 workspace for unknown routes behind ParsPack CDN.
- Unknown project deep links now render the same in-app 404 instead of ParsPack's upstream error page.

### Changed
- Unknown browser routes use a CDN-compatible soft-404 response: HTTP 200 with `X-Robots-Tag: noindex, nofollow` and `X-Portfolio-Route-Status: 404`.
- The 404 document removes canonical/Open Graph URL metadata and uses a dedicated not-found title to avoid advertising an invalid route.

## 2.2.3 - 2026-08-31

### Fixed
- Explorer/sidebar entries now receive a selected state when clicked and while their section is visible during scrolling.
- Project detail routes keep the Projects entry selected instead of leaving the Explorer state ambiguous.

### Changed
- Moved the resume out of the `OSAMEH-PORTFOLIO` file tree.
- Added a distinct `PORTFOLIO PLUGINS` area with a Resume Viewer card that reflects modal open/closed state.
- Added `aria-current`/`aria-pressed` state to the Explorer and Resume Viewer controls for clearer keyboard and assistive-technology feedback.

## 2.2.2 - 2026-08-31

### Added
- Complete repository-level changelog for the production history.
- Production screenshots under `docs/img/` for the public GitHub README.
- README release summary limited to the five latest releases with a link to this file.

### Changed
- Finalized CI/CD documentation for the dedicated ParsPack deployment account.
- Documentation-only changes, including `CHANGELOG.md`, no longer trigger a production deployment workflow.

## 2.2.1 - 2026-08-31

### Added
- GitHub Actions workflow for automatic production delivery on pushes to `main`.
- Manual `workflow_dispatch` support for controlled redeploys.
- Deployment bundle validation before upload.
- Public `build-info.json` verification after deployment with cache-busting retries.
- GitHub Actions deployment summary containing commit and build identifiers.

### Security
- Deployment credentials are isolated in GitHub Actions repository secrets.
- CI is designed for a dedicated FTP account scoped only to `public_html`.
- Explicit FTPS/TLS is required by the workflow; runtime GitHub API secrets remain outside the web root.

### Changed
- Recent public GitHub activity messaging now reflects GitHub's 30-day public-events window.

## 2.2.0 - 2026-08-31

### Added
- Resizable IDE-style terminal panel with drag handle.
- Terminal maximize/restore controls and double-click maximize behavior.
- Shared toast notification system with `success`, `info`, `warning`, and `error` variants.
- Repository-wide authored-image discovery for project galleries.

### Fixed
- Command Palette keyboard selection now scrolls the active item into view.
- Contact filename follows the currently selected programming language.
- Status-bar build-version hover contrast improved.

### Changed
- Operational errors and feedback were consolidated into the toast system.
- Repository README was rewritten for normal public/open-source use rather than deployment-session notes.

## 2.1.0 - 2026-08-31

### Added
- Ongoing `Freelance Software Developer` experience from 2017 to present.

### Fixed
- Contact form initialization so the send action does not remain disabled when the initial CSRF bootstrap is delayed.
- Stateless same-origin CSRF flow with automatic token refresh/retry behavior.
- Light-theme search field, shortcut badge, form, modal, and menu contrast issues.

### Changed
- Increased typography sizes across the interface, including menus, forms, metadata, modals, and microcopy.
- Improved dark/light section-label contrast.
- Header actions wrap as complete items instead of breaking labels such as `Install app` across lines.
- `Open PDF` moved next to `Download` in the resume viewer header.

## 2.0.1 - 2026-08-31

### Fixed
- TypeScript build errors caused by an unavailable Lucide `Github` icon export.
- React click-handler typing issues around `showHome`.

### Changed
- Clicking a build version opens an in-app Build Info modal instead of raw `build-info.json`.
- Terminal `build` opens the Build Info modal.
- Terminal `version` remains a concise text-only command.

## 2.0.0 - 2026-08-31

### Added
- Project case-study structure: problem, solution, architecture, challenges, and results.
- Project search, technology filters, sorting, and two-project comparison.
- Tech Stack Explorer linked to project filtering.
- Built-in PDF resume viewer and downloadable CV.
- Recent public GitHub activity panel.
- `Now` section and in-site changelog.
- PWA manifest, install flow, service worker, and offline shell.
- Production contact form with PHP backend, validation, honeypot, CSRF protection, and rate limiting.
- Privacy-friendly aggregate analytics without cookies or persistent visitor identifiers.
- System diagnostics panel.
- Keyboard-first navigation and expanded Command Palette.
- Advanced terminal commands including `neofetch`, project lookup, resume, status, and sharing commands.
- Project sharing and project-specific social metadata/cards.
- Developer-style 404 page and offline/error states.
- Project comparison modal.

### Security
- Browser-to-GitHub traffic remains same-origin through the PHP proxy.
- Server-side secrets remain outside `public_html`.

## 1.3.0 - 2026-08-31

### Added
- Context-aware custom right-click menu for desktop pointers.
- Theme-aware context-menu styling for dark and light modes.
- `Ctrl/Cmd + K` Command Palette.
- Context actions for projects, images, links, selected text, navigation, theme switching, terminal access, and clipboard operations.
- Developer easter egg: `sudo hire osameh`.
- Deep project links such as `/projects/Mizekar`.
- Clipboard feedback toasts.

### Fixed
- Terminal command input now autofocuses whenever the terminal is opened or reactivated.

## 1.2.0 - 2026-08-31

### Added
- Automatic build IDs and build timestamps generated during production builds.
- In-site build-version display and `build-info.json` diagnostics endpoint.
- `version` / `build` terminal support.
- Social preview JPEG (`1200x630`) for broad Open Graph crawler compatibility.
- Expanded Open Graph and Twitter/X metadata.

### Fixed
- Social preview reliability for platforms that did not consistently render the earlier WebP OG image.

## 1.1.0 - 2026-08-31

### Added
- Project Gallery backed by `/api/github/images/{repo}`.
- Repository tree image discovery across README, `images`, `docs`, screenshots, and media paths.
- Fullscreen gallery lightbox with keyboard navigation.
- Server-side image-list caching.

### Fixed
- Root-relative GitHub image paths such as `/Images/splash_screen.jpg` now resolve against the correct repository/branch.
- Relative README image normalization for repositories such as Dialysis and MizeKar.

### Security
- Gallery endpoints validate repository names against the public portfolio repository set before using the GitHub API.

## 1.0.0 - 2026-08-31

### Added
- Production migration from the hosted prototype to a shared-hosting-compatible React/Vite frontend.
- PHP GitHub proxy for server-side authenticated repository requests.
- Dynamic public repository loading with archived/profile-repository filtering and embedded fallback data.
- README loading and sanitized Markdown rendering with `marked` + DOMPurify.
- Server-side GitHub origin caching and stale-cache fallback.
- ParsPack shared-hosting deployment support.
- CDN-oriented immutable caching for hashed assets.
- HTTPS/security headers, CSP, HSTS, anti-framing, referrer policy, and permissions policy.
- SEO metadata, canonical URL, sitemap, robots file, favicon, and social metadata foundation.

### Security
- `GITHUB_TOKEN` stays outside the web root and is never included in browser bundles or Git history.
- Browser GitHub access is proxied through same-origin PHP endpoints.
