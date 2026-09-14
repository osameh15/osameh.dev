import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveReleaseCodename } from "../frontend/src/lib/releaseMetadataCore.js";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const availability = JSON.parse(readFileSync(resolve("config/availability.json"), "utf8"));
const releases = JSON.parse(readFileSync(resolve("config/releases.json"), "utf8"));

const codename = resolveReleaseCodename(releases, pkg.version);

// The exact source commit this bundle was built from. Read once, here, so the
// deployed artefact carries its own provenance rather than anything inferring
// it from runtime branch state. CI checks out the commit it is building, so
// this is the commit that reaches the server.
//
// GITHUB_SHA is preferred because a CI checkout can be detached; git is the
// local fallback. An unavailable SHA is not fatal - the build simply ships
// without provenance rather than shipping a guess.
const commitSha = (() => {
  const fromCi = (process.env.GITHUB_SHA || "").trim();
  if (/^[0-9a-f]{40}$/i.test(fromCi)) return fromCi.toLowerCase();
  try {
    const fromGit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    return /^[0-9a-f]{40}$/i.test(fromGit) ? fromGit.toLowerCase() : null;
  } catch {
    return null;
  }
})();
const commitShortSha = commitSha ? commitSha.slice(0, 7) : null;
const now = new Date();
const iso = now.toISOString();
const compact = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const displayStamp = `${iso.slice(5, 10).replace("-", "")}.${iso.slice(11, 16).replace(":", "")}Z`;
const buildId = `v${pkg.version}-${compact}`;
const buildDisplay = codename ? `v${pkg.version} · ${codename.toUpperCase()} · ${displayStamp}` : `v${pkg.version} · ${displayStamp}`;

mkdirSync(resolve("frontend/src/generated"), { recursive: true });
writeFileSync(resolve("frontend/src/generated/build.ts"), `// AUTO-GENERATED. Do not edit manually.\nexport const BUILD_VERSION = ${JSON.stringify(pkg.version)};\nexport const BUILD_CODENAME = ${JSON.stringify(codename)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\nexport const BUILD_DISPLAY = ${JSON.stringify(buildDisplay)};\nexport const BUILD_TIME = ${JSON.stringify(iso)};
export const BUILD_COMMIT = ${JSON.stringify(commitSha)};
export const BUILD_COMMIT_SHORT = ${JSON.stringify(commitShortSha)};\n`);

// Release dates for the engineering timeline, taken from the one place they are
// authored. Emitting a small map keeps docs/CHANGELOG.md authoritative without
// shipping the whole changelog in the bundle or duplicating dates by hand.
const changelogText = readFileSync(resolve("docs/CHANGELOG.md"), "utf8");
const releaseDates = Object.fromEntries(
  [...changelogText.matchAll(/^## ([\d.]+) - (\d{4}-\d{2}-\d{2})/gm)].map(match => [match[1], match[2]]),
);
writeFileSync(
  resolve("frontend/src/generated/releaseDates.ts"),
  `// AUTO-GENERATED from docs/CHANGELOG.md. Do not edit manually.
export const RELEASE_DATES: Record<string, string> = ${JSON.stringify(releaseDates, null, 2)};
`,
);

const environment = process.env.DEPLOY_ENV === "staging" ? "staging" : "production";
const info = {
  version: pkg.version,
  codename,
  buildId,
  builtAt: iso,
  environment,
  availabilityMood: availability.activeStatus,
  commit: commitSha,
  commitShort: commitShortSha,
};
writeFileSync(resolve("frontend/public/build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`Prepared ${buildId}`);
