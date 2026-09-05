# Testing Reference

**Applies to:** v5.1.1
**Scope:** what is tested, which command proves which contract, and — most
importantly — what can be trusted locally versus what requires CI or staging.

For pipeline internals (workflow inputs, step ordering, artifact phases, gating)
see [`CI-CD.md`](./CI-CD.md). For deployment and CDN operations see
[`DEPLOYMENT.md`](./DEPLOYMENT.md). For how the system works see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 1. Local command matrix

Every command below exists in `package.json`.

| Command | Contract it verifies |
| --- | --- |
| `npm run quality` | Repository and product contracts as static analysis: availability profiles and Mood workflow, Note and Case Study metadata, SEO route-support files, GitHub Activity present in routing and both sitemaps, one Command Palette shortcut, Terminal coverage, all 11 dialogs on the shared modal system, README capped at six releases and containing the current version, staging/production secret separation, CI step ordering, environment packaging rules, artifact hidden-file handling. Also runs the Service Worker verifier. |
| `npm run typecheck` | TypeScript in strict, no-emit mode across the application. |
| `npm run build` | Generates build metadata, typechecks, produces the one **indexable** `dist/` bundle, and copies the PHP/asset deployment files. |
| `npm run verify:dist` | The built bundle contains every required deployment file, and local links/Notes/Case Studies resolve. |
| `npm run package:staging` | Derives `dist-staging/` from the tested `dist/` and applies staging indexing policy. Never mutates `dist/`. |
| `npm run verify:staging` | Staging bundle is genuinely non-indexable: noindex meta, `Disallow: /`, global `X-Robots-Tag`, no canonical, no `og:url`, no sitemap reference, correct environment stamp. |
| `npm run package:production` | Derives `dist-production/` from the same tested `dist/`, applying no indexing policy. |
| `npm run verify:production` | Production bundle stayed indexable and inherited no staging policy: indexable robots meta, no `Disallow: /`, no global noindex header, production canonical and `og:url`, valid sitemap. |
| `npm run verify:sw` | Service Worker response-ownership and caching rules (see §5). Also invoked by `npm run quality`. |
| `npm run test:e2e:install` | Installs the pinned Playwright browser. Run once. |
| `npm run test:e2e` | The browser regression suite (see §4). |
| `npm run mood` / `npm run mood:list` | Portfolio Mood configuration. Not part of release validation; listed for completeness. |

Lighthouse is not an npm script. It is invoked against the running preview with a
pinned version, matching CI exactly:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 &
npx --yes lighthouse@12.8.2 http://127.0.0.1:4173/ \
  --quiet --chrome-flags='--headless --no-sandbox' \
  --only-categories=accessibility,best-practices,seo \
  --output=json --output=html --output-path=lighthouse-report
