# Testing Reference

**Applies to:** v5.3.2
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
| `npm run quality` | Repository and product contracts as static analysis: availability profiles and Mood workflow, Note and Case Study metadata, SEO route support, section deep-link routing, sitemap membership limited to independent canonical documents, one Command Palette shortcut, Terminal coverage, all 11 dialogs on the shared modal system, the build modal reading its environment from `build-info.json`, README capped at six releases and containing the current version, staging/production secret separation, CI step ordering, environment packaging rules, artifact hidden-file handling. Also runs the Service Worker verifier. |
| `npm run typecheck` | TypeScript in strict, no-emit mode across the application. |
| `npm run build` | Generates build metadata, typechecks, produces the one **indexable** `dist/` bundle, and copies the PHP/asset deployment files. |
| `npm run verify:dist` | The built bundle contains every required deployment file, and local links/Notes/Case Studies resolve. |
| `npm run package:staging` | Derives `dist-staging/` from the tested `dist/` and applies staging indexing policy. Never mutates `dist/`. |
| `npm run verify:staging` | Staging bundle is genuinely non-indexable: noindex meta, `Disallow: /`, global `X-Robots-Tag`, no canonical, no `og:url`, no sitemap reference, correct environment stamp. |
| `npm run package:production` | Derives `dist-production/` from the same tested `dist/`, applying no indexing policy. |
| `npm run verify:production` | Production bundle stayed indexable and inherited no staging policy: indexable robots meta, no `Disallow: /`, no global noindex header, production canonical and `og:url`, valid sitemap. |
| `npm run verify:brand` | Neural Cipher icon pack presence and pixel dimensions, manifest icon validity, 1200x630 social card, and absence of retired asset references. Also invoked by `npm run quality`. |
| `npm run verify:readme` | README asset URL normalization: encoded exactly once, idempotent, segment-safe for Unicode, percent, reserved characters, malformed escapes and encoded slashes, and third-party raw hosts preserved. Also invoked by `npm run quality`. |
| `npm run verify:sw` | Service Worker response-ownership and caching rules (see §5). Also invoked by `npm run quality`. |
| `npm run test:e2e:install` | Installs the pinned Playwright browser. Run once. |
| `npm run test:e2e` | The browser regression suite (see §4). |
| `npm run test:php` | The deterministic PHP reCAPTCHA decision contract. Skips with `PHP TEST NOT RUN — PHP EXECUTABLE UNAVAILABLE` when no PHP binary is present; CI is authoritative. |
| `npm run mood` / `npm run mood:list` | Portfolio Mood configuration. Not part of release validation; listed for completeness. |

The browser suite also protects native Project, Note, and Case Study hrefs, SPA
tab behavior, sitemap/canonical intent, WebSite identity, preserved Person schema,
and the absence of the incompatible project-card `role="button"` pattern.

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

### A workstation without Playwright's browser

CI installs and runs Playwright's own pinned Chromium, which is the
authoritative browser for this suite. Where that download is unavailable, the
same run can be pointed at an installed browser instead:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The variable is unset in CI, so the pinned browser is what gates a release.

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

- PHP lint across `backend/**/*.php`
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

Baseline: **78 passing tests** in `tests/e2e/portfolio.spec.ts`. Treat this as a
floor that grows with each release, not as the contract itself — the contract is
the coverage areas below.

- the Build Information runtime-environment contract: neutral while unresolved,
  correct on staging and production responses, and never guessing production when
  the metadata request fails
- release identity: codename resolution per family, the status bar, Build
  Information and Terminal surfaces, and Neural Cipher branding in the header,
  Resume Viewer, favicons and PWA manifest
- active editor-tab auto-scroll at 320/360/390/412/768 px, including that an
  already-visible tab is never moved and the document never scrolls sideways
- the shared editor-tab contract: Home singleton, mixed Project/Note coexistence,
  duplicate prevention, stable order, close-active-activates-left,
  close-inactive-preserves-active, and Home section restoration per source tab
- the build modal reporting the deployed environment from `build-info.json`
  rather than a literal compiled into the bundle
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

Staging checks expect `staging` runtime metadata; production checks expect
`production`. Deterministic UI tests fixture volatile GitHub values such as
counts, ordering and featured metadata, while live integration tests assert only
stable response/schema contracts. Progressive-enhancement tests wait for visible
state or network completion rather than arbitrary delays.

If a fixture stops producing featured projects, the metadata normalizer is the
first place to look: it rejects an object missing any of `project`, `repository`,
`caseStudy` or `architecture`, and silently falls back to unfeatured.

---

## 5. Service Worker verification

`scripts/verify-sw.mjs` executes the real `frontend/public/sw.js` inside a controlled
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

---

