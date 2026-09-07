# Runtime Architecture

**Applies to:** v5.2.3
**Scope:** how the deployed system behaves at runtime — request path, routing,
server-side metadata, the SPA shell, the GitHub proxy, the Service Worker, and
the shared UI invariants.

Related references:

- [`CI-CD.md`](./CI-CD.md) — how code is built, validated, packaged and deployed
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — hosting, CDN, DNS and credential operations
- [`TESTING.md`](./TESTING.md) — what is verified, and where it can be verified
- [`PROJECT-UNDERSTANDING.md`](./PROJECT-UNDERSTANDING.md) — feature-level onboarding

---

## 1. Request path

```text
Browser
   |
ParsPack CDN            caching, TLS termination, origin-error pass-through
   |
Apache + .htaccess      rewrites, security headers, cache policy
   |
PHP layer               metadata injection and route validity (dynamic routes only)
   |
React / Vite SPA shell  IDE workspace, client routing, feature modules
   |
Same-origin APIs        /api/github/*, /api/contact, /api/analytics, /api/health
```

Every layer is same-origin. The browser never talks to GitHub, and no third-party
script is loaded at runtime — the Content-Security-Policy in `.htaccess` is
`default-src 'self'` with a hash-pinned inline JSON-LD block.

### Environment boundaries

| Concern | Owner |
| --- | --- |
| TLS, edge caching, HSTS, error pass-through | ParsPack CDN (external configuration) |
| Rewrites, non-HSTS security headers, cache policy, CSP | `public/.htaccess` |
| Route validity + metadata for dynamic URLs | PHP handlers |
| Everything after first paint | React SPA |
| GitHub credentials | server-side only, never in the bundle |

