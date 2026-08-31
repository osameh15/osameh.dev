# Changelog

All notable changes to **osameh.dev** are documented here.

The project follows [Semantic Versioning](https://semver.org/). The early production releases were shipped in rapid succession while the portfolio was moved from its hosted prototype to the current ParsPack/CDN deployment.

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

