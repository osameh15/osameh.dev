import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const now = new Date();
const iso = now.toISOString();
const compact = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const displayStamp = `${iso.slice(5, 10).replace("-", "")}.${iso.slice(11, 16).replace(":", "")}Z`;
const buildId = `v${pkg.version}-${compact}`;
const buildDisplay = `v${pkg.version} · ${displayStamp}`;

mkdirSync(resolve("src/generated"), { recursive: true });
writeFileSync(resolve("src/generated/build.ts"), `// AUTO-GENERATED. Do not edit manually.\nexport const BUILD_VERSION = ${JSON.stringify(pkg.version)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\nexport const BUILD_DISPLAY = ${JSON.stringify(buildDisplay)};\nexport const BUILD_TIME = ${JSON.stringify(iso)};\n`);

const environment = process.env.DEPLOY_ENV === "staging" ? "staging" : "production";
const info = {
  version: pkg.version,
  buildId,
  builtAt: iso,
  environment,
};
writeFileSync(resolve("public/build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`Prepared ${buildId}`);
