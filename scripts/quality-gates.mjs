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

const caseStudies = JSON.parse(readFileSync(resolve("public/case-studies-index.json"), "utf8"));
const caseIds = new Set();
for (const study of caseStudies) {
  if (!/^[a-z0-9-]+$/.test(study.id || "")) fail(`Invalid case study id: ${study.id}`);
  if (caseIds.has(study.id)) fail(`Duplicate case study id: ${study.id}`);
  caseIds.add(study.id);
  if (!study.title || !study.summary || !Array.isArray(study.stack)) fail(`Incomplete case study metadata: ${study.id}`);
  if (study.privacy === "public" && (!study.siteUrl || !/^https:\/\//.test(study.siteUrl))) fail(`Public case study is missing a safe live-site URL: ${study.id}`);
}
if (!failures.some(item => item.includes("case study"))) pass(`${caseStudies.length} case studies validated`);

const htaccess = readFileSync(resolve("public/.htaccess"), "utf8");
for (const route of ["api/health", "notes/", "case-studies/", "sitemap\\.xml", "projects/"]) {
  if (htaccess.includes(route)) pass(`route contract includes ${route}`); else fail(`Missing route contract: ${route}`);
}

const index = readFileSync(resolve("index.html"), "utf8");
for (const requirement of [/<html[^>]+lang=/i, /<meta[^>]+name=["']viewport["']/i, /<meta[^>]+name=["']description["']/i, /<script[^>]+application\/ld\+json/i]) {
  if (requirement.test(index)) pass(`SEO/accessibility shell check ${requirement}`); else fail(`index.html failed baseline check ${requirement}`);
}

for (const php of ["public/project.php", "public/note.php", "public/case-study.php", "public/sitemap.php", "public/api/health.php"]) {
  if (existsSync(resolve(php))) pass(`${php} present`); else fail(`${php} missing`);
}

const readme = readFileSync(resolve("README.md"), "utf8");
const releaseSection = readme.split("## Release history")[1]?.split("## License")[0] || "";
const readmeReleaseCount = (releaseSection.match(/^### v\d+/gm) || []).length;
if (readmeReleaseCount <= 6) pass(`README release summary capped at ${readmeReleaseCount}/6 releases`);
else fail(`README release summary contains ${readmeReleaseCount} releases; maximum is 6`);
if (!/English-only/i.test(readme) || /English \/ Persian i18n|EN\/FA i18n/i.test(readme)) fail("README language contract is not consistently English-only");
else pass("README English-only product contract");

const appSource = readFileSync(resolve("src/App.tsx"), "utf8");
const featureSource = readFileSync(resolve("src/PortfolioFeatures.tsx"), "utf8");
if (/LanguageControl|setLocale\(|portfolio-locale/.test(appSource)) fail("App still contains locale-switching UI/state");
else pass("App contains no locale switcher");
if (/type Locale =|setLocale\(|data-locale=/.test(featureSource)) fail("Feature preferences still contain locale switching");
else pass("Feature preferences are English-only");

if (failures.length) {
  console.error(`\nQuality gates failed (${failures.length}).`);
  process.exit(1);
}
console.log("\nAll repository quality gates passed.");
