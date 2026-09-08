import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Every frontend source file, wherever its feature happens to live.
 *
 * Gates that describe an application-wide contract read this rather than a
 * hardcoded file list, so moving a component between features can never
 * silently drop it out of a check.
 */
function frontendSources(root = "frontend/src") {
  const out = [];
  const visit = directory => {
    for (const entry of readdirSync(resolve(directory))) {
      const path = join(directory, entry);
      if (statSync(resolve(path)).isDirectory()) visit(path);
      else if (/\.(?:ts|tsx)$/.test(entry)) out.push(path.replaceAll("\\", "/"));
    }
  };
  visit(root);
  return out;
}
const frontendSourceFiles = frontendSources();
const frontendSourceText = new Map(frontendSourceFiles.map(file => [file, readFileSync(resolve(file), "utf8")]));
import { verifyServiceWorker } from "./verify-sw.mjs";
import { verifyBrandAssets } from "./verify-brand-assets.mjs";
import { verifyReadmeAssetUrls } from "./verify-readme-assets.mjs";
import { verifyRepositorySecrets } from "./verify-secrets.mjs";
import { resolveReleaseCodename } from "../frontend/src/lib/releaseMetadataCore.js";

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

const notes = JSON.parse(readFileSync(resolve("frontend/public/notes-index.json"), "utf8"));
const slugs = new Set();
for (const note of notes) {
  if (!/^[a-z0-9-]+$/.test(note.slug || "")) fail(`Invalid note slug: ${note.slug}`);
  if (slugs.has(note.slug)) fail(`Duplicate note slug: ${note.slug}`);
  slugs.add(note.slug);
  if (!note.title || !note.summary || !Array.isArray(note.tags)) fail(`Incomplete note metadata: ${note.slug}`);
  if (!existsSync(resolve(`frontend/public/notes-content/${note.slug}.md`))) fail(`Missing markdown file for note: ${note.slug}`);
}
if (!failures.some(item => item.includes("note"))) pass(`${notes.length} engineering notes validated`);

