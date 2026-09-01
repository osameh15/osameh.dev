import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const failures = [];
const pass = message => console.log(`✓ ${message}`);
const fail = message => { failures.push(message); console.error(`✗ ${message}`); };

const portfolio = JSON.parse(readFileSync(resolve("portfolio.json"), "utf8"));
if (portfolio?.schemaVersion && portfolio?.project?.name && portfolio?.sourceExplorer) pass("portfolio.json baseline metadata");
else fail("portfolio.json is missing required portfolio metadata");

const schema = JSON.parse(readFileSync(resolve("portfolio.schema.json"), "utf8"));
if (schema?.$schema && schema?.properties?.project) pass("portfolio.schema.json is readable");
else fail("portfolio.schema.json is invalid or incomplete");

const notes = JSON.parse(readFileSync(resolve("public/notes-index.json"), "utf8"));
const slugs = new Set();
for (const note of notes) {
  if (!/^[a-z0-9-]+$/.test(note.slug || "")) fail(`Invalid note slug: ${note.slug}`);
  if (slugs.has(note.slug)) fail(`Duplicate note slug: ${note.slug}`);
  slugs.add(note.slug);
  if (!note.title || !note.summary || !Array.isArray(note.tags)) fail(`Incomplete note metadata: ${note.slug}`);
  if (!existsSync(resolve(`public/notes-content/${note.slug}.md`))) fail(`Missing markdown file for note: ${note.slug}`);
}
if (!failures.some(item => item.includes("note"))) pass(`${notes.length} engineering notes validated`);

const htaccess = readFileSync(resolve("public/.htaccess"), "utf8");
for (const route of ["api/health", "notes/", "sitemap\\.xml", "projects/"]) {
  if (htaccess.includes(route)) pass(`route contract includes ${route}`); else fail(`Missing route contract: ${route}`);
}

const index = readFileSync(resolve("index.html"), "utf8");
for (const requirement of [/<html[^>]+lang=/i, /<meta[^>]+name=["']viewport["']/i, /<meta[^>]+name=["']description["']/i, /<script[^>]+application\/ld\+json/i]) {
  if (requirement.test(index)) pass(`SEO/accessibility shell check ${requirement}`); else fail(`index.html failed baseline check ${requirement}`);
}

for (const php of ["public/project.php", "public/note.php", "public/sitemap.php", "public/api/health.php"]) {
  if (existsSync(resolve(php))) pass(`${php} present`); else fail(`${php} missing`);
}

if (failures.length) {
  console.error(`\nQuality gates failed (${failures.length}).`);
  process.exit(1);
}
console.log("\nAll repository quality gates passed.");
