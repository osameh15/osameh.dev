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
const moodScriptSource = existsSync(resolve("scripts/set-availability.mjs")) ? readFileSync(resolve("scripts/set-availability.mjs"), "utf8") : "";
if (!moodScriptSource || !existsSync(resolve(".github/workflows/availability.yml"))) fail("Availability mood script/workflow is missing");
else pass("Availability supports one-file, CLI, and manual CI mood updates");
if (!["Preset:", "Short label:", "Public header label:"].every(label => moodScriptSource.includes(label))) fail("Mood CLI does not distinguish the preset, short label, and public header label");
else pass("Mood CLI labels preset, short, and public header values explicitly");
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
const firstClassRouteRule = htaccess.split(/\r?\n/).find(line => line.includes("RewriteRule") && line.includes("index.html")) || "";
const sitemapPhp = readFileSync(resolve("public/sitemap.php"), "utf8");
const sitemapXml = readFileSync(resolve("public/sitemap.xml"), "utf8");
if (!firstClassRouteRule.includes("activity") || !sitemapPhp.includes("https://osameh.dev/activity") || !sitemapXml.includes("https://osameh.dev/activity")) fail("GitHub Activity is missing from first-class routing or a sitemap implementation");
else pass("GitHub Activity is first-class in Apache routing and both sitemaps");

const contactSource = readFileSync(resolve("public/api/contact.php"), "utf8");
const allowedContactOrigins = ["https://osameh.dev", "https://www.osameh.dev", "https://staging.osameh.dev"];
if (!allowedContactOrigins.every(origin => contactSource.includes(`'${origin}'`)) || /Access-Control-Allow-Origin:\s*\*/i.test(contactSource)) fail("Contact origin policy must allow only the explicit production and staging origins");
else pass("Contact origin policy explicitly supports production and staging smoke tests");

