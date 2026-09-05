// Derives an environment-specific deploy bundle from the already-tested dist/.
//
// dist/ is built once as a normal, indexable production-like application and is
// what quality gates, verify:dist, Playwright and Lighthouse all run against.
// Environment policy is applied only afterwards, into a separate directory, so
// strict SEO validation can never audit a deliberately non-indexable document.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];
if (target !== "staging" && target !== "production") {
  console.error("Usage: node scripts/package-env.mjs <staging|production>");
  process.exit(1);
}

const sourceDir = resolve("dist");
const outDir = resolve(`dist-${target}`);
if (!existsSync(resolve(sourceDir, "index.html"))) {
  console.error("dist/index.html is missing. Build and validate the application bundle before packaging.");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
cpSync(sourceDir, outDir, { recursive: true });

const indexPath = resolve(outDir, "index.html");
const robotsPath = resolve(outDir, "robots.txt");
const htaccessPath = resolve(outDir, ".htaccess");
const buildInfoPath = resolve(outDir, "build-info.json");

const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));
buildInfo.environment = target;
writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + "\n");

if (target === "staging") {
  let html = readFileSync(indexPath, "utf8");
  const before = html;
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow,noarchive" />');
  if (html === before) {
    console.error("Could not find the robots meta tag in the staging index.html.");
    process.exit(1);
  }
  // Staging must not advertise the production canonical or og:url. Publishing
  // them from a non-indexable host points crawlers at production from a
  // document that is not supposed to participate in discovery at all.
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, "");
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, "");
  writeFileSync(indexPath, html);

  // No Sitemap: line. Staging URLs must never enter sitemap discovery.
  writeFileSync(robotsPath, "User-agent: *\nDisallow: /\n");

  // Insert a global X-Robots-Tag into the first mod_headers block, the one that
  // already carries the site-wide security headers. The later mod_headers block
  // scopes its own X-Robots-Tag to .md files and must be left alone.
  let htaccess = readFileSync(htaccessPath, "utf8");
  const globalHeaderBlock = /(<IfModule\s+mod_headers\.c>\s*\r?\n)(\s*Header\s+always\s+set\s+X-Content-Type-Options)/i;
  if (!globalHeaderBlock.test(htaccess)) {
    console.error("Could not find the global mod_headers block in the staging .htaccess.");
    process.exit(1);
  }
  htaccess = htaccess.replace(globalHeaderBlock, '$1  Header always set X-Robots-Tag "noindex, nofollow, noarchive"\n$2');
  writeFileSync(htaccessPath, htaccess);
}

console.log(`Packaged dist-${target}/ from the tested dist/ bundle.`);
