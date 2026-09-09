# Deployment — osameh.dev v5.3.2

Target: ParsPack shared Linux hosting + ParsPack CDN + PHP 8+.

Related: [`CI-CD.md`](./CI-CD.md) for the delivery pipeline, [`ARCHITECTURE.md`](./ARCHITECTURE.md) for runtime behavior and the CDN contracts this hosting must satisfy, and [`TESTING.md`](./TESTING.md) for the staging acceptance checklist.

Build runtime: Node.js >=20.19.0 or >=22.12.0 (CI uses Node.js 22).

## 1. Build locally

```bash
npm install
npm run build
```

The build performs:

1. build ID generation
2. TypeScript validation
3. Vite production build
4. deploy-file verification/copy
5. CSP SHA-256 generation for the inline JSON-LD block

Use:

```bash
npm run preview
```

for a local production check. Do not validate deep links by double-clicking `dist/index.html`; v2 uses root-relative assets intentionally.

## 2. Secret location

Keep every server secret outside all public directories:

```text
domains/osameh.dev/private/osameh-portfolio-secrets.php
```

The file is never committed, never copied into `dist/`, never packaged into a
deploy artifact, and never reachable through Vite. It stays outside the
repository entirely - the refactor deliberately did **not** move it into
`backend/`; `backend/lib/recaptcha.php` only loads it. The tracked template is
[`deploy/osameh-portfolio-secrets.example.php`](../deploy/osameh-portfolio-secrets.example.php).

```php
<?php
return [
    'GITHUB_TOKEN' => 'github_pat_xxxxxxxxx',

    'RECAPTCHA' => [
        'production' => [
            'secret' => '...',
            'hostname' => 'osameh.dev',
            'min_score' => 0.5,
            'action' => 'contact_submit',
        ],
        'staging' => [
            'secret' => '...',
            'hostname' => 'staging.osameh.dev',
            'min_score' => 0.5,
            'action' => 'contact_submit',
        ],
    ],
];
```

Only the **secret** and an optional `min_score` are read from this file. The
expected hostname and the verified action are code constants in
`backend/lib/recaptcha.php`, because they are the security boundary: a block
copied onto the wrong server must not be able to move it. A disagreement is
logged as a safe diagnostic and the constant still wins, and a `min_score`
outside 0.1-1.0 is ignored in favour of the 0.5 default.

Production and staging occupy separate document roots, so each environment has
its own copy holding only its own secret. An environment that cannot resolve one
fails closed: the contact endpoint refuses the submission rather than borrowing
another environment's configuration.

The reCAPTCHA **site keys** are not secrets. They are public by design and live
in `frontend/src/config/recaptchaConfig.ts`, selected by exact hostname:
`osameh.dev` gets the production key, `staging.osameh.dev` the staging key, and
any other host gets none - never a production fallback.

The reCAPTCHA keys are configured in the Google admin console to permit AMP
usage. That is a key-level capability only. The portfolio implements no AMP
pages, markup, routing or reCAPTCHA-for-AMP integration.

Recommended permission: `600` or `640`.

Do not place this file in `public_html` or `private_html`.

## 3. Web-root layout

Recommended DirectAdmin layout:

```text
domains/osameh.dev/
├── private/
│   └── osameh-portfolio-secrets.php
├── private_html -> public_html
└── public_html/
```

`private_html` should remain a symbolic link to `public_html`.

## 4. Upload

Back up the current site, then upload the **contents** of `dist/` to `public_html/`.

Important files:

```text
public_html/
├── .htaccess
├── index.html
├── project.php
├── project-og.php
├── manifest.webmanifest
├── sw.js
├── build-info.json
├── assets/
├── api/
│   ├── github.php
│   ├── contact.php
│   └── analytics.php
├── icons/
├── resume/
│   └── Osameh_Irandoust_CV.pdf
├── og-cover-social.jpg
├── robots.txt
└── sitemap.xml
```

## 5. CDN

After upload:

1. ParsPack CDN -> Cache -> Purge All
2. wait until the purge history shows `success`
3. verify `/build-info.json`
4. compare the build version in the site status bar

Purge submission returning HTTP 200 only means the purge was queued. The CDN history status is the better confirmation that all nodes processed it.


