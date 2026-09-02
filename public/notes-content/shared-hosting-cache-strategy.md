# A practical cache strategy for Vite on shared hosting

A Vite build naturally separates files that can be cached for a long time from files that must stay fresh. The CDN and origin should preserve that distinction.

## Immutable hashed assets

Production JavaScript and CSS filenames contain content hashes. If the content changes, the URL changes too.

Those files can safely receive a long cache lifetime:

```text
Cache-Control: public, max-age=31536000, immutable
```

The browser never needs to revalidate an old hashed asset because a new deployment references a new URL.

## Files that should remain fresh

The application shell and deployment-control files are different:

- `index.html`
- `build-info.json`
- `sw.js`
- `manifest.webmanifest`

These should be revalidated instead of cached for a year. Otherwise an edge or browser can keep pointing at an older application build.

## Build IDs are useful diagnostics

Every production build writes a unique build ID. After deployment, CI requests `build-info.json` with a cache-busting query and checks whether the public site reports the expected ID.

That does not force a global CDN purge, but it makes propagation problems observable.

## Why this works well on shared hosting

The application does not require a Node runtime at the origin. Vite produces static assets, while small PHP endpoints handle the dynamic pieces.

That keeps the hosting requirements simple while still allowing strong caching, server-side API protection, and CDN delivery.
