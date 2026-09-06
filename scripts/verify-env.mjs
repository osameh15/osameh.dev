// Verifies the indexing policy of a packaged deploy bundle.
//
// These are two opposite contracts, checked explicitly rather than assumed:
//   staging    must be non-indexable and must not leak production discovery data
//   production must be indexable and must not inherit any staging noindex policy
//
// A staging transform leaking into production, or a staging bundle that quietly
// became crawlable, fails here before anything is deployed.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];
if (target !== "staging" && target !== "production") {
  console.error("Usage: node scripts/verify-env.mjs <staging|production>");
  process.exit(1);
}

const outDir = resolve(`dist-${target}`);
const failures = [];
const pass = message => console.log(`✓ ${message}`);
const fail = message => { failures.push(message); console.error(`✗ ${message}`); };

const read = name => {
  const path = resolve(outDir, name);
  if (!existsSync(path)) { fail(`Missing ${target} bundle file: ${name}`); return ""; }
  return readFileSync(path, "utf8");
};

const html = read("index.html");
const robots = read("robots.txt");
const htaccess = read(".htaccess");
const buildInfoRaw = read("build-info.json");

const robotsMeta = (html.match(/<meta\s+name=["']robots["'][^>]*content=["']([^"']*)["']/i) || [])[1] || "";
// The .md-scoped X-Robots-Tag is a legitimate production rule. Only a global
// "Header always set X-Robots-Tag" counts as a site-wide indexing policy.
const globalRobotsHeader = /Header\s+always\s+set\s+X-Robots-Tag\s+"([^"]*)"/i.exec(htaccess);
const robotsDisallowsAll = /^\s*Disallow:\s*\/\s*$/m.test(robots);
const robotsAllowsAll = /^\s*Allow:\s*\/\s*$/m.test(robots);

let buildInfo = null;
try { buildInfo = JSON.parse(buildInfoRaw || "{}"); } catch { fail(`${target} build-info.json is not valid JSON`); }

if (buildInfo && buildInfo.environment !== target) fail(`build-info.json environment is "${buildInfo.environment}", expected "${target}"`);
else if (buildInfo) pass(`build-info.json declares the ${target} environment`);

if (target === "staging") {
  for (const directive of ["noindex", "nofollow", "noarchive"]) {
    if (!robotsMeta.toLowerCase().includes(directive)) fail(`Staging robots meta is missing "${directive}" (found: "${robotsMeta}")`);
  }
  if (robotsMeta.toLowerCase().includes("noindex")) pass(`Staging document is non-indexable: "${robotsMeta}"`);

  if (!robotsDisallowsAll) fail("Staging robots.txt does not contain a site-wide Disallow: /");
  else pass("Staging robots.txt disallows all crawling");
  if (robotsAllowsAll) fail("Staging robots.txt still publishes a production Allow: / rule");
  if (/^\s*Sitemap:/mi.test(robots)) fail("Staging robots.txt advertises a sitemap, introducing staging URLs into discovery");
  else pass("Staging robots.txt advertises no sitemap");

  if (!globalRobotsHeader || !/noindex/i.test(globalRobotsHeader[1])) fail("Staging .htaccess is missing a global X-Robots-Tag noindex header");
  else pass(`Staging sends a site-wide X-Robots-Tag: ${globalRobotsHeader[1]}`);

  if (/<link\s+rel=["']canonical["']/i.test(html)) fail("Staging index.html still publishes a canonical URL");
  else pass("Staging publishes no canonical URL");
  if (/<meta\s+property=["']og:url["']/i.test(html)) fail("Staging index.html still publishes an og:url");
  else pass("Staging publishes no og:url");
  if (/https:\/\/staging\.osameh\.dev/i.test(robots)) fail("Staging robots.txt exposes staging URLs");
}

if (target === "production") {
  if (/noindex/i.test(robotsMeta)) fail(`Production robots meta inherited a staging noindex: "${robotsMeta}"`);
  else if (/index/i.test(robotsMeta)) pass(`Production document is indexable: "${robotsMeta}"`);
  else fail(`Production robots meta is missing or unrecognised: "${robotsMeta}"`);

  if (robotsDisallowsAll) fail("Production robots.txt contains a site-wide Disallow: /");
  else pass("Production robots.txt does not block crawling");
  if (!robotsAllowsAll) fail("Production robots.txt is missing Allow: /");
  if (!/^\s*Sitemap:\s*https:\/\/osameh\.dev\/sitemap\.xml\s*$/m.test(robots)) fail("Production robots.txt does not advertise the production sitemap");
  else pass("Production robots.txt advertises the production sitemap");

  if (globalRobotsHeader && /noindex/i.test(globalRobotsHeader[1])) fail(`Production .htaccess inherited a global noindex header: ${globalRobotsHeader[1]}`);
  else pass("Production sends no site-wide X-Robots-Tag noindex header");

  const canonical = (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1] || "";
  if (!/^https:\/\/osameh\.dev\//.test(canonical)) fail(`Production canonical URL is missing or not production-safe: "${canonical}"`);
  else pass(`Production canonical URL is ${canonical}`);
  const ogUrl = (html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i) || [])[1] || "";
  if (!/^https:\/\/osameh\.dev\//.test(ogUrl)) fail(`Production og:url is missing or not production-safe: "${ogUrl}"`);
  else pass(`Production og:url is ${ogUrl}`);

  for (const file of ["sitemap.xml", "sitemap.php"]) {
    if (!existsSync(resolve(outDir, file))) fail(`Production bundle is missing ${file}`);
  }
  const sitemap = read("sitemap.xml");
  if (!/<urlset/i.test(sitemap)) fail("Production sitemap.xml is not a valid urlset");
  else pass("Production sitemap.xml is a valid urlset");
  if (/staging\.osameh\.dev/i.test(sitemap) || /staging\.osameh\.dev/i.test(robots)) fail("Production discovery files reference staging URLs");
}

if (failures.length) {
  console.error(`\n${target} indexing-policy verification failed (${failures.length}).`);
  process.exit(1);
}
console.log(`\nAll ${target} indexing-policy checks passed.`);