## 404 behavior (true origin status, custom body)

**Requires** ParsPack CDN -> Error Page Management -> **Show origin server errors: enabled**.
With that setting off, the CDN replaces an upstream `404` body with its own
`Upstream Error - Not Found` document and the portfolio's 404 workspace never
reaches the visitor. The setting was enabled ahead of v5.1.1; if it is ever
switched back off, unknown routes will show the CDN error page instead.

Since v5.1.1 unknown routes return a **real HTTP 404** carrying the portfolio's
own IDE-style shell as the response body:

```text
HTTP/2 404
X-Robots-Tag: noindex, nofollow
X-Portfolio-Route-Status: 404
Cache-Control: no-store, max-age=0
```

Four handlers own this, each returning 404 only when it has authoritative data
proving the route is invalid:

| Handler | Invalid when |
| --- | --- |
| `backend/seo/not-found.php` | no file, directory, or first-class route matches |
| `backend/seo/note.php` | slug is absent from `notes-index.json` |
| `backend/seo/case-study.php` | id is absent from `case-studies-index.json` |
| `backend/seo/project.php` | repository is absent from the cached GitHub repo record |

Routing is an **internal Apache rewrite**, never a redirect, so the browser keeps
the original invalid URL and React renders the 404 workspace from
`window.location.pathname`. `no-store` is scoped to the 404 branches only; valid
note/case-study/project responses keep their normal
`public, max-age=300, stale-while-revalidate=3600` policy.

Smoke-test status **and** body, since a 200 with the right body was the old bug:

```bash
curl -sI https://osameh.dev/this-route-does-not-exist        # expect 404
curl -sI https://osameh.dev/projects/ThisRepoDoesNotExist    # expect 404
curl -sI https://osameh.dev/notes/does-not-exist             # expect 404
curl -sI https://osameh.dev/case-studies/does-not-exist      # expect 404
curl -sI https://osameh.dev/activity                         # expect 200
curl -s  https://osameh.dev/this-route-does-not-exist | grep "404 — Route not found"
```

The last command must match: it proves the body is the portfolio shell rather
than a CDN error page. A static preview server runs no PHP, so none of this is
observable locally; it is a staging acceptance check after every deployment.

## Branded HTTP error documents (v5.3.3)

Unknown routes keep the 404 behaviour described above: it is a PHP response with
its own body, and nothing here replaces it. This section covers every *other*
error, which until v5.3.3 fell through to the hosting provider's default page.

The origin now declares an `ErrorDocument` for each status it can answer:

```apache
ErrorDocument 400 /errors/400.html
ErrorDocument 401 /errors/401.html
ErrorDocument 403 /errors/403.html
ErrorDocument 404 /errors/404.html
ErrorDocument 405 /errors/405.html
ErrorDocument 408 /errors/408.html
ErrorDocument 429 /errors/429.html
ErrorDocument 500 /errors/500.html
ErrorDocument 502 /errors/502.html
ErrorDocument 503 /errors/503.html
ErrorDocument 504 /errors/504.html
```

**The status code survives.** A local `ErrorDocument` path is an internal
subrequest, not a redirect, so a forbidden request answers `403` carrying our
body at the original URL. Any `ErrorDocument` rewritten to an absolute URL would
turn the error into a `302` plus a `200` and is refused by a quality gate.

**Who generates what.** Only errors this server produces can be branded here:

| Status | Origin | Branded at the origin |
| --- | --- | --- |
| 400, 401, 405, 408 | Apache | yes, when Apache generates the error |
| 403 | Apache (`Options -Indexes`, protected paths) | yes |
| 404 | `not-found.php` and the three metadata layers | yes, by PHP; the error document is the fallback |
| 429 | ParsPack edge, or an application rate limit | application 429 is JSON; an edge 429 is not ours |
| 500 | Apache/PHP | yes, when the origin faults |
| 502, 503, 504 | usually the ParsPack edge, before the origin | **no** - the request never reaches this server |

An edge-generated gateway error is CDN configuration, not code. It is not
claimed as branded. `Show origin server errors` must stay enabled for any origin
error body to reach a visitor at all - the same CDN setting the 404 contract
already depends on.

