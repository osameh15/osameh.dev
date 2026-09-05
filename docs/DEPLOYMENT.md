# Deployment — osameh.dev v5.1.0

Target: ParsPack shared Linux hosting + ParsPack CDN + PHP 8+.

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

Keep the GitHub token outside all public directories:

```text
domains/osameh.dev/private/osameh-portfolio-secrets.php
```

```php
<?php
return [
    'GITHUB_TOKEN' => 'github_pat_xxxxxxxxx',
];
```

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
├── favicon.svg
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


## CDN-compatible 404 behavior

ParsPack CDN currently replaces an upstream HTTP `404` response body with its own
`Upstream Error - Not Found` document. To preserve the portfolio's IDE-style 404
workspace, unknown browser routes intentionally return the React shell with HTTP
`200`, plus:

```text
X-Robots-Tag: noindex, nofollow
X-Portfolio-Route-Status: 404
Cache-Control: no-cache, must-revalidate
```

React reads `window.location.pathname` and renders `404.md` inside the IDE workspace.
The invalid route is therefore visible to the visitor but excluded from indexing.
If the CDN later supports pass-through/custom origin error bodies, this compatibility
layer can be switched back to a true HTTP 404.

Smoke-test both a generic missing path and a missing project:

```text
https://osameh.dev/this-route-does-not-exist
https://osameh.dev/projects/ThisRepoDoesNotExist
```

Both should display the in-app 404 workspace rather than a CDN upstream error page.

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

## 8. Security checks

Confirm response headers on the root document include:

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

## 13. Release notes

Repository release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md). README intentionally summarizes only the six latest releases. Documentation-only production commits remain excluded from automatic production deploys.

## 14. Health endpoint

Production and staging bundles expose `/api/health`. The endpoint intentionally returns only safe operational data and build metadata. Do not extend it with environment variables, credentials, absolute filesystem paths, raw IP addresses, or secret/config contents.
