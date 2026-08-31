# Osameh Portfolio — Production v7

Production build for `https://osameh.dev` on ParsPack shared hosting + CDN.

This version keeps the original portfolio UI, layout, CSS, animations, themes, IDE interactions, responsive behavior, and project-detail experience intact. The changes are production hardening and performance/SEO work only.

## Production hardening baseline

- Added the supplied `favicon.svg`.
- Added the supplied `og-cover.webp` (1200×630) with Open Graph and Twitter/X metadata.
- Added `Person` + `WebSite` JSON-LD structured data.
- Strict CSP now uses an automatically generated SHA-256 hash for the JSON-LD block.
- Stylesheets remain restricted to `style-src 'self'`; v1.3.0 adds a narrow `style-src-attr 'unsafe-inline'` exception only for runtime context-menu pointer positioning.
- Browser API access is same-origin only (`connect-src 'self'`). GitHub is reached only by the PHP proxy.
- README API now rejects repository names that are not in the portfolio's public GitHub repository list.
- GitHub responses are cached server-side, while API responses explicitly request no CDN/browser storage.
- Project README/image fetching is lazy: README requests begin only when the Projects section approaches the viewport, or immediately when a project is opened.
- `marked` and `DOMPurify` are dynamically imported only when a README detail view actually needs rendering.
- Project-card image extraction no longer requires the Markdown renderer in the initial bundle.
- Added keyboard `:focus-visible` styling.
- Strengthened security/cache/compression headers.

## Build

```bash
npm install
npm run build
```

Upload the **contents of `dist/`** to `public_html/`.

Do not upload `public/.htaccess` directly. The build script replaces its JSON-LD CSP placeholder with the exact hash required by the built `index.html` and writes the deployable result to `dist/.htaccess`.

## Preview

```bash
npm run preview
```

See `DEPLOYMENT.md` for the production deployment checklist.

## v5 gallery and image fixes

- Fixes GitHub README images that use repository-root paths such as `/Images/splash_screen.jpg`.
- Repairs malformed legacy `raw.githubusercontent.com/...` image paths before rendering.
- Adds `GET /api/github/images/{repo}` to discover project visuals from `images/`, `docs/`, `screenshots/`, and `media/` using one recursive Git tree request.
- Project detail pages now include a responsive gallery and fullscreen lightbox with keyboard navigation.
- README-referenced images are merged with repository-discovered images and deduplicated.
- Gallery discovery is server-side, allow-listed to the public repositories already exposed by the portfolio, and origin-cached.

## v1.2.0 production diagnostics & social preview

- Production builds now generate a unique build id and `/build-info.json`.
- The build version is visible in the IDE status/footer and via the terminal command `version`.
- Social preview uses `og-cover-social.jpg` (1200×630 JPEG) for broader Telegram/LinkedIn/WhatsApp/X compatibility.
- The original `og-cover.webp` remains available for normal web use.


## v1.3.0 developer interaction layer

- Adds a custom desktop right-click context menu that follows the pointer and automatically flips away from viewport edges.
- The context menu is context-aware for projects, repository gallery images, links, selected text, and general workspace actions.
- Text inputs, textareas, selects and editable content keep the browser-native context menu for normal copy/paste behavior.
- Touch/long-press behavior is left native on coarse-pointer/mobile devices.
- Adds a VS Code-style Command Palette available from the context menu or `Ctrl/Cmd + K`, with keyboard navigation.
- Adds the `sudo hire osameh` easter egg and matching `hire` terminal command.
- Opening the terminal from any entry point now immediately focuses the command input so typing can begin without an extra click.
- Project context actions can copy stable `/projects/<repo>` deep links; dynamically fetched public repositories are resolved on direct page loads.
- Clipboard actions show a small theme-aware confirmation toast.
- The context menu and command palette include dedicated light/dark theme styling and honor reduced-motion preferences.