**APIs are never branded.** Apache substitutes an error document only for a
response it generated itself with no body. Every `/api/` endpoint writes its own
JSON body, so no API response is replaced. Two rules keep that true:

- Backend library includes are refused by `backend/api/forbidden.php`, a JSON
  `403`, rather than by Apache's `[F]`. The include is still never executed or
  served; the refusal is simply machine-readable.
- Every API refusal carries a body. A bodyless `4xx` is exactly what Apache is
  entitled to replace, which is why the analytics `405` now returns JSON.

**Direct access.** `/errors/403.html` is a real static file and answers `200` on
a direct request; that is what makes the internal subrequest work. It carries
`noindex,nofollow,noarchive` in both the meta tag and a scoped `X-Robots-Tag`
header, is in neither sitemap, and is linked from nothing.

Smoke-test status and body together, as with the 404 contract:

```bash
curl -sI https://osameh.dev/api/recaptcha.php               # expect 403
curl -s  https://osameh.dev/api/recaptcha.php               # expect JSON, not HTML
curl -sI https://osameh.dev/errors/403.html                 # expect 200 + X-Robots-Tag noindex
curl -s  https://osameh.dev/this-route-does-not-exist | grep "404 — Route not found"
```

A forbidden document request must show the portfolio's error workspace. Seeing
the hosting provider's template instead means either the bundle is missing
`errors/`, or the CDN is not showing origin errors.

## 6. Smoke tests

### Site

```text
https://osameh.dev/
https://osameh.dev/projects/Mizekar
https://osameh.dev/now
https://osameh.dev/changelog
https://osameh.dev/resume
```

### GitHub APIs

```text
https://osameh.dev/api/github/repos
https://osameh.dev/api/github/activity
https://osameh.dev/api/github/meta/Mizekar
https://osameh.dev/api/github/metrics/Mizekar
https://osameh.dev/api/github/tree/Mizekar
https://osameh.dev/api/github/file/Mizekar?path=MizeKar.csproj
https://osameh.dev/api/github/readme/Mizekar
https://osameh.dev/api/github/images/Dialysis
```

Expected: HTTP 200 and valid JSON/Markdown. Source-file previews must stay within each repository's `portfolio.json` Source Explorer policy.

### Secret isolation

```text
https://osameh.dev/osameh-portfolio-secrets.php
```

Expected: `404` / File Not Found.

### Resume

```text
https://osameh.dev/resume/Osameh_Irandoust_CV.pdf
```

Expected: PDF opens/downloads successfully.

### PWA

```text
https://osameh.dev/manifest.webmanifest
https://osameh.dev/sw.js
```

In browser DevTools -> Application:

- manifest detected
- service worker active
- HTTPS/secure context
- installability passes when browser supports install prompts

### Contact form

1. open Contact
2. submit a real test message
3. confirm the email arrives
4. confirm `GET /api/contact` returns JSON with a CSRF token (the form also has a same-origin fallback if bootstrap is delayed)
5. verify repeated abuse attempts receive HTTP 429

If the form returns a server-mail error, check that PHP `mail()` is enabled and that the hosting mail routing accepts `support@osameh.dev` as the sender.

### Project social metadata

Check the branded social card endpoint directly:

```text
https://osameh.dev/og/projects/Mizekar.jpg
```

Expected: `200 image/jpeg` at 1200×630 when PHP GD is available. If GD is unavailable the endpoint intentionally redirects to the root social cover, so link previews remain valid.


Open page source (not DevTools DOM) for:

```text
https://osameh.dev/projects/Mizekar
```

Confirm that these tags contain project-specific values:

```text
<title>
og:title
og:description
og:url
og:image
twitter:title
twitter:image
canonical
```

The root URL continues to use `og-cover-social.jpg`.

## 7. Private server directories

The runtime may automatically create these outside `public_html`:

```text
private/osameh-portfolio-cache/
private/osameh-portfolio-social-cache/
private/osameh-portfolio-og-cache/
private/osameh-portfolio-contact-rate/
private/osameh-portfolio-analytics/
```

They should not be web-accessible.

## 7.9 Staging/production filesystem isolation