## 8. v5.3.0 Vanta coverage

### Adjacent Engineering Notes

Pure coverage asserts that adjacency follows `engineeringNotes` for every
position, that the ends resolve to `null`, and that an unknown slug has no
neighbours. Browser coverage asserts the first Note offers only Next, the last
only Previous, and every middle Note both, with exact `/notes/{slug}` hrefs and
titles; that the links are real anchors with descriptive labels and no disabled
control on the missing side; that following one opens an editor tab without
duplicating an open Note or disturbing Project tabs; that the destination starts
at its own beginning; that browser Back returns to the previous Note; that the
links are keyboard operable; and that the navigation fits 320, 360, 390, 412 and
768px viewports with 44px tap targets and no horizontal overflow.

### reCAPTCHA

**Nothing in CI contacts Google.** `grecaptcha` is stubbed deterministically, and
the host-mapped tests serve the local preview under the real hostnames so
exact-hostname site-key selection can be observed in a browser without shipping a
test-only key. There is no backend bypass to test against - none exists.

Covered: production and staging hosts each load the script with their own key and
not the other's; an unknown host refuses to submit and requests no token; no
Google request happens before the visitor touches the form; the token is
generated at submit time with the `contact_submit` action and travels in the
payload; execute failure and an empty token both block submission and stay
retryable; a rejected verification is reported without exposing a score; a second
activation while a submission is pending starts nothing; and a retry after a
failure carries a brand new token.

`backend/tests/recaptcha-decision.php` covers the server contract without a
network call or a secret: a valid response, a score exactly at the minimum, a
case-insensitive hostname, and every rejection - `success` false or missing or
truthy-but-not-true, wrong or missing action, wrong or missing hostname, a
staging hostname against production configuration, low, missing or non-numeric
score, and null, string or empty responses. It also covers environment selection
(including ports, localhost, and a lookalike host), the minimum-score clamp, and
the token guards.

### GitHub readiness (PHP, no credential)

`backend/tests/github-health.php` covers the probe decision without a network
call: an accepted credential is operational and authenticated; a 401 or 403
against a configured credential reports `authenticated: false` and degrades; an
anonymous 403 is throttling and stays operational; a transport failure or 5xx
degrades without blaming the credential. It also asserts header construction -
that an Authorization header is present only when a token exists, uses the
bearer convention, and that the existing Accept/User-Agent/API-version headers
survive - and that one environment's probe carries only that environment's
token. The fixture tokens are obviously fake and no value is ever printed.

### Architecture

Quality gates assert the frontend/backend directories exist and the superseded
`src/`, `app/`, `public/`, `vendor/` and `tests/php/` trees have not reappeared;
that the frontend contains no PHP and imports no backend source; that the backend
references no component; that `/lib/` is refused over the web; that the deploy
assembler still publishes both halves into `dist/`; and that every Source
Explorer entry point resolves to a real path.

---

## 9. v5.3.1 Vanta coverage

### Configuration isolation (PHP, no secrets)

`backend/tests/config-isolation.php` proves the contract with fixtures whose
values are obviously fake: a production-only file exposes no staging secret and
a staging-only file exposes no production secret; an unknown environment gets
neither; the private path is derived from the environment's own document root;
and a missing, malformed or empty file yields no configuration, no token and no
verification config. It also asserts that loading a missing or malformed file
prints nothing at all, because a raised `require` would print the server's
filesystem path into the response.

### Whole-card navigation

Browser coverage clicks the card body - not the action link - for Projects,
Notes and Case Studies, and asserts the right destination opens through the
shared editor-tab lifecycle without duplicating a tab. It also asserts that a
secondary control (Compare) performs its own action and navigates nothing, that
the primary destination is a real anchor with a correct `href`, that keyboard
activation works, that no anchor wraps a card and no card is a `role="button"`,
and that the card stays usable at 320-768px.

Modified clicks are asserted at the event level rather than by driving a real
ctrl+click: whether the browser opens a background tab is the browser's
business, and ours is only that the SPA handler does not intercept a modified or
middle click.

### Search readiness

Repository and bundle checks assert the homepage title and description describe
the portfolio, the canonical and `og:url` are `https://osameh.dev/`, the social
card is the canonical image, the favicon is declared in the initial HTML at a
stable unhashed path, no favicon is served from the hashed asset pipeline, the
sitemap still lists exactly the intended documents, and no file anywhere carries
the pre-portfolio hosting placeholder text. Browser coverage additionally
asserts the favicon URLs return real images rather than the SPA shell, and that
project, note and case-study `href`s are present in the rendered DOM.

Nothing in this suite contacts Google or Search Console.

## 10. v5.3.3 Vanta coverage

### What a browser can and cannot prove here

