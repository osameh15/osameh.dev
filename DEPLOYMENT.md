# Production deployment — osameh.dev v2.0.1

Target: ParsPack shared Linux hosting + ParsPack CDN + PHP 8+.

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
https://osameh.dev/api/github/readme/Mizekar
https://osameh.dev/api/github/images/Dialysis
```

Expected: HTTP 200 and valid JSON/Markdown.

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
4. confirm `GET /api/contact` returns a CSRF token
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
