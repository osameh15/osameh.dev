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


const availability = JSON.parse(readFileSync(resolve("config/availability.json"), "utf8"));
const requiredAvailabilityStates = ["open", "selective", "freelance", "focused", "unavailable"];
if (!availability?.profiles?.[availability.activeStatus]) fail(`Availability activeStatus is invalid: ${availability?.activeStatus}`);
else pass(`Availability active state validated: ${availability.activeStatus}`);
for (const status of requiredAvailabilityStates) {
  const profile = availability?.profiles?.[status];
  if (!profile?.label || !profile?.shortLabel || typeof profile?.ctaEnabled !== "boolean" || profile?.tone !== status) fail(`Availability profile is incomplete: ${status}`);
}
if (!failures.some(item => item.includes("Availability profile"))) pass(`${requiredAvailabilityStates.length} default availability profiles validated`);
if (!existsSync(resolve("scripts/set-availability.mjs")) || !existsSync(resolve(".github/workflows/availability.yml"))) fail("Availability mood script/workflow is missing");
else pass("Availability supports one-file, CLI, and manual CI mood updates");
const prepareBuildSource = readFileSync(resolve("scripts/prepare-build.mjs"), "utf8");
if (!prepareBuildSource.includes("availabilityMood: availability.activeStatus")) fail("Build metadata does not expose the deployed portfolio mood");
else pass("Build metadata exposes the deployed portfolio mood");

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


const featureCss = readFileSync(resolve("app/features-v5.css"), "utf8");
if (/className=["']case-study-grid["']/.test(featureSource)) fail("v5 client case studies reuse the legacy project case-study-grid class");
else pass("Client case-study grid is namespaced away from the legacy project-detail grid");
if (!/\.client-case-study-grid\{[^}]*background:transparent[^}]*border:0/.test(featureCss)) fail("Client case-study grid must remain background-free");
else pass("Client case-study grid has no backing background/border");
if (/♿/.test(appSource) || /♿/.test(featureSource)) fail("Accessibility UI still uses a colored emoji icon");
else pass("Accessibility controls use theme-compatible vector icons");
if (!appSource.includes('path: "/activity"') || !appSource.includes('github-activity')) fail("GitHub Activity is missing from SPA/Explorer navigation");
else pass("GitHub Activity navigation contract is present");
const requiredSectionSequence = ['path: "/projects"', 'path: "/case-studies"', 'path: "/experience"', 'path: "/activity"', 'path: "/now"'];
const sectionPositions = requiredSectionSequence.map(token => appSource.indexOf(token));
if (sectionPositions.some(position => position < 0) || sectionPositions.some((position, index) => index > 0 && position <= sectionPositions[index - 1])) fail("Main section registry is out of document order");
else pass("Main section registry matches Projects → Case Studies → Experience → GitHub Activity → Now");


const packageManifest = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const playwrightVersion = packageManifest?.devDependencies?.["@playwright/test"];
if (playwrightVersion !== "1.62.1") fail("@playwright/test must be pinned to 1.62.1 for deterministic browser E2E");
else pass("Playwright Test is an exact project devDependency");
if (packageManifest?.scripts?.["test:e2e"] !== "playwright test" || packageManifest?.scripts?.["test:e2e:install"] !== "playwright install --with-deps chromium") fail("Playwright project scripts are missing or inconsistent");
else pass("Playwright browser install/test commands are project-owned scripts");

const stagingWorkflow = readFileSync(resolve(".github/workflows/staging.yml"), "utf8");
const productionWorkflow = readFileSync(resolve(".github/workflows/deploy.yml"), "utf8");
const qualityWorkflow = readFileSync(resolve(".github/workflows/quality.yml"), "utf8");
const stagingSecrets = ["STAGING_FTP_HOST", "STAGING_FTP_PORT", "STAGING_FTP_USERNAME", "STAGING_FTP_PASSWORD", "STAGING_FTP_CERT_FINGERPRINT"];
const productionSecrets = ["FTP_HOST", "FTP_PORT", "FTP_USERNAME", "FTP_PASSWORD", "FTP_CERT_FINGERPRINT"];
const stagingSecretsComplete = stagingSecrets.every(name => stagingWorkflow.includes(`secrets.${name}`));
const productionSecretsComplete = productionSecrets.every(name => productionWorkflow.includes(`secrets.${name}`));
if (!/needs:\s*quality/.test(stagingWorkflow) || !/needs\.quality\.result == 'success'/.test(stagingWorkflow) || !stagingSecretsComplete || /secrets\.FTP_(?:HOST|PORT|USERNAME|PASSWORD|CERT_FINGERPRINT)/.test(stagingWorkflow)) fail("Staging workflow is not strictly gated/separated from the five staging credentials");
else pass("Staging deploy waits for quality and uses all five staging-only secrets");
if (!/needs:\s*quality/.test(productionWorkflow) || !/needs\.quality\.result == 'success'/.test(productionWorkflow) || !productionSecretsComplete || /STAGING_FTP_/.test(productionWorkflow)) fail("Production workflow is not strictly gated/separated from the five production credentials");
else pass("Production deploy waits for quality and uses all five production-only secrets");
if (!/--env-password/.test(stagingWorkflow) || !/--env-password/.test(productionWorkflow) || !/LFTP_PASSWORD/.test(stagingWorkflow) || !/LFTP_PASSWORD/.test(productionWorkflow)) fail("FTPS workflows do not use lftp environment-password authentication");
else pass("FTPS passwords stay out of lftp command arguments");
if (!qualityWorkflow.includes("npm run test:e2e:install") || !qualityWorkflow.includes("npm run test:e2e") || /npx playwright/.test(qualityWorkflow)) fail("Quality workflow still relies on ephemeral npx Playwright instead of the project dependency");
else pass("Quality workflow uses the pinned project Playwright dependency");
if (!readFileSync(resolve(".github/workflows/availability.yml"), "utf8").includes("name: Set portfolio mood") || !readFileSync(resolve(".github/workflows/availability.yml"), "utf8").includes("npm run mood")) fail("Portfolio mood workflow contract is missing");
else pass("Portfolio mood workflow updates develop through the central config");
const e2ePosition = qualityWorkflow.indexOf("Browser E2E and accessibility smoke");
const artifactPosition = qualityWorkflow.indexOf("Upload tested deployment bundle");
if (e2ePosition < 0 || artifactPosition < 0 || e2ePosition > artifactPosition) fail("Tested deploy artifact can be created before E2E completes");
else pass("Deployment artifacts are produced only after E2E/Lighthouse quality work");

if (failures.length) {
  console.error(`\nQuality gates failed (${failures.length}).`);
  process.exit(1);
}
console.log("\nAll repository quality gates passed.");