Production and staging **must** occupy separate document roots, each served by its
own FTP account scoped to that directory alone.

| Environment | Document root | FTP account scope |
| --- | --- | --- |
| Production | production root | production root only |
| Staging | staging root (a separate subdomain root, never nested inside production) | staging root only |

This is a deployment safety contract, not a convention. Production deploys with:

```text
mirror --reverse --delete
```

which deletes anything at the destination that is not in the artifact. When the
staging subdomain lived inside the production document root, a production deploy
removed the entire staging site. The production FTP account must therefore be
unable to list or delete the staging document root.

Do not restore a nested staging directory, and do not rely on a mirror exclusion
as the primary protection - an exclusion is a single fragile string in a command,
whereas credential scoping fails safe.

After any production deployment, confirm staging is still serving and still
reports its own independent build id.

## 8. Security checks

HSTS is owned exclusively by the ParsPack CDN edge. The current edge policy is:

```text
Strict-Transport-Security: max-age=31536000;preload
```

TLS terminates at the CDN edge, which may generate or cache responses independently
of the origin. `backend/server/.htaccess` deliberately does not emit
`Strict-Transport-Security`, ensuring one browser-facing HSTS source and avoiding
the duplicate values previously seen on origin/error responses. Do not infer that
`includeSubDomains` is enabled or that `osameh.dev` is enrolled in browser preload
lists from this policy.