const caseStudies = JSON.parse(readFileSync(resolve("frontend/public/case-studies-index.json"), "utf8"));
const caseIds = new Set();
for (const study of caseStudies) {
  if (!/^[a-z0-9-]+$/.test(study.id || "")) fail(`Invalid case study id: ${study.id}`);
  if (caseIds.has(study.id)) fail(`Duplicate case study id: ${study.id}`);
  caseIds.add(study.id);
  if (!study.title || !study.summary || !Array.isArray(study.stack)) fail(`Incomplete case study metadata: ${study.id}`);
  if (study.privacy === "public" && (!study.siteUrl || !/^https:\/\//.test(study.siteUrl))) fail(`Public case study is missing a safe live-site URL: ${study.id}`);
}
if (!failures.some(item => item.includes("case study"))) pass(`${caseStudies.length} case studies validated`);

const htaccess = readFileSync(resolve("backend/server/.htaccess"), "utf8");
if (/^\s*Header\s+(?:always\s+)?set\s+Strict-Transport-Security\b/im.test(htaccess)) fail("Origin .htaccess must not inject HSTS; ParsPack CDN is the sole HSTS authority");
else pass("HSTS is delegated to the ParsPack CDN edge");
for (const route of ["api/health", "notes/", "case-studies/", "sitemap\\.xml", "projects/"]) {
  if (htaccess.includes(route)) pass(`route contract includes ${route}`); else fail(`Missing route contract: ${route}`);
}
const firstClassRouteRule = htaccess.split(/\r?\n/).find(line => line.includes("RewriteRule") && line.includes("index.html")) || "";
const sitemapPhp = readFileSync(resolve("backend/seo/sitemap.php"), "utf8");
const sitemapXml = readFileSync(resolve("frontend/public/sitemap.xml"), "utf8");
if (!firstClassRouteRule.includes("activity")) fail("GitHub Activity is missing from first-class routing");
else pass("GitHub Activity remains a first-class application deep link");
const sectionOnlyUrls = ["about", "projects", "case-studies", "experience", "activity", "now", "changelog", "notes", "contact", "resume"].map(path => `https://osameh.dev/${path}`);
if (sectionOnlyUrls.some(url => sitemapPhp.includes(`'${url}'`) || sitemapXml.includes(`<loc>${url}</loc>`))) fail("Section-only canonical-home URLs must stay out of both sitemaps");
else pass("Both sitemaps contain independent canonical documents only");
for (const detailRoute of ["projects/", "notes/", "case-studies/"]) {
  if (sitemapPhp.includes(detailRoute) && sitemapXml.includes(detailRoute)) pass(`Both sitemaps include ${detailRoute} documents`);
  else fail(`Missing sitemap detail documents: ${detailRoute}`);
}

const contactSource = readFileSync(resolve("backend/api/contact.php"), "utf8");
const allowedContactOrigins = ["https://osameh.dev", "https://www.osameh.dev", "https://staging.osameh.dev"];
if (!allowedContactOrigins.every(origin => contactSource.includes(`'${origin}'`)) || /Access-Control-Allow-Origin:\s*\*/i.test(contactSource)) fail("Contact origin policy must allow only the explicit production and staging origins");
else pass("Contact origin policy explicitly supports production and staging smoke tests");

const index = readFileSync(resolve("frontend/index.html"), "utf8");
for (const requirement of [/<html[^>]+lang=/i, /<meta[^>]+name=["']viewport["']/i, /<meta[^>]+name=["']description["']/i, /<script[^>]+application\/ld\+json/i]) {
  if (requirement.test(index)) pass(`SEO/accessibility shell check ${requirement}`); else fail(`index.html failed baseline check ${requirement}`);
}

for (const php of ["backend/seo/project.php", "backend/seo/note.php", "backend/seo/case-study.php", "backend/seo/sitemap.php", "backend/api/health.php"]) {
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

// The site renders its own curated release array; docs/CHANGELOG.md is the detailed
// record. Wording may differ, but a release existing in one and not the other is drift.
const changelogMarkdown = readFileSync(resolve("docs/CHANGELOG.md"), "utf8");
const siteChangelogVersions = new Set([...readFileSync(resolve("frontend/src/data/portfolioData.ts"), "utf8").matchAll(/\{ version: "([\d.]+)"/g)].map(match => match[1]));
const documentedVersions = [...changelogMarkdown.matchAll(/^## ([\d.]+)/gm)].map(match => match[1]);
if (documentedVersions[0] !== packageVersion) fail(`docs/CHANGELOG.md newest release is ${documentedVersions[0]}, expected ${packageVersion}`);
if (!siteChangelogVersions.has(packageVersion)) fail(`frontend/src/data/portfolioData.ts changelog is missing the released version ${packageVersion}`);
const undocumentedOnSite = documentedVersions.filter(version => !siteChangelogVersions.has(version));
if (undocumentedOnSite.length) fail(`Releases documented but missing from the site changelog: ${undocumentedOnSite.join(", ")}`);
else pass(`Site changelog covers all ${documentedVersions.length} documented releases`);

const advancedSource = frontendSourceText.get("frontend/src/features/diagnostics/BuildInfoModal.tsx") || "";
// One bundle serves both environments, so a hardcoded environment literal in the
// build modal would misreport staging as production.
if (/<strong>production<\/strong>/.test(advancedSource) || /build-info-badge">PRODUCTION BUILD/.test(advancedSource)) fail("Build modal hardcodes the environment instead of reading build-info.json");
else if (!/fetch\("\/build-info\.json"/.test(advancedSource)) fail("Build modal does not read the deployed environment from build-info.json");
else pass("Build modal reports the deployed environment from build-info.json");

const appSource = readFileSync(resolve("frontend/src/app/App.tsx"), "utf8");
const featureSource = readFileSync(resolve("frontend/src/features/portfolio/PortfolioFeatures.tsx"), "utf8");
if (/LanguageControl|setLocale\(|portfolio-locale/.test(appSource)) fail("App still contains locale-switching UI/state");
else pass("App contains no locale switcher");
if (/type Locale =|setLocale\(|data-locale=/.test(featureSource)) fail("Feature preferences still contain locale switching");
else pass("Feature preferences are English-only");


const featureCss = readFileSync(resolve("frontend/src/styles/features-v5.css"), "utf8");
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
if (!appSource.includes("ENGINEERING NOTE") || !appSource.includes("CASE STUDY") || !featureSource.includes("data-note-slug") && !frontendSourceText.get("frontend/src/features/notes/EngineeringNotes.tsx").includes("data-note-slug")) fail("Dedicated Note/Case Study context-menu hooks are incomplete");
else pass("Engineering Notes and Case Studies expose dedicated context-menu hooks/actions");
const terminalContracts = ["case-studies", "case <id>", "capabilities", "activity", "palette", "mood:list", "accessibility"];
if (!terminalContracts.every(token => appSource.includes(token))) fail("Terminal command coverage is missing one or more v5.1 feature commands");
else pass("Terminal covers Case Studies, capabilities, GitHub Activity, Mood, Accessibility, and Command Palette");
if (!featureCss.includes("--modal-inline-gutter:18px") || !featureCss.includes("--site-scrollbar-size:9px") || !featureCss.includes("--site-scrollbar-thumb:rgba(137,153,142,.20)") || !featureCss.includes("--modal-scrollbar-width:0px") || !featureCss.includes("var(--modal-scrollbar-width,0px)") || !featureCss.includes("scrollbar-gutter:auto") || !featureCss.includes("--header-control-height:34px")) fail("v5.1 overlay-scrollbar/modal/header alignment contracts are missing");
else pass("v5.1 overlay scrollbar, symmetric modal gutter, and header-control sizing contracts are present");
if (featureCss.includes("var(--native-scrollbar-width)") || frontendSourceText.get("frontend/src/app/main.tsx").includes("scrollbarProbe")) fail("Modal geometry must not use a global native scrollbar measurement");
else pass("Modal geometry uses per-viewport scrollbar measurements");
if (/scrollbar-gutter:stable/.test(featureCss) || /scrollbar-gutter:stable/.test(readFileSync(resolve("frontend/src/styles/globals.css"), "utf8"))) fail("Reserved scrollbar gutters remain in the UI and can reintroduce right-side modal spacing");
else pass("No permanent scrollbar gutters remain in application styles");
if (!featureCss.includes("*::-webkit-scrollbar-thumb:hover") || !featureCss.includes("--site-scrollbar-thumb-hover") || !featureCss.includes(".feature-modal>header,.advanced-modal>header,.recruiter-mode>header,.recruiter-progress") || !featureCss.includes("width:100%;box-sizing:border-box")) fail("Global scrollbar hover/full-bleed modal chrome contracts are incomplete");
else pass("Global scrollbar hover and edge-to-edge modal chrome contracts are present");
if (!featureSource.includes("<span>{profile.label}</span>")) fail("Header Portfolio Mood must render the full active profile label");
else pass("Header Portfolio Mood renders the full active availability message");
if (/routeScrollTimerRef/.test(appSource)) fail("Delayed initial route scrolling can race with modal restoration");
else pass("Section deep links no longer depend on delayed route timers");
const modalScrollSource = readFileSync(resolve("frontend/src/lib/modalScroll.ts"), "utf8");
if (!modalScrollSource.includes("restorePosition") || !featureSource.includes("restorePosition")) fail("Case Study modal does not provide an explicit pre-modal restore position");
else pass("Modal scroll lock supports deterministic pre-modal restoration");
// Every consumer of the shared modal foundation, which is every frontend
// source except the foundation itself.
const modalConsumerSources = [...frontendSourceText].filter(([file]) => file !== "frontend/src/lib/modalScroll.ts").map(([, source]) => source);
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

// ---- Release codename architecture (config/releases.json is the only source) ----
const releaseConfig = JSON.parse(readFileSync(resolve("config/releases.json"), "utf8"));
const codenameCases = [["2.2.4", "Pixel"], ["3.1.0", "Shadow"], ["4.2.2", "Specter"], ["5.2.0", "Cipher"], ["5.2.1", "Cipher"], ["5.2.2", "Cipher"], ["5.2.42", "Cipher"], ["5.2.99", "Cipher"], ["5.3.0", "Vanta"], ["5.3.1", "Vanta"], ["5.3.99", "Vanta"], ["5.4.0", null], ["1.0.0", null], ["9.9.9", null], ["", null], ["garbage", null]];
const codenameFailures = codenameCases.filter(([version, expected]) => resolveReleaseCodename(releaseConfig, version) !== expected);
if (releaseConfig.theme !== "Cyber Noir") fail("Release naming theme must be Cyber Noir");
else if (Object.hasOwn(releaseConfig, "unnamed")) fail("Release metadata must not define an explicit unnamed-family policy");
else if (codenameFailures.length) fail(`Release codename resolution is wrong for: ${codenameFailures.map(([v]) => v).join(", ")}`);
else pass("Historical, active-family, reserved, unmapped, and invalid codename resolution is correct");
if (resolveReleaseCodename(releaseConfig, packageVersion) === null) fail(`Current release ${packageVersion} does not resolve a codename`);
else pass(`Current release ${packageVersion} resolves codename ${resolveReleaseCodename(releaseConfig, packageVersion)}`);

const generatedBuild = readFileSync(resolve("frontend/src/generated/build.ts"), "utf8");
if (!/export const BUILD_CODENAME =/.test(generatedBuild)) fail("Generated build metadata is missing BUILD_CODENAME");
else pass("Generated build metadata exposes BUILD_CODENAME");
if (!prepareBuildSource.includes("codename")) fail("Build preparation does not stamp the release codename into build metadata");
else pass("Build metadata stamps the release codename");
const runtimeReleaseSource = readFileSync(resolve("frontend/src/lib/releaseMetadata.ts"), "utf8");
if (!prepareBuildSource.includes("resolveReleaseCodename") || !runtimeReleaseSource.includes("resolveReleaseCodename")) fail("Runtime and build metadata must use the shared release resolver");
else pass("Runtime and build metadata use the same release resolver");

// No component may hardcode the active codename; everything reads the resolver.
const activeCodename = resolveReleaseCodename(releaseConfig, packageVersion);
for (const [file, source] of frontendSourceText) {
  // Generated build metadata legitimately carries the resolved codename.
  if (file === "frontend/src/generated/build.ts") continue;
  if (activeCodename && new RegExp(`["'\`]${activeCodename}["'\`]`).test(source)) fail(`${file} hardcodes the release codename instead of using release metadata`);
}
if (!failures.some(item => item.includes("hardcodes the release codename"))) pass("No UI component hardcodes the active release codename");

// ---- v5.3.0 Vanta: release families ----

// A family that is live must not also be listed as reserved. Reserved names are
// forward planning and are deliberately unresolved, so leaving one in both
// places would make an active family look unreleased.
const reservedFamilies = Object.keys(releaseConfig.reserved || {});
const activeFamilies = Object.keys(releaseConfig.families || {});
const doubleBooked = activeFamilies.filter(family => reservedFamilies.includes(family));
if (doubleBooked.length) fail(`Release families are both active and reserved: ${doubleBooked.join(", ")}`);
else pass(`${activeFamilies.length} active release families, ${reservedFamilies.length} reserved`);

// The running version must resolve to a codename through the shared resolver.
if (!resolveReleaseCodename(releaseConfig, packageVersion)) fail(`Version ${packageVersion} resolves to no release codename`);
else pass(`Version ${packageVersion} resolves to ${resolveReleaseCodename(releaseConfig, packageVersion)}`);

// ---- v5.3.0 Vanta: adjacent Engineering Note navigation ----

const notesDataSource = readFileSync(resolve("frontend/src/features/notes/notesData.ts"), "utf8");
const notesViewSource = readFileSync(resolve("frontend/src/features/notes/EngineeringNotes.tsx"), "utf8");

// Adjacency must be derived from the one authoritative order, never from a
// second ordering table or from sorted filenames/URLs.
if (!/export function adjacentNotes\(/.test(notesDataSource)) fail("Adjacent-note resolution is not defined beside the authoritative Notes order");
else if (!/engineeringNotes\.findIndex/.test(notesDataSource)) fail("Adjacent-note resolution does not derive its order from engineeringNotes");
else pass("Adjacent Note order is derived from the authoritative engineeringNotes order");
if (/\.sort\(/.test(notesDataSource)) fail("frontend/src/features/notes/notesData.ts re-sorts the authoritative Notes order");

if (!notesViewSource.includes("adjacentNotes(")) fail("The Note view does not use the shared adjacent-note resolver");
else pass("The Note view reads adjacency from the shared resolver");

// Previous/Next must be real crawlable anchors handed to the shared Note
// lifecycle, never buttons or role="link" surfaces.
const adjacentLink = /className={`note-adjacent-link[\s\S]{0,400}?href={`\/notes\/\$\{encodeURIComponent\(note\.slug\)\}`}/.test(notesViewSource);
if (!adjacentLink) fail("Adjacent Note navigation does not render a real /notes/{slug} anchor");
else pass("Adjacent Note navigation renders real /notes/{slug} anchors");
if (/note-adjacent[\s\S]{0,200}role="link"/.test(notesViewSource) || /<button[^>]*note-adjacent/.test(notesViewSource)) {
  fail("Adjacent Note navigation uses a button or role=\"link\" instead of an anchor");
}
if (!/aria-label={`\$\{direction === "previous" \? "Previous" : "Next"\} note: /.test(notesViewSource)) {
  fail("Adjacent Note links do not carry a descriptive accessible label");
} else pass("Adjacent Note links carry descriptive accessible labels");
if (/disabled/.test(notesViewSource.slice(notesViewSource.indexOf("note-adjacent"), notesViewSource.indexOf("note-adjacent") + 900))) {
  fail("An unavailable adjacent Note is rendered as a disabled control instead of being absent");
} else pass("An unavailable adjacent Note renders no navigation action");

if (!/<EngineeringNoteView[\s\S]{0,160}?onOpenNote={openNote}/.test(appSource)) fail("The Note view is not wired to the shared openNote lifecycle");
else pass("Adjacent Note navigation reuses the shared openNote editor-tab lifecycle");

// ---- v5.3.0 Vanta: reCAPTCHA v3 contract ----

const recaptchaClient = readFileSync(resolve("frontend/src/config/recaptchaConfig.ts"), "utf8");
const recaptchaServer = readFileSync(resolve("backend/lib/recaptcha.php"), "utf8");
const contactEndpoint = readFileSync(resolve("backend/api/contact.php"), "utf8");
const contactForm = readFileSync(resolve("frontend/src/features/contact/ContactForm.tsx"), "utf8");

const clientAction = (/export const RECAPTCHA_ACTION = "([^"]+)"/.exec(recaptchaClient) || [])[1] || "";
const serverAction = (/const RECAPTCHA_ACTION = '([^']+)'/.exec(recaptchaServer) || [])[1] || "";
if (clientAction !== "contact_submit" || serverAction !== "contact_submit") fail(`Frontend and backend must share the exact action "contact_submit" (client "${clientAction}", server "${serverAction}")`);
else pass('Frontend and backend share the reCAPTCHA action "contact_submit"');

// Exact-hostname selection, and an unknown host must resolve to no key at all.
if (!/SITE_KEYS\[host\] \?\? null/.test(recaptchaClient)) fail("Site-key selection is not exact-hostname with a null default");
else pass("Site-key selection is exact-hostname and returns null for unknown hosts");
if (/(?:\|\||\?\?)\s*SITE_KEYS\["osameh\.dev"\]/.test(recaptchaClient) || /default:\s*"6L/.test(recaptchaClient)) {
  fail("Site-key selection falls back to the production key");
}
if (!/'osameh\.dev', 'www\.osameh\.dev' => 'production'/.test(recaptchaServer) || !/default => null/.test(recaptchaServer)) {
  fail("Server environment selection is not exact-hostname with a fail-closed default");
} else pass("Server environment selection is exact-hostname and fail-closed");

// The minimum score is one constant.
const scoreLiterals = [recaptchaServer, contactEndpoint, recaptchaClient, contactForm]
  .join("\n")
  .match(/minimum_score'?\s*=>\s*0\.\d+|MINIMUM_SCORE = 0\.\d+/g) || [];
if (scoreLiterals.length !== 1) fail(`The reCAPTCHA minimum score must be defined exactly once, found ${scoreLiterals.length}`);
else pass("The reCAPTCHA minimum score is defined exactly once");

// Every rejection path must fail closed, and verification must sit before mail.
for (const reason of ["malformed_response", "verification_failed", "wrong_action", "wrong_hostname", "missing_score", "low_score", "missing_token", "verification_unavailable"]) {
  if (!recaptchaServer.includes(reason)) fail(`The reCAPTCHA verifier does not handle: ${reason}`);
}
if (!failures.some(item => item.includes("reCAPTCHA verifier does not handle"))) pass("The reCAPTCHA verifier handles every rejection reason explicitly");
if (!/recaptchaDecision\(mixed \$response, array \$config\)/.test(recaptchaServer)) fail("The reCAPTCHA decision is not a separately testable pure function");
else pass("The reCAPTCHA decision is a pure, independently testable function");
if (!/CURLOPT_SSL_VERIFYPEER => true/.test(recaptchaServer) || /CURLOPT_SSL_VERIFYPEER => false/.test(recaptchaServer)) fail("The reCAPTCHA verifier weakens TLS verification");
else pass("The reCAPTCHA verifier keeps TLS verification enabled");
if (!/CURLOPT_CONNECTTIMEOUT => RECAPTCHA_CONNECT_TIMEOUT/.test(recaptchaServer) || !/CURLOPT_TIMEOUT => RECAPTCHA_TOTAL_TIMEOUT/.test(recaptchaServer)) fail("The reCAPTCHA verifier does not use finite timeouts");
else pass("The reCAPTCHA verifier uses finite connect and total timeouts");

const verificationIndex = contactEndpoint.indexOf("recaptchaVerifyToken(");
const rateLimitIndex = contactEndpoint.indexOf("if (!rateAllowed())");
const mailIndex = contactEndpoint.indexOf("@mail(");
if (verificationIndex < 0 || mailIndex < 0 || verificationIndex > mailIndex) fail("The contact endpoint can reach mail() without verifying a reCAPTCHA token");
else pass("The contact endpoint verifies reCAPTCHA before handing anything to the mail service");
if (rateLimitIndex < 0) fail("The contact endpoint no longer rate limits submissions");
else pass("The contact endpoint still rate limits submissions alongside reCAPTCHA");
if (!/\$recaptchaLibrary = __DIR__ \. '\/\.\.\/lib\/recaptcha\.php';/.test(contactEndpoint) || !/require_once \$recaptchaLibrary;/.test(contactEndpoint)) fail("The contact endpoint does not include the shared reCAPTCHA verifier");
// A missing library must not surface as a PHP warning: that would print the
// server's filesystem layout into the response.
else if (!/if \(!is_file\(\$recaptchaLibrary\)\)/.test(contactEndpoint)) fail("The contact endpoint would leak a filesystem path when the reCAPTCHA library is missing");
else pass("The contact endpoint includes the reCAPTCHA verifier and fails closed if it is absent");
if (/\$_(?:GET|REQUEST)\[[^\]]*(?:skip|disable|bypass)/i.test(contactEndpoint) || /RECAPTCHA_DISABLED/.test(contactEndpoint + recaptchaServer)) {
  fail("The contact endpoint exposes a reCAPTCHA bypass");
} else pass("The contact endpoint exposes no reCAPTCHA bypass");
if (/'score'\s*=>\s*\$/.test(contactEndpoint) || /\$recaptcha\['reason'\][^\n]*jsonResponse/.test(contactEndpoint)) {
  fail("The contact endpoint returns reCAPTCHA scoring detail to the client");
} else pass("The contact endpoint never returns reCAPTCHA scoring detail to the client");

// Token freshness: generated at submission, never persisted or replayed.
if (!/executeRecaptcha\(siteKey\)/.test(contactForm)) fail("The contact form does not request a token at submission time");
else pass("The contact form requests a fresh token at submission time");
if (/(?:local|session)Storage[^\n]*(?:recaptcha|token)/i.test(contactForm + recaptchaClient)) fail("A reCAPTCHA token is persisted in browser storage");
else pass("No reCAPTCHA token is persisted in browser storage");
if (!/document\.createElement\("script"\)/.test(recaptchaClient) || /<script[^>]*recaptcha/i.test(readFileSync(resolve("frontend/index.html"), "utf8"))) {
  fail("The reCAPTCHA script is not lazily injected outside the initial document");
} else pass("The reCAPTCHA script is injected lazily, never from the initial document");

// CSP: exactly the reCAPTCHA origins, and nothing weakened.
const htaccessSource = readFileSync(resolve("backend/server/.htaccess"), "utf8");
const csp = (/Content-Security-Policy\s+"([^"]+)"/.exec(htaccessSource) || [])[1] || "";
for (const required of ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"]) {
  if (!csp.includes(required)) fail(`CSP is missing a required reCAPTCHA origin: ${required}`);
}
if (!failures.some(item => item.includes("required reCAPTCHA origin"))) pass("CSP allows exactly the reCAPTCHA script and frame origins");
if (/unsafe-eval/.test(csp)) fail("CSP now allows unsafe-eval");
if (/script-src[^;]*'unsafe-inline'/.test(csp)) fail("CSP now allows inline scripts");
if (!/default-src 'self'/.test(csp) || !/object-src 'none'/.test(csp) || !/frame-ancestors 'none'/.test(csp) || !/base-uri 'self'/.test(csp)) {
  fail("CSP weakened default-src, object-src, frame-ancestors or base-uri");
} else pass("CSP keeps default-src, object-src, frame-ancestors and base-uri unchanged");
if (/script-src[^;]*\shttps:(?:\s|;)/.test(csp) || /script-src[^;]*\*/.test(csp)) fail("CSP allows a wildcard script source");

// The contact origin allowlist stays exact.
for (const origin of ["https://osameh.dev", "https://staging.osameh.dev"]) {
  if (!contactEndpoint.includes(origin)) fail(`The contact origin allowlist no longer contains ${origin}`);
}
if (/Access-Control-Allow-Origin[^\n]*\*/.test(contactEndpoint)) fail("The contact endpoint allows wildcard CORS");
if (!failures.some(item => item.includes("contact origin allowlist"))) pass("The contact origin allowlist stays exact for production and staging");

// ---- v5.3.0 Vanta: secret hygiene ----

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").map(line => line.trim()).filter(Boolean);
const secretFailures = verifyRepositorySecrets(trackedFiles);
for (const failure of secretFailures) fail(failure);
if (!secretFailures.length) pass("No private secret material is tracked, exposed through VITE_, or scattered outside the public site-key module");

// ---- v5.3.0 Vanta: architecture boundaries ----
//
// Cheap structural guards, not a dependency framework. They exist because the
// frontend/backend split is only real if it cannot quietly dissolve again.

for (const directory of ["frontend/src", "frontend/public", "backend/api", "backend/lib", "backend/seo", "backend/server", "backend/tests", "scripts", "config", "tests/e2e", "docs"]) {
  if (!existsSync(resolve(directory))) fail(`Expected architecture directory is missing: ${directory}`);
}
for (const legacy of ["src", "app", "public", "vendor", "tests/php"]) {
  if (existsSync(resolve(legacy))) fail(`Superseded top-level directory reappeared: ${legacy}`);
}
if (!failures.some(item => item.includes("architecture directory") || item.includes("Superseded top-level"))) {
  pass("Frontend, backend, ops, test and documentation directories are separated");
}

// The frontend ships no server code, and the backend depends on no component.
for (const file of frontendSourceFiles) {
  if (/\.php$/.test(file)) fail(`Server code inside the frontend tree: ${file}`);
  const source = frontendSourceText.get(file);
  if (/from ["']\.{1,2}\/.*\/backend\//.test(source) || /from ["']backend\//.test(source)) fail(`${file} imports backend source`);
}
const backendSources = ["backend/api/contact.php", "backend/api/github.php", "backend/api/analytics.php", "backend/api/health.php", "backend/lib/recaptcha.php"]
  .map(file => [file, readFileSync(resolve(file), "utf8")]);
for (const [file, source] of backendSources) {
  if (/frontend\/src/.test(source)) fail(`${file} reaches into frontend source`);
}
if (!failures.some(item => item.includes("imports backend source") || item.includes("reaches into frontend source") || item.includes("Server code inside"))) {
  pass("Frontend and backend source trees do not depend on each other");
}

// Backend library includes are reached through an API entrypoint, never served.
const serverConfig = readFileSync(resolve("backend/server/.htaccess"), "utf8");
if (!/RewriteRule \^lib\/ - \[F,L\]/.test(serverConfig)) fail("Backend library includes are not blocked from direct web access");
else pass("Backend library includes are not directly reachable over the web");

// The deploy assembler must publish both trees into the one artifact contract.
const assembler = readFileSync(resolve("scripts/ensure-deploy-files.mjs"), "utf8");
for (const required of ['["backend/server/.htaccess", "dist/.htaccess"]', '["backend/api/contact.php", "dist/api/contact.php"]', '["backend/lib/recaptcha.php", "dist/lib/recaptcha.php"]']) {
  if (!assembler.includes(required)) fail(`The deploy assembler no longer publishes ${required}`);
}
if (!failures.some(item => item.includes("deploy assembler no longer publishes"))) {
  pass("The deploy artifact still assembles frontend output plus the backend public runtime");
}

// Source Explorer entry points are repository paths shown to visitors, so a
// stale one would link at a file that no longer exists.
for (const entry of portfolio?.sourceExplorer?.entryPoints || []) {
  if (!existsSync(resolve(entry))) fail(`Source Explorer entry point does not exist: ${entry}`);
}
if (!failures.some(item => item.includes("Source Explorer entry point"))) {
  pass(`${(portfolio?.sourceExplorer?.entryPoints || []).length} Source Explorer entry points resolve to real paths`);
}

// ---- Neural Cipher brand assets ----
const brandFailures = verifyBrandAssets();
for (const failure of brandFailures) fail(failure);
if (!brandFailures.length) pass("Neural Cipher icon pack, manifest icons, and social artwork verified");

// README asset URLs must be encoded exactly once. A second encoding pass turns
// "%20" into "%2520" and 404s the image.
const readmeAssetFailures = verifyReadmeAssetUrls();
for (const failure of readmeAssetFailures) fail(failure);
if (!readmeAssetFailures.length) pass("README asset URLs normalize exactly once and preserve third-party hosts");

// The service worker only registers over HTTPS, so no local browser run loads
// it. Execute it against a minimal worker environment here instead.
const serviceWorkerFailures = await verifyServiceWorker();
for (const failure of serviceWorkerFailures) fail(failure);
if (!serviceWorkerFailures.length) pass("Service worker clones before body consumption and never caches /api/ responses");

if (failures.length) {
  console.error(`\nQuality gates failed (${failures.length}).`);
  process.exit(1);
}
console.log("\nAll repository quality gates passed.");
