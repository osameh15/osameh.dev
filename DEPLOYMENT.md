# Deploy osameh.dev — Production v7

## 1. Build locally

```bash
npm install
npm run build
```

The deployable output is `dist/`.

The build step also:

- copies `.htaccess`, the PHP GitHub proxy, favicon and OG cover to `dist/`;
- calculates the SHA-256 hash of the final JSON-LD block in `dist/index.html`;
- injects that hash into `dist/.htaccess` so the strict CSP remains valid.

## 2. Expected host structure

Your domain should ultimately serve `public_html` for HTTPS as well (DirectAdmin commonly does this with `private_html -> public_html`).

```text
/home/<account>/domains/osameh.dev/
├── private/
│   ├── osameh-portfolio-secrets.php
│   └── osameh-portfolio-cache/      # created automatically when writable
├── public_html/
│   ├── .htaccess
│   ├── index.html
│   ├── assets/
│   ├── api/
│   │   └── github.php
│   ├── favicon.svg
│   ├── og-cover.webp
│   ├── og-cover-social.jpg
│   ├── build-info.json
│   ├── robots.txt
│   └── sitemap.xml
└── private_html -> public_html      # recommended DirectAdmin layout
```

## 3. GitHub token

Keep the token server-side only.

Preferred if the hosting panel supports real PHP environment variables:

```text
GITHUB_TOKEN=github_pat_...
```

Otherwise keep the existing file **outside** every web root:

```text
/home/<account>/domains/osameh.dev/private/osameh-portfolio-secrets.php
```

```php
<?php
return [
    'GITHUB_TOKEN' => 'github_pat_...',
];
```

A fine-grained token with read-only access to the required public repositories is sufficient. Never use `VITE_GITHUB_TOKEN`, never place the token in frontend JavaScript, and never commit the private secrets file.

## 4. Deploy

Back up the current `public_html` first, then upload the **contents** of `dist/` to `public_html/`.

After upload, purge ParsPack CDN cache once.

You do not need a CDN Cache Bypass rule for the API for this build. `github.php` emits all of these headers for API responses:

```text
Cache-Control: private, no-store, max-age=0
CDN-Cache-Control: no-store
Surrogate-Control: no-store
```

The PHP origin still keeps its own private filesystem cache:

- repository list: fresh for 15 minutes, stale fallback up to 7 days;
- README: fresh for 6 hours, stale fallback up to 30 days.

## 5. Post-deploy checks

Open:

```text
https://osameh.dev/
https://osameh.dev/favicon.svg
https://osameh.dev/og-cover.webp
https://osameh.dev/og-cover-social.jpg
https://osameh.dev/build-info.json
https://osameh.dev/api/github/repos
https://osameh.dev/api/github/readme/Mizekar
```

The secret URL must **not** exist publicly:

```text
https://osameh.dev/osameh-portfolio-secrets.php
```

Expected: `404 / File Not Found`.

Also verify an arbitrary README proxy request is rejected:

```text
https://osameh.dev/api/github/readme/definitely-not-a-real-repo
```

Expected: `404`.

## 6. CDN/cache behavior

- Hashed Vite JS/CSS/font assets: 1 year + `immutable`.
- Normal images: 30 days.
- `favicon.svg`: 7 days.
- `og-cover.webp`: 1 day so social-preview updates are not stuck for a year.
- `index.html`, `robots.txt`, `sitemap.xml`: revalidate/no-cache.
- API: no browser/CDN storage; origin PHP cache only.

## 7. Security behavior

The built `.htaccess` enables:

- HTTPS HSTS with subdomains;
- `X-Content-Type-Options: nosniff`;
- clickjacking protection;
- restrictive Permissions Policy;
- no directory listing;
- strict CSP with `connect-src 'self'`; inline scripts remain blocked except for the build-hashed JSON-LD block. `style-src-attr 'unsafe-inline'` is narrowly enabled only because the desktop context menu needs runtime cursor coordinates; stylesheet sources remain restricted to `'self'`;
- no objects/frames/forms/workers;
- forced `www` → apex redirect;
- SPA fallback without allowing `/api/*` to fall into `index.html`.

## Gallery verification

After deployment and CDN purge, test:

```text
https://osameh.dev/api/github/images/Dialysis
```

It should return JSON entries such as `Images/splash_screen.jpg`. Then open the Dialysis project page and confirm the gallery contains all repository images found under `Images/` (case-insensitive), `docs/`, `screenshots/`, or `media/`.

The gallery API is intentionally marked `no-store` for browser/CDN caching; PHP keeps its own origin cache so GitHub is not called on every visit.

## Verify the deployed build

After `npm run build`, upload the contents of `dist/` and purge the CDN. Then open:

```text
https://osameh.dev/build-info.json
```

The `buildId` must match the version shown in the portfolio footer/status bar. If they differ, the browser or a CDN edge is serving stale content.

## Social preview image

The Open Graph/Twitter image is now:

```text
https://osameh.dev/og-cover-social.jpg
```

It is a 1200×630 progressive JPEG for maximum crawler compatibility. After deploying, verify the image opens directly with HTTP 200 and `Content-Type: image/jpeg`. Social platforms cache link previews independently of your CDN, so an old preview can persist briefly even after a CDN purge. The new filename intentionally forces a fresh image URL.


## v1.3.0 interaction verification

After deploy, verify on desktop:

1. Right-click empty workspace: the custom context menu should appear near the pointer.
2. Right-click a project card: project-specific actions should appear.
3. Right-click a gallery image: image actions and fullscreen gallery action should appear.
4. Right-click a normal link: open/copy link actions should appear.
5. Select text and right-click: `Copy selection` should be available.
6. Right-click inside the terminal input or another editable field: the browser-native menu should remain available.
7. Press `Ctrl+K` / `Cmd+K`: Command Palette should open with its search box focused.
8. Open the terminal using the explorer, status bar, backtick shortcut, context menu, Command Palette, or the easter egg: the command input must receive focus immediately.
9. Run `hire` or `sudo hire osameh` in the terminal to verify the easter egg.
10. Test both light and dark themes. Long-press on mobile should continue to use normal touch/browser behavior.

Project links copied from the context menu use:

```text
https://osameh.dev/projects/<repo>
```

The SPA resolves these routes after the live repository list loads.