The Playwright suite runs against `vite preview`, a static server. It executes no
PHP and reads no `.htaccess`, so **no live error status is observable locally**.
What is provable in a browser is the document itself; the status codes belong to
the staging and production acceptance checks in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

### Error documents (browser)

Eight tests, taking the suite to **131**:

- every one of the eleven documents shows its status and reason phrase, uses the
  `error_<status>.cpp` editor identity, has the matching title, and declares
  `noindex,nofollow,noarchive`
- an error document renders with **no script at all**, requests no bundle asset
  and no `.js`, and contains no `javascript:` URL - the shared stylesheet is a
  real request that actually applied, asserted through computed style rather
  than through the markup
- the recovery links are real anchors to `/` and `/projects`, keyboard focusable
  with a visible focus ring and a target at least 44px tall, and following one
  reaches the site root
- no horizontal overflow at 320, 360, 390, 412 and 768px, with the status still
  visible

### API error shape (PHP, no secrets)

`backend/tests/api-error-shape.php` executes `backend/api/forbidden.php` for real
and asserts it answers `403` with a JSON object, no HTML, and no mention of the
rule, path, filename or server software behind the refusal. It then reads each
API endpoint and asserts that **every status at or above 400 is accompanied by a
body**, because a bodyless status is precisely what Apache replaces with an
error document - which would hand an API client an HTML page. It also asserts
that each method refusal still sends its `Allow` header.

PHP is not installed on every workstation. `npm run test:php` reports
`PHP TEST NOT RUN — PHP EXECUTABLE UNAVAILABLE` and exits 0 in that case; CI is
the authoritative result.

CI runs each suite as its own named step rather than through the local runner, so
a suite added to `scripts/php-tests.mjs` alone would be linted and never
executed. A quality gate now asserts the two lists agree.

### Live error acceptance (deployment workflows)

No preview server can prove a status code, so both deployment workflows assert
the two contracts against the deployed environment immediately after mirroring
the bundle:

- `/icons/` - a real asset directory with no index, refused by `Options -Indexes`
  - must answer `403`, `text/html`, with `error_403.cpp` in the body, zero
    redirects, and none of `Index of`, `DirectAdmin`, `cPanel`, `Apache/`,
    `Server at`, `Fatal error`, `Warning:`, `/home/` or `.php`
- `/api/recaptcha.php` - must answer `403`, `application/json`,
  `{"error":"Forbidden"}`, and must contain no HTML and no `error_403.cpp`
- `/errors/403.html` - must exist in the artifact and answer `200` directly

The document surface is deliberately one the site already has. Nothing is
created in order to be forbidden, and no public debug or crash endpoint exists.
A quality gate asserts both workflows still carry these probes.

### Repository and bundle gates

See [`CI-CD.md` section 6.2](./CI-CD.md) for the configuration and bundle checks,
which run inside `npm run quality`, `npm run verify:dist`, and both
`npm run verify:<env>` commands.

## 11. v5.3.4 Vanta coverage

### Mobile Note TOC bleed

Six tests, taking the suite to **137**. At 320, 360, 390, 412, 600 and 719px the
sticky table-of-contents rail must reach both screen edges - `left <= 0.5` and
`viewport - right <= 0.5` - while the page itself still does not scroll
horizontally.

The assertion is on measured geometry rather than on a CSS declaration, so it
fails for any cause of the same symptom, not only the `max-width` that produced
it. Reverting the fix makes the 390px case fail with `Received: 36`, the exact
gap that was reported.

## 12. v5.4.0 Phantom coverage

### Contrast, measured from pixels

Two tests, one per theme, screenshot each element and compute the best-case
contrast actually present in its rendered pixels. If even the best case is below
the threshold, the failure is real.

This method exists because the Phantom audit disproved the alternatives. A
computed-CSS walker reported one element at 2.49:1 that measured **11.75:1** once
the painted pixels were read, and missed failures down to 1.39:1 elsewhere. The
Lighthouse gate is a **90** threshold, not 100, and axe samples rather than
enumerates. The earlier computed-CSS light-theme test is kept - it is cheap and
catches token regressions - but it is no longer the only contrast evidence.

### Touch targets

Asserted at 390px against an enumerated list of controls that perform an action.
Informational labels are deliberately excluded: padding a label to 44px is bloat,
not accessibility. The helper measures the union of the element box and any
`::after` overlay, because compact chrome may keep its visual size while the
touchable area is expanded around it.

### Keyboard tab close

Opens a note tab, focuses the close button, activates it with Enter alone, and
asserts the tab closes and the correct tab becomes active. It also asserts the
control really is a `BUTTON`, and that the Home tab exposes no close control.
The full existing tab-lifecycle suite is retained unchanged.
