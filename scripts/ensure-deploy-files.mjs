import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { errorPageFiles } from "./error-pages.mjs";

const files = [
  ["backend/server/.htaccess", "dist/.htaccess"],
  ["backend/api/github.php", "dist/api/github.php"],
  ["backend/api/contact.php", "dist/api/contact.php"],
  ["backend/lib/recaptcha.php", "dist/api/recaptcha.php"],
  ["backend/lib/config.php", "dist/api/config.php"],
  ["backend/lib/health-probe.php", "dist/api/health-probe.php"],
  ["backend/api/analytics.php", "dist/api/analytics.php"],
  ["backend/api/forbidden.php", "dist/api/forbidden.php"],
  ["backend/api/health.php", "dist/api/health.php"],
  ["backend/seo/project.php", "dist/project.php"],
  ["backend/seo/note.php", "dist/note.php"],
  ["backend/seo/case-study.php", "dist/case-study.php"],
  ["frontend/public/case-studies-index.json", "dist/case-studies-index.json"],
  ["backend/seo/sitemap.php", "dist/sitemap.php"],
  ["frontend/public/notes-index.json", "dist/notes-index.json"],
  ["backend/seo/project-og.php", "dist/project-og.php"],
  ["backend/seo/not-found.php", "dist/not-found.php"],
  ["frontend/public/manifest.webmanifest", "dist/manifest.webmanifest"],
  ["frontend/public/sw.js", "dist/sw.js"],
  ["frontend/public/icons/favicon.ico", "dist/icons/favicon.ico"],
  ["frontend/public/favicon.ico", "dist/favicon.ico"],
  ["frontend/public/favicon-48x48.png", "dist/favicon-48x48.png"],
  ["frontend/public/icons/icon-16x16.png", "dist/icons/icon-16x16.png"],
  ["frontend/public/icons/icon-32x32.png", "dist/icons/icon-32x32.png"],
  ["frontend/public/icons/icon-48x48.png", "dist/icons/icon-48x48.png"],
  ["frontend/public/icons/icon-64x64.png", "dist/icons/icon-64x64.png"],
  ["frontend/public/icons/icon-128x128.png", "dist/icons/icon-128x128.png"],
  ["frontend/public/icons/icon-256x256.png", "dist/icons/icon-256x256.png"],
  ["frontend/public/icons/pwa-192x192.png", "dist/icons/pwa-192x192.png"],
  ["frontend/public/icons/pwa-512x512.png", "dist/icons/pwa-512x512.png"],
  ["frontend/public/icons/apple-touch-icon.png", "dist/icons/apple-touch-icon.png"],
  ["frontend/public/resume/Osameh_Irandoust_CV.pdf", "dist/resume/Osameh_Irandoust_CV.pdf"],
  ["frontend/public/og-cover.webp", "dist/og-cover.webp"],
  ["frontend/public/og-cover-social.jpg", "dist/og-cover-social.jpg"],
  ["frontend/public/build-info.json", "dist/build-info.json"],
];

for (const [source, target] of files) {
  const from = resolve(source);
  const to = resolve(target);
  if (!existsSync(from)) throw new Error(`Missing deployment file: ${source}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// The branded HTTP error documents Apache serves through ErrorDocument. They are
// assembled here, beside .htaccess and the service worker, because they are part
// of the server contract rather than of the application bundle.
for (const [relativePath, contents] of errorPageFiles()) {
  const target = resolve("dist", relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

// Vite copies public/ wholesale, including authoring-only design/master
// variants. Keep them in source without shipping roughly 5 MB of unused
// artwork in every deploy bundle.
const nonRuntimeAssets = [
  "dist/icons/README.md",
  "dist/icons/osameh-neural-cipher-source.png",
  "dist/icons/icon-1024x1024.png",
  "dist/icons/app-icon-180x180.png",
  "dist/icons/app-icon-192x192.png",
  "dist/icons/app-icon-512x512.png",
  "dist/og-cover-background.png",
  // The authoring master for the social cover. The runtime metadata, the
  // service worker and the three PHP metadata layers all reference
  // og-cover-social.jpg; nothing references this PNG, and it is 717 KB.
  "dist/og-cover-social.png",
];
for (const asset of nonRuntimeAssets) rmSync(resolve(asset), { force: true });

// Keep the strict CSP valid even if Vite changes whitespace around the JSON-LD block.
// The source .htaccess contains a placeholder; the built dist/.htaccess receives the exact hash.
const indexPath = resolve("dist/index.html");
const htaccessPath = resolve("dist/.htaccess");
const html = readFileSync(indexPath, "utf8");
const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
if (!jsonLdMatch) throw new Error("Missing JSON-LD script in dist/index.html");

const jsonLdHash = createHash("sha256").update(jsonLdMatch[1], "utf8").digest("base64");
let htaccess = readFileSync(htaccessPath, "utf8");
if (!htaccess.includes("__JSONLD_CSP_HASH__")) throw new Error("Missing JSON-LD CSP placeholder in dist/.htaccess");
htaccess = htaccess.replaceAll("__JSONLD_CSP_HASH__", jsonLdHash);
writeFileSync(htaccessPath, htaccess);


// Generate a build-specific service-worker cache and precache the hashed Vite
// entry assets referenced by the built document. This makes the installed PWA
// genuinely usable offline after the first successful installation/load.
const swPath = resolve("dist/sw.js");
const buildInfoPath = resolve("dist/build-info.json");
const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));
const assetMatches = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)].map(match => match[1]);
const precacheAssets = [...new Set(assetMatches)];
let sw = readFileSync(swPath, "utf8");
sw = sw.replace(/^const CACHE_VERSION = .*?; \/\/ __CACHE_VERSION__$/m, `const CACHE_VERSION = ${JSON.stringify(`osameh-portfolio-${buildInfo.buildId || "production"}`)}; // generated`);
sw = sw.replace(/^const PRECACHE_ASSETS = .*?; \/\/ __PRECACHE_ASSETS__$/m, `const PRECACHE_ASSETS = ${JSON.stringify(precacheAssets)}; // generated`);
writeFileSync(swPath, sw);