const index = readFileSync(resolve("index.html"), "utf8");
for (const requirement of [/<html[^>]+lang=/i, /<meta[^>]+name=["']viewport["']/i, /<meta[^>]+name=["']description["']/i, /<script[^>]+application\/ld\+json/i]) {
  if (requirement.test(index)) pass(`SEO/accessibility shell check ${requirement}`); else fail(`index.html failed baseline check ${requirement}`);
}

for (const php of ["public/project.php", "public/note.php", "public/case-study.php", "public/sitemap.php", "public/api/health.php"]) {
  if (existsSync(resolve(php))) pass(`${php} present`); else fail(`${php} missing`);
}

const readme = readFileSync(resolve("README.md"), "utf8");
const deploymentGuide = readFileSync(resolve("docs/DEPLOYMENT.md"), "utf8");
const supportedNodeRuntime = "Node.js >=20.19.0 or >=22.12.0";
if (!readme.includes(supportedNodeRuntime) || !deploymentGuide.includes(supportedNodeRuntime)) fail("README and deployment guide do not match the Vite 8 Node.js runtime requirement");
else pass("Documentation declares the supported Vite 8 Node.js runtime");
const releaseSection = readme.split("## Release history")[1]?.split("## License")[0] || "";
const readmeReleaseCount = (releaseSection.match(/^### v\d+/gm) || []).length;
if (readmeReleaseCount <= 6) pass(`README release summary capped at ${readmeReleaseCount}/6 releases`);
else fail(`README release summary contains ${readmeReleaseCount} releases; maximum is 6`);
if (!/English-only/i.test(readme) || /English \/ Persian i18n|EN\/FA i18n/i.test(readme)) fail("README language contract is not consistently English-only");
else pass("README English-only product contract");

const packageVersion = JSON.parse(readFileSync(resolve("package.json"), "utf8")).version;
if (!readme.includes(`### v${packageVersion}`) || !readFileSync(resolve("docs/CHANGELOG.md"), "utf8").includes(`## ${packageVersion} -`)) fail("Current package version is not represented in README/docs/CHANGELOG release history");
else pass(`Documentation includes current release v${packageVersion}`);

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
if (!appSource.includes('Ctrl/Cmd+Shift+P') || /ctrlKey[^\n]{0,140}key ===? ["']k/i.test(appSource)) fail("Command Palette shortcut contract is inconsistent or Ctrl/Cmd+K alias remains");
else pass("Command Palette uses one Ctrl/Cmd + Shift + P shortcut");
if (!appSource.includes("ENGINEERING NOTE") || !appSource.includes("CASE STUDY") || !featureSource.includes("data-note-slug") && !readFileSync(resolve("src/EngineeringNotes.tsx"), "utf8").includes("data-note-slug")) fail("Dedicated Note/Case Study context-menu hooks are incomplete");
else pass("Engineering Notes and Case Studies expose dedicated context-menu hooks/actions");
const terminalContracts = ["case-studies", "case <id>", "capabilities", "activity", "palette", "mood:list", "accessibility"];
if (!terminalContracts.every(token => appSource.includes(token))) fail("Terminal command coverage is missing one or more v5.1 feature commands");
else pass("Terminal covers Case Studies, capabilities, GitHub Activity, Mood, Accessibility, and Command Palette");
if (!featureCss.includes("--modal-inline-gutter:18px") || !featureCss.includes("--site-scrollbar-size:9px") || !featureCss.includes("--site-scrollbar-thumb:rgba(137,153,142,.20)") || !featureCss.includes("--modal-scrollbar-width:0px") || !featureCss.includes("var(--modal-scrollbar-width,0px)") || !featureCss.includes("scrollbar-gutter:auto") || !featureCss.includes("--header-control-height:34px")) fail("v5.1 overlay-scrollbar/modal/header alignment contracts are missing");
else pass("v5.1 overlay scrollbar, symmetric modal gutter, and header-control sizing contracts are present");
if (featureCss.includes("var(--native-scrollbar-width)") || readFileSync(resolve("src/main.tsx"), "utf8").includes("scrollbarProbe")) fail("Modal geometry must not use a global native scrollbar measurement");
else pass("Modal geometry uses per-viewport scrollbar measurements");
if (/scrollbar-gutter:stable/.test(featureCss) || /scrollbar-gutter:stable/.test(readFileSync(resolve("app/globals.css"), "utf8"))) fail("Reserved scrollbar gutters remain in the UI and can reintroduce right-side modal spacing");
else pass("No permanent scrollbar gutters remain in application styles");
if (!featureCss.includes("*::-webkit-scrollbar-thumb:hover") || !featureCss.includes("--site-scrollbar-thumb-hover") || !featureCss.includes(".feature-modal>header,.advanced-modal>header,.recruiter-mode>header,.recruiter-progress") || !featureCss.includes("width:100%;box-sizing:border-box")) fail("Global scrollbar hover/full-bleed modal chrome contracts are incomplete");
else pass("Global scrollbar hover and edge-to-edge modal chrome contracts are present");
if (!featureSource.includes("<span>{profile.label}</span>")) fail("Header Portfolio Mood must render the full active profile label");
else pass("Header Portfolio Mood renders the full active availability message");
if (/routeScrollTimerRef/.test(appSource)) fail("Delayed initial route scrolling can race with modal restoration");
else pass("Section deep links no longer depend on delayed route timers");
const modalScrollSource = readFileSync(resolve("src/modalScroll.ts"), "utf8");
if (!modalScrollSource.includes("restorePosition") || !featureSource.includes("restorePosition")) fail("Case Study modal does not provide an explicit pre-modal restore position");
else pass("Modal scroll lock supports deterministic pre-modal restoration");
const modalConsumerSources = [appSource, featureSource, readFileSync(resolve("src/AdvancedUI.tsx"), "utf8"), readFileSync(resolve("src/ProjectIntelligence.tsx"), "utf8")];
const dialogTags = modalConsumerSources.flatMap(source => source.match(/<[^>]+role="dialog"[^>]*>/g) || []);
if (!dialogTags.length || !modalScrollSource.includes("useModalDialog") || !modalScrollSource.includes("stopImmediatePropagation") || !modalScrollSource.includes("returnFocus?.isConnected") || modalConsumerSources.some(source => source.includes("useModalScrollLock")) || dialogTags.some(tag => !/ref=\{(?:dialogRef|\w+DialogRef)\}/.test(tag))) fail("One or more dialogs bypass shared Escape, focus trap, focus return, or scroll-lock behavior");
else pass(`${dialogTags.length} dialogs use shared focus, Escape, return-focus, and scroll-lock behavior`);
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
const stepPosition = name => qualityWorkflow.indexOf(`- name: ${name}`);
const buildPosition = stepPosition("Build tested application bundle");
const e2ePosition = stepPosition("Browser E2E and accessibility smoke");
const lighthousePosition = stepPosition("Lighthouse quality report");
const stagingPackagePosition = stepPosition("Package staging bundle and verify it is not indexable");
const productionPackagePosition = stepPosition("Package production bundle and verify it stays indexable");
const artifactPosition = stepPosition("Upload verified environment bundle");
const orderedSteps = [buildPosition, e2ePosition, lighthousePosition, stagingPackagePosition, productionPackagePosition, artifactPosition];
if (orderedSteps.some(position => position < 0) || orderedSteps.some((position, index) => index > 0 && position <= orderedSteps[index - 1])) fail("Quality workflow order must be build → E2E → Lighthouse → environment packaging → artifact upload");
else pass("Deployment artifacts are produced only after E2E/Lighthouse quality work");

// The SEO regression that produced Lighthouse seo=63 was an ordering defect:
// the staging noindex transform ran before the audit, so Lighthouse graded a
// deliberately non-indexable document. These gates keep the audit pointed at
// the real indexable application.
if (/npm run build:staging/.test(qualityWorkflow) || /build_mode/.test(qualityWorkflow)) fail("Quality workflow must build one indexable bundle instead of an environment-specific build mode");
else if (!/- name: Build tested application bundle\s*\n\s*run: npm run build\s*\n/.test(qualityWorkflow)) fail("Quality workflow does not build the plain indexable application bundle");
else pass("Lighthouse audits one indexable application build, not an environment bundle");
if (existsSync(resolve("scripts/prepare-staging.mjs"))) fail("scripts/prepare-staging.mjs mutates dist/ in place and must not return alongside package-env.mjs");
else pass("No build script rewrites the tested dist/ into a non-indexable bundle");

const packageEnvSource = readFileSync(resolve("scripts/package-env.mjs"), "utf8");
const verifyEnvSource = readFileSync(resolve("scripts/verify-env.mjs"), "utf8");
if (!/dist-\$\{target\}/.test(packageEnvSource) || !/rmSync\(outDir/.test(packageEnvSource) || !/cpSync\(sourceDir, outDir/.test(packageEnvSource)) fail("Environment packaging must derive a separate dist-<env>/ bundle from the tested dist/");
else pass("Staging and production bundles are derived directories, not one mutated dist/");
if (!/noindex,nofollow,noarchive/.test(packageEnvSource) || !/Disallow: \//.test(packageEnvSource)) fail("Staging packaging must apply noindex and a site-wide robots Disallow");
else pass("Staging packaging applies noindex and robots Disallow: /");
if (/target === "production"[\s\S]{0,400}noindex/.test(packageEnvSource)) fail("Production packaging must never apply a noindex policy");
else pass("Production packaging applies no noindex policy");
for (const contract of ["Staging robots.txt does not contain a site-wide Disallow", "Production robots.txt contains a site-wide Disallow", "inherited a staging noindex", "advertises a sitemap"]) {
  if (!verifyEnvSource.includes(contract)) fail(`Environment verification is missing an indexing contract: ${contract}`);
}
if (!failures.some(item => item.includes("indexing contract"))) pass("Environment verification covers staging noindex and production indexability");

const packageScripts = packageManifest?.scripts || {};
if (packageScripts["package:staging"] !== "node scripts/package-env.mjs staging" || packageScripts["package:production"] !== "node scripts/package-env.mjs production"
  || packageScripts["verify:staging"] !== "node scripts/verify-env.mjs staging" || packageScripts["verify:production"] !== "node scripts/verify-env.mjs production") fail("Environment packaging/verification scripts are missing or inconsistent");
else pass("Environment packaging and verification are project-owned scripts");
if (packageScripts["build:staging"]) fail("build:staging produces a non-indexable dist/ before validation and must stay removed");

if (!/npm run verify:staging/.test(qualityWorkflow) || !/npm run verify:production/.test(qualityWorkflow)) fail("Quality workflow does not verify environment indexing policy before uploading an artifact");
else pass("Staging and production indexing policy are verified before artifact upload");
if (!/path: dist-\$\{\{ inputs\.deploy_env \}\}\//.test(qualityWorkflow)) fail("Deploy artifact must be the verified environment bundle, not the raw dist/");
else pass("Deploy artifact is the verified environment-specific bundle");
if (!/name: Upload Lighthouse report on failure/.test(qualityWorkflow)) fail("Lighthouse failures do not upload a report artifact for debugging");
else pass("Lighthouse failures upload the JSON/HTML report");

// The deploy bundle ships .htaccess, and actions/upload-artifact excludes
// hidden files unless told otherwise. Without this the artifact loses the
// rewrite rules, security headers and the staging X-Robots-Tag, and a mirroring
// deploy would delete the file from the server.
const bundleUploadStep = qualityWorkflow.slice(qualityWorkflow.indexOf("- name: Upload verified environment bundle"));
if (!/include-hidden-files:\s*true/.test(bundleUploadStep)) fail("Deploy artifact upload must set include-hidden-files so .htaccess survives");
else pass("Deploy artifact upload preserves hidden files such as .htaccess");
for (const [workflow, label] of [[stagingWorkflow, "Staging"], [productionWorkflow, "Production"]]) {
  if (!workflow.includes("is missing dist/$file")) fail(`${label} deploy does not report which artifact file is missing`);
  if (!/for file in [^\n]*\.htaccess/.test(workflow)) fail(`${label} deploy does not assert .htaccess survived the artifact round trip`);
}
if (!failures.some(item => item.includes("artifact file is missing") || item.includes("artifact round trip"))) pass("Deploy jobs verify .htaccess survived and name any missing bundle file");

if (failures.length) {
  console.error(`\nQuality gates failed (${failures.length}).`);
  process.exit(1);
}
console.log("\nAll repository quality gates passed.");
