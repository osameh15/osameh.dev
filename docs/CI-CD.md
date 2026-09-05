# CI/CD Pipeline — Technical Reference

**Applies to:** v5.1.1
**Scope:** how code reaches `staging.osameh.dev` and `osameh.dev`, what blocks a
deployment, and why the pipeline is shaped the way it is.

For credentials, DNS, CDN and hosting runbooks see [`DEPLOYMENT.md`](./DEPLOYMENT.md).
For how the deployed system behaves see [`ARCHITECTURE.md`](./ARCHITECTURE.md), and for
what each command verifies see [`TESTING.md`](./TESTING.md). This document covers
the automation itself.

---

## 1. Workflow inventory

| File | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/quality.yml` | `pull_request` -> `main`/`develop`, `workflow_dispatch`, `workflow_call` | The single reusable validation pipeline. Builds, validates, packages and uploads the deploy artifact. |
| `.github/workflows/staging.yml` | push to `develop`, `workflow_dispatch` | Calls `quality.yml` with `deploy_env: staging`, then deploys to `staging.osameh.dev`. |
| `.github/workflows/deploy.yml` | push to `main` (ignoring `README.md`, `docs/**`), `workflow_dispatch` | Calls `quality.yml` with `deploy_env: production`, then deploys to `osameh.dev`. |
| `.github/workflows/availability.yml` | `workflow_dispatch` | Portfolio Mood only. Edits `config/availability.json`, commits to `develop`, which then runs the staging pipeline. Never deploys directly. |

`quality.yml` is the only place that builds. Both deploy workflows consume its
artifact; neither can build or validate on its own.

---

## 2. Delivery flow

```text
feature/*
   |  pull request
develop ---------------------------> staging.osameh.dev
   |  manual verification
   |  develop -> main
main ------------------------------> osameh.dev
```

A pull request into either branch runs `quality.yml` without a `deploy_env`, so
it validates but produces no artifact and cannot deploy.

---

## 3. The reusable quality pipeline

### 3.1 Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `deploy_env` | `""` | `staging` or `production`. Selects **only** the packaging/verification phase. Empty means validate-only. |
| `artifact_name` | `""` | Artifact name for the calling deploy workflow. Upload requires both inputs to be non-empty. |

There is deliberately **no build-mode input**. The build is byte-identical for
every environment.

### 3.2 Step order

```text
Checkout
   v
Setup Node.js 22
   v
Install dependencies          (npm ci when the lockfile matches, else npm install + warning)
   v
Repository quality gates      npm run quality
   v
TypeScript                    npm run typecheck
   v
PHP lint                      find public -name '*.php' | xargs -n1 php -l
   v
Build tested application bundle   npm run build      -> dist/   (indexable)
   v
Verify deployment bundle          npm run verify:dist
   v
Install Playwright browser        npm run test:e2e:install
   v
Browser E2E                       npm run test:e2e
   v
Lighthouse quality report         audits dist/ via vite preview
   v
Package <env> bundle + verify     npm run package:<env> && npm run verify:<env>
   v
Upload verified environment bundle -> dist-<env>/
```

Failure at any step aborts the job, so no artifact exists and the dependent
deploy job never starts.

### 3.3 Why the order matters

**Build once, validate once, derive per environment.** This is load-bearing, not
stylistic.

Before v5.1.0's CI fix, `staging.yml` passed `build_mode: staging`, which ran a
staging-specific build that injected `noindex` into `dist/` *before* Lighthouse
ran. Lighthouse then audited a deliberately non-indexable document: the
`is-crawlable` audit failed (weight 4.04 of 11.04) and the SEO category scored
**63**, blocking every staging deployment — while the application itself scored
**100**.

Environment policy is now applied only after all application-level validation,
into a separate directory. `dist/` is never mutated in place, so the audited
artifact and the deployed artifact stay distinguishable.

---

## 4. Artifact strategy

| Directory | Produced by | Indexable | Purpose |
| --- | --- | --- | --- |
| `dist/` | `npm run build` | yes | The one tested bundle. Everything validates against this. |
| `dist-staging/` | `npm run package:staging` | **no** | Staging deploy artifact. |
| `dist-production/` | `npm run package:production` | yes | Production deploy artifact. |

`scripts/package-env.mjs <env>` copies `dist/` to `dist-<env>/` and stamps
`build-info.json` with the environment. For staging it additionally:

- rewrites the robots meta to `noindex,nofollow,noarchive`
- writes `robots.txt` as `User-agent: * / Disallow: /` with **no** `Sitemap:` line
- strips the production canonical and `og:url`
- inserts a global `X-Robots-Tag` into the first `mod_headers` block, leaving the
  `.md`-scoped rule intact

Every substitution is asserted; a missing anchor fails the build rather than
silently shipping a crawlable staging bundle. Both derived directories are
gitignored.

### 4.1 Hidden files

The upload step sets:

```yaml
include-hidden-files: true
```

`actions/upload-artifact@v4` excludes dot-files by default (since v4.4.0).
`.htaccess` is the only hidden file in the bundle, and it carries the rewrite
rules, CSP, security headers and the staging `X-Robots-Tag`. Without this flag it
was silently dropped from the artifact — and because deployment mirrors with
`--delete`, the next deploy would have **removed `.htaccess` from the server**.
Both deploy jobs therefore assert it survived the round trip before `lftp` runs,
naming the missing file if not.

---

## 5. Environment indexing contracts

`scripts/verify-env.mjs <env>` enforces two opposite contracts. Both run inside
the quality job, before an artifact exists.

| | staging | production |
| --- | --- | --- |
| robots meta | must contain `noindex`, `nofollow`, `noarchive` | must not contain `noindex` |
| `robots.txt` | site-wide `Disallow: /` | no `Disallow: /`, must have `Allow: /` |
| sitemap in robots | must be absent | must advertise the production sitemap |
| global `X-Robots-Tag` | required | must be absent |
| canonical / `og:url` | must be absent | must be `https://osameh.dev/...` |
| `build-info.json` | `environment: staging` | `environment: production` |

A staging transform leaking into production, or a staging bundle that quietly
became crawlable, fails here. Both directions are negative-tested: running
`verify:staging` against a production bundle produces 10 failures, and
`verify:production` against a staging bundle produces 8.

---

## 6. Quality gates

`scripts/quality-gates.mjs` is static analysis over the repository's product and
architecture contracts — it runs before anything is built. It enforces, among
others:

- valid availability profiles and the Mood workflow contract
- Engineering Note and Case Study metadata integrity
- SEO route-support files, GitHub Activity present in routing and both sitemaps
- one Command Palette shortcut; required Terminal coverage
- all 11 `role="dialog"` consumers routed through the shared modal system
- README capped at six releases and containing the current `package.json` version
- staging/production secret separation, with no cross-environment fallback
- **workflow step order**: build -> E2E -> Lighthouse -> packaging -> upload
- no `build_mode` / `npm run build:staging` may return
- packaging must derive `dist-<env>/`, never mutate `dist/`
- staging packaging applies noindex; production packaging never does
- artifact upload sets `include-hidden-files`
- Service Worker correctness (see below)

The ordering gate is regression-tested: reordering the workflow to package
staging before Lighthouse — the original defect — makes `npm run quality` exit 1.

### 6.1 Service Worker verification

The Service Worker registers only over HTTPS, so no local browser run loads it.
`scripts/verify-sw.mjs` executes the real `public/sw.js` in a sandboxed worker
environment and asserts:

- the response clone is taken **before** the body is consumed
- a failed cache write never surfaces as an unhandled rejection
- `/api/*` is never intercepted or cached

It reproduces the v5.1.0 failure verbatim (`Failed to execute 'clone' on
'Response': Response body is already used`) when run against the old worker. It
is invoked from `quality-gates.mjs`, so CI runs it without a separate step.

---

## 7. Testing in CI

**Playwright** — `@playwright/test` is pinned to an exact version as a project
devDependency. CI installs the matching browser with `npm run test:e2e:install`
before running `npm run test:e2e`; it never uses an ephemeral `npx playwright`.
`playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so CI always
builds and serves its own controlled preview while local runs reuse a running one.
On failure the job uploads `playwright-report/` and `test-results/`.

**Lighthouse** — pinned at `lighthouse@12.8.2`, audited against `dist/` served by
`vite preview` on `127.0.0.1:4173`, categories `accessibility,best-practices,seo`,
minimum **0.9** each. On failure every failing audit is emitted as a `::error::`
annotation and the JSON + HTML report and preview log are uploaded as artifacts.
Report paths are workspace-relative; absolute `/tmp` paths are not reliably
uploadable.

Current baseline: **48 Playwright tests**; Lighthouse **accessibility 95,
best-practices 96, SEO 100**.

---

## 8. Deployment jobs

Both deploy jobs are structurally identical and differ only in host, artifact and
credentials.

```text
needs: quality
if: needs.quality.result == 'success'
   v
Download verified artifact -> dist/
   v
Validate bundle            (names any missing file, incl. .htaccess)
   v
Install lftp
   v
Verify FTPS certificate fingerprint   (SHA-256 or SHA-1, exact match)
   v
Preflight FTPS login                  (fails early with an explicit message)
   v
lftp mirror --reverse --delete        (excludes .well-known/, cgi-bin/)
   v
Verify live build fingerprint
```

Passwords are passed via `LFTP_PASSWORD` with `--env-password`, never as command
arguments. Staging fails hard if the deployed `robots.txt` is not
`Disallow: /`. Production warns rather than fails if the CDN still reports a
stale build after its retries, because the upload itself already succeeded.

---

## 9. Secret separation

No fallback, no aliasing, no sharing. Enforced by a quality gate that fails if
either workflow references the other environment's secrets.

| Staging only | Production only |
| --- | --- |
| `STAGING_FTP_HOST` | `FTP_HOST` |
| `STAGING_FTP_PORT` | `FTP_PORT` |
| `STAGING_FTP_USERNAME` | `FTP_USERNAME` |
| `STAGING_FTP_PASSWORD` | `FTP_PASSWORD` |
| `STAGING_FTP_CERT_FINGERPRINT` | `FTP_CERT_FINGERPRINT` |

A staging `530` is never resolved by substituting production credentials.

---

## 10. What blocks a deployment

| Failure | Consequence |
| --- | --- |
| Quality gates, TypeScript, PHP lint | no build, no artifact, no deploy |
| Build or `verify:dist` | no artifact, no deploy |
| Playwright | no artifact, no deploy |
| Lighthouse below threshold | no artifact, no deploy |
| `verify:staging` / `verify:production` | no artifact, that environment does not deploy |
| Missing `.htaccess` in the artifact | deploy job fails before `lftp` runs |
| FTPS fingerprint mismatch or login failure | deploy fails before any file transfer |

Re-running only a deploy job cannot bypass a failed quality job: the artifact it
depends on will not exist.

---

## 11. Local equivalents

```bash
npm run quality            # static contracts + Service Worker verification
npm run typecheck
npm run build              # the one indexable bundle
npm run verify:dist
npm run test:e2e           # requires npm run test:e2e:install once

npm run package:staging && npm run verify:staging
npm run package:production && npm run verify:production
```

### Known local gaps

`vite preview` is a static server: it executes **no PHP and no `.htaccess`**.
The following are therefore staging-only acceptance checks and cannot be proven
locally — do not report them as locally passing:

- true HTTP 404 status, the 404 `X-Robots-Tag`, and the noindex meta rewrite
- every `/api/*` endpoint, including the GitHub Source Explorer
- CDN error pass-through and cache behavior
- Service Worker registration (HTTPS only; covered by `verify-sw.mjs` instead)

PHP lint also requires a local `php` binary; where unavailable, CI is the only
place it runs.