Staging and production run the **same application build**. They differ only in the
indexing policy applied at packaging time — see [`CI-CD.md`](./CI-CD.md#4-artifact-strategy).

### HSTS ownership

ParsPack CDN is the single owner of browser-facing HSTS. Its current edge policy is
`Strict-Transport-Security: max-age=31536000;preload`. The origin `.htaccess`
intentionally does not emit HSTS: TLS terminates at the edge, and the CDN can
generate or cache responses independently of the origin. Keeping HSTS at one edge
ensures consistent responses and avoids duplicate values on error responses. The
`includeSubDomains` directive is not claimed here, and this policy does not claim
enrollment in browser preload lists.

### Knowing which environment is running

The environment has three runtime states, and **unknown is never treated as
either one**: while `/build-info.json` is in flight the panel reports a neutral
"resolving" state, a successful response yields `staging` or `production`, and a
failed request reports the environment as unavailable. Defaulting to production
would let staging assert "PRODUCTION BUILD" during the request, which is exactly
the failure this contract exists to prevent.

Because one bundle serves both environments, nothing compiled into the JavaScript
can identify the environment — a build-time constant would report the same value
on staging and production. `build-info.json` is stamped per environment during
packaging and is therefore the only truthful runtime source. Surfaces that report
the deployed environment, such as the build-information panel, read it at runtime;
the health endpoint exposes the same value server-side.

---

## 2. Application shell

The site is a single React 19 + Vite SPA rendered as an IDE workspace. `src/App.tsx`
is the shell and orchestration layer; feature modules live beside it.

The shell owns:

- the semantic page registry and its scroll spy
- open editor tabs, the Explorer sidebar, Outline, bottom panel and Terminal
- route and browser-history state
- theme, font, code-language and accessibility preferences
- Command Palette, context menus, galleries and project comparison
- scroll restoration and user-intent cancellation

### Editor tab contract

One ordered collection is the single source of truth for every closable editor
tab; the active view is derived from it rather than tracked separately. All
tab-backed views therefore share one lifecycle:

- **Home is a singleton.** Always present, always first, never closable.
  Activating Home only changes which tab is active - it never removes another tab.
- **Mixed types coexist.** Projects and Engineering Notes are independent
  persistent tabs and can be open at the same time in any combination.
- **Identity is the entity, not the title.** Re-opening an entity activates its
  existing tab instead of creating a duplicate.
- **Order is stable.** New tabs append; activating a tab never reorders the strip.
- **Closing the active tab activates the tab to its left**, whatever its type.
  When that is Home, Home is activated.
- **Closing an inactive tab never steals focus** from the active one.
- **Each tab owns its Home section.** A Project belongs to Projects, a Note to
  Engineering Notes, so returning to Home restores the section the departing tab
  came from. That section travels with the transition rather than living in
  global state, so an open Note can never redirect a Project -> Home move.
- **One close path.** The X button, Escape and "Back to Portfolio" all run the
  same close algorithm.

Section restoration on returning Home reuses the same deterministic mechanism as
Notes and modal restoration - a tokenized request applied on committed DOM rather
than a guessed timer - and obsolete restoration is cancelled the moment the user
scrolls.

Feature modules cover portfolio features (availability, accessibility, public case
studies, capabilities), advanced UI (GitHub Activity, diagnostics, resume,
recruiter, PWA, sharing, comparison), project intelligence (repository metadata,
metrics, architecture, Source Explorer, gallery) and Engineering Notes (Markdown
loading, sanitization, TOC).

### Client routing

First-class routes are rewritten to `index.html` by Apache and then resolved by
the shell from `window.location.pathname`. The shell pushes history entries
itself; there is no router library. Dynamic routes — projects, Notes and Case
Studies — pass through a PHP handler first so crawlers receive real metadata
before React boots.

---

## 3. Routing and the true-404 contract

### Valid route

```text
request
   -> Apache rewrite (internal)
   -> PHP handler where the route is dynamic
   -> HTTP 200 + injected title/description/canonical/OG/JSON-LD
   -> React SPA shell renders the workspace
```

Valid dynamic responses keep their normal cache policy
(`public, max-age=300, stale-while-revalidate=3600`).

### Invalid route

```text
request
   -> Apache internal rewrite (never a redirect)
   -> owning PHP handler determines the route is invalid
   -> HTTP 404 + the same custom IDE shell as the body
   -> CDN passes the origin status and body through unchanged
   -> React renders the existing 404 workspace from window.location.pathname
```

Properties that matter:

- **True 404 status.** Before v5.1.1 these routes answered HTTP 200 with a 404
  body, because the edge replaced upstream error bodies.
- **No external redirect.** There is no `/404` URL; the rewrite is internal and
  the browser keeps the original invalid URL.
- **Custom body preserved.** The response carries the portfolio shell, not a
  generic edge error page.
- **`no-store` on 404 only.** An invalid route may become valid later, so it is
  never cached. Valid routes are unaffected.
- **noindex.** 404 responses carry `X-Robots-Tag: noindex, nofollow` and a
  rewritten robots meta.

### Authoritative validity

A handler returns 404 only where it can prove the route is invalid:

| Route | Authority |
| --- | --- |
| `/notes/:slug` | slug absent from `public/notes-index.json` |
| `/case-studies/:id` | id absent from `public/case-studies-index.json` |
| `/projects/:name` | repository absent from the cached GitHub repository record |
| anything else unmatched | no file, directory or first-class route matches |

Project validity depends on the cached repository record being available. When
that cache cannot be populated the handler serves the shell rather than inventing
a 404, so a GitHub outage never turns valid project URLs into 404s.

---

## 4. CDN contracts

Two edge behaviours are load-bearing. Both are **external configuration**; the
application cannot enforce or detect them, it can only depend on them. Operational
steps live in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### A. Client query strings must reach the origin

Some endpoints carry parameters as query strings — notably GitHub source file
retrieval. If the edge caches or normalises requests in a way that drops client
query parameters, `$_GET` arrives empty at PHP and the endpoint cannot function.

This is not hypothetical: it is what caused the v5.1.0 Source Explorer outage.
Every file request failed identically, including ordinary paths such as
`src/App.tsx`. The application's repository path validation was never the cause —
dot-prefixed directories like `.idea/` were always accepted, because the traversal
check only ever rejected a path segment equal to `..`.

### B. Origin errors must pass through

ParsPack → Error Page Management → **Show origin server errors: enabled**.

The origin answers `404` with the portfolio's own IDE body. The edge must preserve
both the status and that body. With the setting disabled, the edge substitutes its
generic error document and the custom 404 workspace never reaches the visitor.

### C. Staging must stay non-indexable

Staging enforces noindex at three independent layers so no single misconfiguration
can expose it: the robots meta in the document, a site-wide `Disallow: /` in
`robots.txt`, and a global `X-Robots-Tag` response header. Staging also publishes
no canonical, no `og:url` and no sitemap reference. These are applied at packaging
time and verified before an artifact exists — see [`CI-CD.md`](./CI-CD.md#5-environment-indexing-contracts).

---

## 5. GitHub proxy and Source Explorer

### Flow

```text
Browser
   -> /api/github/*                     same-origin, no credentials in the client
   -> PHP proxy (public/api/github.php)
   -> repository + path validation
   -> api.github.com / raw.githubusercontent.com
   -> normalized, filtered JSON response
   -> Source Explorer UI
```

The proxy fronts repository listings, activity, metrics, repository metadata,
README, source tree, source file and image discovery. Responses are cached to disk
with per-endpoint lifetimes, and stale cache is served when GitHub is unavailable
so the portfolio degrades rather than breaking.

### README asset URLs

A README references assets in three shapes, and each must be encoded **exactly
once**: a repository-relative path, a path whose reserved characters the author
already percent-encoded, and another project's absolute URL. Encoding an
already-encoded path a second time turns `%20` into `%2520` and the asset 404s,
so normalization is idempotent by construction — segments are decoded, then
encoded once, and `normalize(normalize(path)) === normalize(path)`.

Two rules keep that safe. Splitting on `/` happens **before** decoding, so an
encoded slash stays inside its own segment instead of being promoted into path
structure. And a well-formed `raw.githubusercontent.com` URL — owner, repository,
ref, path — is left untouched whoever owns it; only genuinely prefix-less legacy
paths are repaired against this repository. Rewriting a third party's asset onto
our own repository produces a URL that cannot resolve.

Project identity and base cards come from checked-in fallback data and render before
the repository request completes. GitHub repository and metric responses are
progressive enhancement; unresolved live values use neutral placeholders and do not
block meaningful portfolio content.

The GitHub token is read only from the environment or private server-side
configuration outside the web root. It is never exposed to a Vite variable or the
client bundle.

### Crawlable document contract

Project, Engineering Note, and Case Study cards expose native `a[href]` links.
Plain clicks retain SPA/editor-tab behavior, while browser-native modified clicks,
new-tab actions, copying, keyboard activation, and no-JavaScript discovery work
without emulated ARIA roles.

The sitemap contains only routes intended as independent canonical documents:
homepage, Project details, Note details, and Case Study details. Section routes such
as `/projects`, `/notes`, and `/activity` remain valid application deep links, but
canonicalize to the homepage and stay out of sitemap discovery. SSR/prerendering is
deferred pending Search Console evidence.

### Security contract

- Repository names are validated against a strict pattern before any use.
- Paths must be repository-relative. They are normalized into segments, and the
  already-decoded value is **not** decoded a second time.
- Dot-prefixed segments are valid names (`.github/`, `.idea/`, `.vscode/`).
- A segment equal to `..` is rejected — traversal is impossible after normalization.
- Absolute paths, Windows drive prefixes and `scheme:` protocol injection are rejected.
- Control characters and null bytes are rejected.
- Raw content is only fetched from `raw.githubusercontent.com`.
- Dependency, build, environment and secret-oriented paths are excluded, binary
  content is refused, and oversized files are refused by a configured limit.
- Nothing reads the local filesystem from a user-supplied path; the value is only
  ever used to construct a GitHub API URL with per-segment encoding.

### Frontend behaviour

```text
repository tree loads once  ->  user selects a file  ->  only that file is fetched
```

Files are never fetched eagerly. Each request carries a token, so a slow or failed
response cannot overwrite a file the reader has since selected. A file-level
failure is contained: the repository tree stays mounted and usable, the failure is
reported in place with the server's message, a retry action is offered, and
selecting another file recovers immediately.

---

## 6. Service Worker

Registered only over HTTPS, from `public/sw.js`. Its cache name is stamped with
the build id, so a new deployment invalidates the previous cache on activation.

| Request | Strategy |
| --- | --- |
| Navigation | Network first, falling back to cache and then the cached shell |
| `/assets/*`, `/notes-content/*`, images, fonts | Cache first, populated on first successful fetch |
| `/api/*` | **Network only — never intercepted, never cached** |

### Why the API is excluded

API responses are dynamic and include transient conditions: GitHub rate limits,
upstream outages, and legitimate 4xx responses. Caching any of them would let a
momentary failure be replayed after its cause is gone — a stale Source Explorer
error would persist until the cache expired. The worker therefore returns early
for `/api/` and leaves those requests entirely to the network.

### Response ownership rule

If a response will be cached, its clone must be taken **synchronously, before the
response is returned and its body consumed**. Cloning later — for example inside
an async cache callback — throws `Response body is already used`, because by then
the browser has read the body. Cache writes are also fully contained: a failed
cache write must never reject an otherwise successful network response.

This invariant is verified in CI without a browser; see
[`TESTING.md`](./TESTING.md#5-service-worker-verification).

---

## 7. Shared modal foundation

All eleven `role="dialog"` surfaces route through one shared hook. The invariants
below are architectural, not cosmetic — they are what keep nested dialogs,
scrolling and history from interfering with each other.

- **Explicit modal stack.** Dialogs register on an ordered stack rather than being
  inferred from DOM order, because a dialog opened later may render earlier in the
  tree.
- **Topmost dialog owns Escape and the focus trap.** Every open dialog listens on
  `window` in the capture phase, where handlers fire in registration order, so
  without an explicit stack the *oldest* dialog would consume Escape and close
  behind the one the user is looking at.
- **Per-modal scroll-lock ownership.** The body lock is a stack of entries, each
  owning its own restore position. A dialog stacked on top with no restore
  position of its own cannot overwrite what the dialog beneath it will restore to.
- **The body stays frozen until the last lock releases.** Reference counting is
  independent of the dialog stack.
- **The workspace scroll position is read through one helper.** While the body is
  frozen `window.scrollY` reads 0, so any navigation recording an origin must read
  the frozen position instead — otherwise closing a dialog returns the reader to
  the top of the page.
- **Command Palette destinations run after teardown.** A selected destination is
  queued and executed once the palette has closed and released its lock, so the
  destination sees the real page rather than a frozen body.
- **Geometry.** Each dialog measures its own scroll viewport rather than assuming a
  global scrollbar width; chrome stays edge-to-edge and no permanent scrollbar
  gutter is reserved. The centering backdrop constrains its grid column so a panel
  can never grow wider than the padded content box.

---

## 8. Release identity

**Cyber Noir** is the release-naming system for official osameh.dev releases.
`config/releases.json` is the single metadata source; the pure
`src/releaseMetadataCore.js` resolver is shared by runtime and build generation,
while `src/releaseMetadata.ts` owns display formatting. No component may
hardcode a codename.

- A codename identifies a release **family** (`major.minor`), so every patch
  inherits it: 5.2.0, 5.2.1 and 5.2.99 are all **Cipher**.
- Three historical releases were named individually before the policy existed:
  **2.2.4 Pixel**, **3.1.0 Shadow**, **4.2.2 Specter**.
- Starting with **5.2**, every official major/minor release family receives one
  codename, inherited by all patch releases in that family.
- Future family names are recorded as `reserved` and are deliberately **not**
  resolved, so an unreleased family can never appear in the UI as active.

Runtime surfaces render `v5.2.0 · CIPHER`; documentation and GitHub Release
titles use `5.2.0 — Cipher`. Git tags stay plain SemVer (`5.2.0`) - never
`5.2.0-cipher`. An unmapped version renders only its version, with no dangling
separator or placeholder. The build fingerprint carries `BUILD_CODENAME`, and `build-info.json`
carries `codename` alongside `environment`, so both staging and production show
the same release identity while remaining distinguishable by environment.

### Brand assets

The Neural Cipher icon pack lives in `public/icons/`, documented by its own
`README.md`. Runtime assets are the favicon set (`favicon.ico` plus 16/32/48 px),
the 64 px header retina variant, 128/256 px UI sizes, the 180 px Apple touch
icon, and the 192/512 px PWA icons. The 1024 px master, the design source and the
duplicate `app-icon-*` variants are authoring assets: they stay in `public/` but
are pruned from the deploy bundle, since Vite would otherwise ship roughly 5 MB
of unused artwork. `scripts/verify-brand-assets.mjs` checks the pack's presence
and pixel dimensions, that the manifest points at real files, that the social
card is 1200x630, and that retired names are no longer referenced anywhere.

## 9. Recruiter Mode

A guided tour rendered as a centred dialog on the shared modal foundation — not an
anchored popover, so it needs no separate mobile presentation mode.

Steps are derived from repository-owned portfolio metadata: an intro, one step per
featured project ordered by the metadata's own ordering field, and a closing step.
Project content therefore varies in length with the repository data behind it.

Desktop and narrow screens share one responsive model rather than device-specific
overrides: a single inline-margin token drives both the backdrop padding and the
panel's maximum width, so the panel always stays inside the viewport with
symmetric gaps; safe-area insets are respected; long content scrolls inside the
panel body while the header, progress bar and footer stay fixed; and the footer
navigation is pinned to a single non-wrapping row so its controls remain reachable
at the narrowest supported width.

Because tour content depends on live repository metadata, responsive regression
tests use deterministic fixtures rather than the network — see
[`TESTING.md`](./TESTING.md#4-playwright-coverage).

---

## 10. Engineering Notes pipeline

Markdown is fetched at runtime, rendered, transformed, and then sanitized:

```text
markdown -> Marked -> inert DOM -> heading ids, TOC, link and code-block transforms -> serialize -> DOMPurify -> render
```

The order is deliberate. Parsing happens in an inert document where nothing
executes, and **DOMPurify is the last stage the markup passes through**. Sanitizing
before a parse/re-serialize round trip would let the parser reconstruct markup that
had already been inspected. Unsafe elements and attributes are forbidden, and
external HTTPS links receive safe target and relationship attributes.
