import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveReleaseCodename } from "../frontend/src/lib/releaseMetadataCore.js";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const availability = JSON.parse(readFileSync(resolve("config/availability.json"), "utf8"));
const releases = JSON.parse(readFileSync(resolve("config/releases.json"), "utf8"));

const codename = resolveReleaseCodename(releases, pkg.version);
const now = new Date();
const iso = now.toISOString();
const compact = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const displayStamp = `${iso.slice(5, 10).replace("-", "")}.${iso.slice(11, 16).replace(":", "")}Z`;
const buildId = `v${pkg.version}-${compact}`;
const buildDisplay = codename ? `v${pkg.version} · ${codename.toUpperCase()} · ${displayStamp}` : `v${pkg.version} · ${displayStamp}`;

mkdirSync(resolve("frontend/src/generated"), { recursive: true });
writeFileSync(resolve("frontend/src/generated/build.ts"), `// AUTO-GENERATED. Do not edit manually.\nexport const BUILD_VERSION = ${JSON.stringify(pkg.version)};\nexport const BUILD_CODENAME = ${JSON.stringify(codename)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\nexport const BUILD_DISPLAY = ${JSON.stringify(buildDisplay)};\nexport const BUILD_TIME = ${JSON.stringify(iso)};\n`);

const environment = process.env.DEPLOY_ENV === "staging" ? "staging" : "production";
const info = {
  version: pkg.version,
  codename,
  buildId,
  builtAt: iso,
  environment,
  availabilityMood: availability.activeStatus,
};
writeFileSync(resolve("frontend/public/build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`Prepared ${buildId}`);