Confirm response headers on the root document include the CDN HSTS header and:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
Permissions-Policy
```

CSP intentionally permits:

- scripts: same-origin + generated JSON-LD hash
- stylesheets: same-origin
- runtime style attributes: context-menu positioning only
- images: same-origin/data/HTTPS
- connections: same-origin APIs only
- worker: same-origin service worker

The browser never talks to `api.github.com` directly.

## 9. Analytics privacy

`/api/analytics` stores daily aggregate counters only. It does not store:

- raw IP address
- User-Agent
- cookies
- persistent visitor IDs
- device fingerprints

You can remove `private/osameh-portfolio-analytics/` at any time without affecting the site.

## 10. Rollback

Keep the previous `public_html` archive before deployment. If a production issue occurs:

1. restore the previous web-root files
2. Purge All CDN cache
3. verify the previous `/build-info.json`

The external `private/osameh-portfolio-secrets.php` does not need to change during rollback.


## 11. Interaction smoke tests

After deployment also verify:

- Command Palette keyboard navigation scrolls the selected item into view.
- The bottom IDE panel can be resized vertically and maximized/restored.
- Opening the terminal still autofocuses the command input.
- Build-version hover remains legible in both themes.
- Contact success/failure and other user-facing operational messages appear as typed toasts.
- Changing the code language updates the Contact filename extension.

## 12. CI/CD with GitHub Actions

> Deep technical reference: [`CI-CD.md`](./CI-CD.md) — workflow inputs, step ordering rationale, artifact phases, indexing contracts, quality gates, and what blocks a deployment.

The repository deliberately separates quality, staging deployment, and production deployment. Deployment never runs in parallel with E2E: the deploy job has `needs: quality` and receives the exact tested build artifact from the reusable quality workflow.

The application is built **once**, as a normal indexable production-like bundle. Every application-level check — repository gates, TypeScript, PHP lint, `verify:dist`, Playwright and Lighthouse — runs against that single `dist/`. Environment indexing policy is applied only afterwards, into a separate `dist-<env>/` directory, and each derived bundle is verified against its own contract before it can become a deploy artifact.

This ordering is load-bearing. Applying the staging noindex transform before the audit makes Lighthouse grade a deliberately non-indexable document: the `is-crawlable` audit fails and the SEO category drops to 63 even though the application itself scores 100.

```text
feature/*
   ↓
develop
   ↓
quality.yml
   static gates → typecheck → PHP lint
   → build (one indexable bundle)
   → verify:dist → Playwright → Lighthouse (strict SEO on the indexable build)
   → package:staging  → dist-staging/  → verify:staging
   → upload verified staging artifact
   ↓
staging.yml: staging FTPS preflight → deploy verified artifact → verify noindex/build
   ↓ approved develop → main
main
   ↓
quality.yml
   static gates → typecheck → PHP lint
   → build (one indexable bundle)
   → verify:dist → Playwright → Lighthouse (strict SEO on the indexable build)
   → package:production → dist-production/ → verify:production
   → upload verified production artifact
   ↓
deploy.yml: production FTPS preflight → deploy verified artifact → verify live build
```

### 12.0 Environment bundles

| Command | Purpose |
| --- | --- |
| `npm run build` | The one tested, indexable application bundle in `dist/` |
| `npm run package:staging` | Derives `dist-staging/` and applies the staging noindex policy |
| `npm run verify:staging` | Fails if the staging bundle became indexable |
| `npm run package:production` | Derives `dist-production/`, preserving indexability |
| `npm run verify:production` | Fails if a staging transform leaked into production |

`dist/` is never mutated in place by environment packaging, so the audited artifact and the deployed artifact are always distinguishable. Both derived directories are gitignored.

### 12.1 GitHub secrets — keep the two environments separate

Keep the existing ten Actions secrets. Do not rename production secrets to staging names or vice versa.

Production (`main` → `osameh.dev`):

```text
FTP_HOST
FTP_PORT
FTP_USERNAME
FTP_PASSWORD
FTP_CERT_FINGERPRINT
```

Staging (`develop` → `staging.osameh.dev`):

```text
STAGING_FTP_HOST
STAGING_FTP_PORT
STAGING_FTP_USERNAME
STAGING_FTP_PASSWORD
STAGING_FTP_CERT_FINGERPRINT
```

The staging workflow never reads `secrets.FTP_*`. The production workflow never reads `STAGING_FTP_*`. The reusable quality workflow receives no deployment secrets. GitHub Environments are also named `staging` and `production`, so environment protection rules can be enabled independently.

Do **not** add the runtime GitHub API PAT to Actions. It stays only in the private server file outside `public_html`.

### 12.2 FTPS certificate + login preflight

Each deploy job performs two checks before changing remote files:

1. retrieve the FTP TLS certificate with `openssl s_client -starttls ftp` and compare its SHA-256/SHA-1 fingerprint to the environment-specific secret;
2. log in with the environment-specific FTP account and list `/` before starting the mirror.

A failure like:

```text
530 Login incorrect
```

means authentication was rejected **before** remote-path selection. Verify the four credentials for that environment (`*_FTP_HOST`, `*_FTP_PORT`, `*_FTP_USERNAME`, `*_FTP_PASSWORD`) in GitHub Actions and, if necessary, reset that FTP account password in DirectAdmin/ParsPack. Do not solve a staging 530 by substituting production credentials.

The workflow passes the password only through the temporary `LFTP_PASSWORD` environment variable and starts lftp with `--env-password`. The GitHub Secret remains `FTP_PASSWORD` or `STAGING_FTP_PASSWORD`; `LFTP_PASSWORD` is only a job-local runtime variable. This avoids exposing the password in process arguments and avoids delimiter/parsing problems with punctuation.

### 12.3 Dedicated FTP roots

Production FTP account root:

```text
domains/osameh.dev/public_html
```

Staging FTP account root:

```text
<staging-subdomain document root>
```

Both workflows mirror `dist/` to `/` because each FTP account should already be chrooted/scoped to its own document root. A wrong remote root normally causes permission/path errors after successful login, not HTTP/FTP 530.

### 12.4 Staging protection

The staging build uses `DEPLOY_ENV=staging` and must keep all of these protections:

- `robots.txt` → `User-agent: *` + `Disallow: /`
- `<meta name="robots" content="noindex,nofollow,noarchive">`
- `X-Robots-Tag: noindex, nofollow, noarchive`
- staging `build-info.json` environment metadata
- no production canonical/base OG URL leakage

The staging deploy job verifies `robots.txt` before upload and checks both noindex and the deployed build fingerprint afterwards.

### 12.5 Portfolio mood / availability workflow

Availability has its own non-deployment workflow: `.github/workflows/availability.yml`. Run **Actions → Set portfolio mood**, choose one of:

```text
open
selective
freelance
focused
unavailable
```

The workflow edits only `config/availability.json`, validates the repository contract, commits the one-line mood change to `develop`, and lets the normal staging pipeline run. Production is updated only through the normal `develop → main` promotion. Generated `build-info.json` includes `availabilityMood`, which makes it easy to verify the mood deployed on staging or production. Locally, the equivalent command is:

```bash
npm run mood -- focused
```

### 12.6 Quality gates

The reusable `.github/workflows/quality.yml` runs the release-critical sequence in one job so ordering is unambiguous:

1. dependency install (`npm ci` when the lockfile contains the pinned Playwright dependency; otherwise `npm install` reconciles a stale/missing lockfile)
2. repository quality contracts
3. TypeScript
4. PHP lint
5. one indexable application build
6. deployment bundle/local-link verification
7. pinned project `@playwright/test` Chromium E2E/accessibility regressions
8. Lighthouse accessibility / best-practices / SEO thresholds, audited against the indexable build
9. environment packaging into `dist-<env>/` plus that environment's indexing-policy verification
10. upload the verified `dist-<env>/` artifact for the calling deploy workflow

A failed Playwright or Lighthouse step prevents the artifact/deploy path from completing. A failed `verify:staging` or `verify:production` step blocks the artifact the same way, so a bundle whose indexing policy is wrong can never reach a deploy job. Re-running only a deploy step cannot bypass a failed quality job.

### 12.7 Deploy artifact must include `.htaccess`

`actions/upload-artifact` excludes hidden files by default. `.htaccess` is the only
dot-file in the bundle and it carries the rewrite rules, CSP, security headers and
the staging `X-Robots-Tag`. The environment artifact upload therefore sets:

```yaml
include-hidden-files: true
```

Both deploy jobs assert `dist/.htaccess` exists **before** `lftp` runs, naming any
missing file. This ordering is deliberate: deployment mirrors with
`--delete`, so a bundle missing `.htaccess` would remove the file from the
server — dropping every rewrite and security header, and on staging removing the
noindex header.

## 13. Operational troubleshooting

Symptom-first notes for runtime and delivery problems. Test-tooling problems are
covered in [`TESTING.md`](./TESTING.md#8-troubleshooting).

**Source Explorer returns HTTP 400 for every file.**
Check CDN query-string forwarding. The file endpoint passes its path as a client
query parameter; if the edge caches or normalises requests so query strings do not
reach the origin, `$_GET` arrives empty and every path fails identically —
including ordinary ones such as `frontend/src/app/App.tsx`. This is not a path-validation bug.
Confirm by comparing a path-encoded endpoint with a query-encoded one:

```bash
curl -s https://osameh.dev/api/github/tree/osameh.dev | head -c 80   # path-encoded
curl -s "https://osameh.dev/api/github.php?meta=osameh.dev" | head -c 80
```

If the second returns the repository list instead of metadata, query strings are
being dropped before PHP.

**A custom origin 404 is replaced by the ParsPack error page.**
Check ParsPack → Error Page Management → **Show origin server errors**. It must be
enabled, otherwise the edge substitutes its own body for any upstream error.

**Deployment fails with a missing `dist/.htaccess`.**
The artifact was uploaded without hidden files. Verify `include-hidden-files: true`
on the environment artifact upload step. Do not work around this by relaxing the
deploy-side assertion — it is what prevents `mirror --delete` from removing the
server's `.htaccess`.

**Staging Lighthouse reports SEO around 63.**
Lighthouse is auditing a staging-packaged (noindexed) bundle. The `is-crawlable`
audit fails by design on a noindex document. The audit must run against the normal
indexable `dist/` **before** any environment packaging. See
[`CI-CD.md`](./CI-CD.md#33-why-the-order-matters).

**Staging deploy fails with FTPS 530.**
Authentication was rejected before remote-path selection. Verify only that
environment's four credentials. Never substitute production credentials into the
staging job.

## 14. Release notes

Repository release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md). README intentionally summarizes only the six latest releases. Documentation-only production commits remain excluded from automatic production deploys.

## 15. Health endpoint

Production and staging bundles expose `/api/health`. The endpoint intentionally returns only safe operational data and build metadata. Do not extend it with environment variables, credentials, absolute filesystem paths, raw IP addresses, or secret/config contents.