```

Thresholds are **0.9** for each category. Audit the **indexable `dist/`**, never a
packaged staging bundle — see §7.

---

## 2. Release-readiness sequence

```bash
npm run quality
npm run typecheck
npm run build
npm run verify:dist
npm run package:staging   && npm run verify:staging
npm run package:production && npm run verify:production
npm run test:e2e
# Lighthouse against the indexable build
git diff --check
```

A release is ready when all of the above pass **and** the staging acceptance
checklist in §7 has been completed against a real deployment.

---

## 3. Local vs CI vs staging

This is the section that matters most. Do not report a staging-only contract as
locally verified.

### Local can verify

- TypeScript and the Vite build
- repository quality gates and product contracts
- deployment bundle contents (`verify:dist`)
- environment packaging and both indexing-policy contracts
- Playwright UI regressions against the static preview
- Lighthouse against the indexable build
- Service Worker logic through the sandbox verifier

### Local cannot verify

- **PHP syntax** unless a local `php` binary exists
- **Apache / `.htaccess`** — `vite preview` is a static server and executes none of it
- **Any `/api/*` endpoint** — no PHP runtime, so all API calls 404 locally
- **CDN behaviour** — caching, query-string forwarding, origin-error pass-through
- **Service Worker registration** — HTTPS only
- **True HTTP 404 status** — produced by PHP, not by the SPA

Locally, `/api/*` 404s are expected and appear as *handled* failures. They must
never surface as uncaught exceptions, unhandled rejections or React errors.

### CI additionally verifies

- PHP lint across `public/**/*.php`
- the pinned Playwright browser on Linux
- a reproducible install → build → package → verify pipeline
- Lighthouse on Linux
- deploy artifact integrity, including hidden files
- environment packaging contracts before any artifact exists

### Staging is required for

- Apache routing and `.htaccess` execution
- PHP endpoint behaviour, including the GitHub proxy
- Source Explorer end to end through the CDN
- client query-string forwarding to the origin
- real Service Worker registration over HTTPS
- true HTTP 404 status and origin-error body pass-through
- response and security headers
- staging noindex enforcement at all three layers
- Recruiter Mode with live project metadata

---

## 4. Playwright coverage

Baseline: **48 passing tests** in `tests/e2e/portfolio.spec.ts`. Treat this as a
floor that grows with each release, not as the contract itself — the contract is
the coverage areas below.

- core SPA navigation, deep links and browser Back
- Light and Dark theme surfaces and contrast targets
- Engineering Notes rendering, TOC selection and repeated navigation
- Projects, Gallery and mobile quick access
- the shared modal stack: focus containment, focus return, Escape ownership across
  stacked dialogs
- scroll restoration, including restoring the exact covered workspace position and
  never re-snapping after close
- Case Study routes, modal behaviour and capability separation
- Command Palette ranking, the single shortcut, and destination sequencing
- Accessibility control persistence and immediately visible effects
- Portfolio Mood and header control sizing
- Recruiter Mode responsive geometry
- the custom 404 workspace (client half only — see §7)
- diagnostics, project comparison and responsive layout

### Deterministic Recruiter fixtures

Featured projects normally come from the GitHub metadata API, which is unreachable
from a static preview. Without fixtures the tour would contain only its intro and
outro, and the long project steps — the ones most likely to overflow — would never
be measured.

The responsive tests therefore intercept the metadata endpoint and return
deterministic fixtures: two featured projects with deliberately long headlines and
talking points, producing a fixed four-step tour. **No live GitHub access is
required.** Each step is measured at 320, 360, 390, 412 and 768 px wide for
symmetric inline gaps, absence of document horizontal overflow, text wrapping,
working internal scrolling, and reachable close, progress, Back and Next controls.

If a fixture stops producing featured projects, the metadata normalizer is the
first place to look: it rejects an object missing any of `project`, `repository`,
`caseStudy` or `architecture`, and silently falls back to unfeatured.

---

## 5. Service Worker verification

`scripts/verify-sw.mjs` executes the real `public/sw.js` inside a controlled
worker environment and asserts:

- the response clone is taken **before** the body is consumed
- a failed cache write never produces an unhandled rejection
- `/api/*` is never intercepted or cached
- static asset caching still functions

It exists because the worker registers only over HTTPS, so no local browser run
loads it. It is invoked from `npm run quality`, so CI runs it without a dedicated
step.

**This does not replace HTTPS staging verification.** It validates the worker's
logic, not its real registration, real Cache Storage, or its interaction with the
CDN. Confirm registration and live behaviour on staging.

---

## 6. Console cleanliness

Across `/`, Projects, Source Explorer, a Case Study, an Engineering Note, Recruiter
Mode and an unknown route there must be zero:

- uncaught exceptions or unhandled promise rejections
- Service Worker clone errors
- React errors
- CSP violations
- application-originated console errors

Expected handled HTTP failures — notably `/api/*` locally — must not appear as
uncaught application errors.

---

## 7. Staging acceptance checklist

Run after every deployment to `staging.osameh.dev`. Results are **expected**
outcomes until confirmed against the new deployment.

### Source Explorer

- [ ] repository tree loads
- [ ] a root-level source file loads
- [ ] a nested source file loads
- [ ] a dot-prefixed path loads where the repository has one (`.github/`, `.idea/`)
- [ ] a failed file shows the inline error with retry, and the tree stays usable
- [ ] selecting another file after a failure recovers
- [ ] no console errors

### Service Worker

- [ ] registers over HTTPS
- [ ] no `Response.clone` exception in the console
- [ ] API requests still work with the worker active

### Recruiter Mode

- [ ] mobile, tablet and desktop widths
- [ ] long project steps render with live metadata
- [ ] no horizontal overflow
- [ ] close, progress, Back and Next reachable on every step

### Routing and 404

```bash
curl -sI https://staging.osameh.dev/this-route-does-not-exist   # expect HTTP 404
curl -sI https://staging.osameh.dev/notes/does-not-exist        # expect HTTP 404
curl -sI https://staging.osameh.dev/case-studies/does-not-exist # expect HTTP 404
curl -sI https://staging.osameh.dev/projects/unknown-project    # expect HTTP 404
curl -sI https://staging.osameh.dev/activity                    # expect HTTP 200
curl -s  https://staging.osameh.dev/this-route-does-not-exist | grep "404 — Route not found"
```

- [ ] unknown route returns HTTP 404
- [ ] the body is our IDE shell, not a ParsPack error page (the `grep` matches)
- [ ] the browser URL stays on the original invalid path — no redirect to `/404`
- [ ] invalid note, case study and project routes return 404
- [ ] `/activity` and other valid deep links remain 200

### SEO and headers

```bash
curl -sI https://staging.osameh.dev/ | grep -iE 'x-robots-tag|content-security-policy|strict-transport|x-frame-options'
curl -s  https://staging.osameh.dev/robots.txt
```

- [ ] staging document carries `noindex,nofollow,noarchive`
- [ ] `X-Robots-Tag` present on every route, including JSON and XML
- [ ] `robots.txt` is `Disallow: /` with no sitemap reference
- [ ] CSP and the other security headers are present — their absence means
      `.htaccess` did not reach the server

---

## 8. Troubleshooting

**Playwright browser cannot be installed locally.** If the pinned Chromium
download fails, run the suite against installed system Chrome by extending the
config with `use: { channel: "chrome" }`. Treat this as a local convenience only:
the pinned browser in CI remains authoritative, and a local-only pass is not
sufficient evidence for a release.

**Every Playwright test fails at browser launch.** Run `npm run test:e2e:install`.

**`http://localhost:4173 is already used`.** A preview server is already running.
`reuseExistingServer` is enabled outside CI, so this normally resolves itself; if
not, stop the stray process.

**All `/api/*` calls 404 locally.** Expected — `vite preview` runs no PHP. Verify
API behaviour on staging.

**Lighthouse reports SEO around 63.** The audit is looking at a staging-packaged
(noindexed) bundle rather than the indexable `dist/`. Rebuild with `npm run build`
and audit before any `package:*` step. See [`CI-CD.md`](./CI-CD.md#33-why-the-order-matters).

**Lighthouse exits after writing its report on Windows.** `chrome-launcher` can
fail during temp-directory cleanup with `EPERM` *after* the audit completes. The
report is still written; this is a cleanup failure, not an audit failure. CI on
Linux is authoritative.
