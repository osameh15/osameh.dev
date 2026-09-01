import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  ["public/.htaccess", "dist/.htaccess"],
  ["public/api/github.php", "dist/api/github.php"],
  ["public/api/contact.php", "dist/api/contact.php"],
  ["public/api/analytics.php", "dist/api/analytics.php"],
  ["public/api/health.php", "dist/api/health.php"],
  ["public/project.php", "dist/project.php"],
  ["public/note.php", "dist/note.php"],
  ["public/sitemap.php", "dist/sitemap.php"],
  ["public/notes-index.json", "dist/notes-index.json"],
  ["public/project-og.php", "dist/project-og.php"],
  ["public/not-found.php", "dist/not-found.php"],
  ["public/manifest.webmanifest", "dist/manifest.webmanifest"],
  ["public/sw.js", "dist/sw.js"],
  ["public/icons/icon-192.png", "dist/icons/icon-192.png"],
  ["public/icons/icon-512.png", "dist/icons/icon-512.png"],
  ["public/icons/apple-touch-icon.png", "dist/icons/apple-touch-icon.png"],
  ["public/resume/Osameh_Irandoust_CV.pdf", "dist/resume/Osameh_Irandoust_CV.pdf"],
  ["public/favicon.svg", "dist/favicon.svg"],
  ["public/og-cover.webp", "dist/og-cover.webp"],
  ["public/og-cover-social.jpg", "dist/og-cover-social.jpg"],
  ["public/build-info.json", "dist/build-info.json"],
];

for (const [source, target] of files) {
  const from = resolve(source);
  const to = resolve(target);
  if (!existsSync(from)) throw new Error(`Missing deployment file: ${source}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

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
