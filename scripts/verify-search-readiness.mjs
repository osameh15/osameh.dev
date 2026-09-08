// Search-discovery readiness.
//
// Google still shows a stale indexed snapshot of this domain from before it was
// a portfolio ("Secured Home of osameh.dev" / the private_html placeholder) and
// shows no custom favicon. Nothing here talks to Google or Search Console: these
// are the mechanics on our side that have to be correct before a recrawl can
// help, checked in the repository and again in the built bundle.
//
// It deliberately does NOT add SSR or prerendering. Live URL testing already
// reports the current pages as available to Google.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Text from the pre-portfolio hosting placeholder. It must exist nowhere. */
const LEGACY_PLACEHOLDER = [
  "Secured Home of osameh.dev",
  "private_html folder",
  "upload a new index.html",
];

/** Favicon declarations that must be present in the initial HTML, unhashed. */
const FAVICON_DECLARATIONS = [
  'rel="icon" href="/favicon.ico"',
  'href="/favicon-48x48.png"',
];

/**
 * @param {string} indexPath The HTML document to inspect.
 * @param {string[]} scanned Additional files to scan for placeholder text.
 * @returns {string[]} Failure messages, empty when ready.
 */
export function verifySearchReadiness(indexPath = "frontend/index.html", scanned = []) {
  const failures = [];
  if (!existsSync(resolve(indexPath))) return [`Missing document: ${indexPath}`];
  const html = readFileSync(resolve(indexPath), "utf8");

  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
  if (!/Osameh Irandoust/.test(title)) failures.push(`Homepage title does not describe the portfolio: "${title}"`);
  if (LEGACY_PLACEHOLDER.some(text => title.includes(text))) failures.push("Homepage title still carries the legacy hosting placeholder");

  const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1] || "";
  if (description.length < 40) failures.push("Homepage meta description is missing or too short to be useful");

  const canonical = (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1] || "";
  if (canonical !== "https://osameh.dev/") failures.push(`Homepage canonical must be https://osameh.dev/, found "${canonical}"`);

  const ogUrl = (html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i) || [])[1] || "";
  if (ogUrl !== "https://osameh.dev/") failures.push(`og:url must be https://osameh.dev/, found "${ogUrl}"`);

  const ogImage = (html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) || [])[1] || "";
  if (!/og-cover-social\.jpg$/.test(ogImage)) failures.push(`og:image must be the canonical social card, found "${ogImage}"`);

  // The favicon must be declared in the initial HTML, not injected at runtime,
  // and must live at a path the build never hashes or renames.
  for (const declaration of FAVICON_DECLARATIONS) {
    if (!html.includes(declaration)) failures.push(`Initial HTML is missing a stable favicon declaration: ${declaration}`);
  }
  for (const hashed of html.match(/<link[^>]+rel=["']icon["'][^>]*>/gi) || []) {
    if (/\/assets\//.test(hashed)) failures.push("A favicon is declared from the hashed asset pipeline; search engines need a stable URL");
  }

  for (const file of [indexPath, ...scanned]) {
    if (!existsSync(resolve(file))) continue;
    const source = readFileSync(resolve(file), "utf8");
    for (const text of LEGACY_PLACEHOLDER) {
      if (source.includes(text)) failures.push(`${file} still contains legacy placeholder text: "${text}"`);
    }
  }

  return failures;
}

/**
 * Bundle-level checks: the favicon files exist at their stable paths and the
 * sitemap still lists exactly the intended canonical documents.
 *
 * @param {string} root A built bundle directory.
 * @param {number} expectedSitemapUrls
 */
export function verifyBuiltSearchAssets(root, expectedSitemapUrls = 17) {
  const failures = [];
  for (const asset of ["favicon.ico", "favicon-48x48.png"]) {
    if (!existsSync(resolve(root, asset))) failures.push(`${root}/${asset} is missing; the search favicon must ship at a stable root path`);
  }
  const sitemapPath = resolve(root, "sitemap.xml");
  if (!existsSync(sitemapPath)) failures.push(`${root}/sitemap.xml is missing`);
  else {
    const count = (readFileSync(sitemapPath, "utf8").match(/<loc>/g) || []).length;
    if (count !== expectedSitemapUrls) failures.push(`${root}/sitemap.xml lists ${count} URLs, expected ${expectedSitemapUrls}`);
  }
  return failures;
}
