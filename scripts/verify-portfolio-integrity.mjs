// Deterministic integrity gates for portfolio content and release metadata.
//
// Everything here is proved from files in this repository. Nothing contacts
// GitHub, npm or any other third party, because a gate that depends on a remote
// service is a gate that fails for reasons unrelated to the change under test -
// the Raven audit watched npmjs.com answer 403 to automation while all four
// packages were perfectly healthy.
//
// Live comparison belongs in an advisory check, never here.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalKeys, TECHNOLOGIES } from "../frontend/src/lib/technologyCore.js";

const read = path => readFileSync(resolve(path), "utf8");

/* ------------------------------------------------------------------ *
 * Canonical technology registry
 * ------------------------------------------------------------------ */
export function verifyTechnologyRegistry() {
  const failures = [];
  const keys = Object.keys(TECHNOLOGIES);

  if (new Set(keys).size !== keys.length) failures.push("Duplicate canonical technology key");

  // An alias may only name several technologies deliberately; the same alias
  // resolving to two unrelated identities would make filtering ambiguous.
  const owners = new Map();
  for (const key of keys) {
    const definition = TECHNOLOGIES[key];
    if (definition.key !== key) failures.push(`Technology ${key} disagrees with its own key ${definition.key}`);
    if (!definition.label) failures.push(`Technology ${key} has no display label`);
    for (const alias of [definition.label, ...definition.aliases]) {
      const normalized = alias.trim().toLowerCase();
      const existing = owners.get(normalized);
      if (existing && existing !== key) {
        const resolved = canonicalKeys(alias);
        // Resolving to both is fine when it is an explicit combined token.
        if (!(resolved.includes(existing) && resolved.includes(key))) {
          failures.push(`Alias "${alias}" is claimed by both ${existing} and ${key}`);
        }
      }
      owners.set(normalized, key);
    }
  }

  // Related but distinct technologies must never collapse into one another.
  for (const [a, b] of [["csharp", "dotnet"], ["qt", "qml"], ["nuxt", "vue"]]) {
    if (canonicalKeys(TECHNOLOGIES[a].label).includes(b)) failures.push(`${a} must not resolve to ${b}`);
  }
  return failures;
}

/* ------------------------------------------------------------------ *
 * Fallback project data
 * ------------------------------------------------------------------ */
const LIFECYCLE_VALUES = ["active", "stable", "maintained", "legacy"];

export function verifyFallbackProjects() {
  const failures = [];
  const source = read("frontend/src/features/projects/repoTypes.ts");

  const names = [...source.matchAll(/name: "([^"]+)"/g)].map(match => match[1]);
  const ids = [...source.matchAll(/id: (\d+)/g)].map(match => Number(match[1]));
  if (!names.length) return ["Fallback project list is empty or unreadable"];

  if (new Set(names).size !== names.length) failures.push("Duplicate fallback repository name");
  if (new Set(ids).size !== ids.length) failures.push("Duplicate fallback repository id");

  // Every technology token the fallback carries must resolve, or it silently
  // creates a filter identity the canonical registry does not know about.
  for (const block of source.matchAll(/name: "([^"]+)"[\s\S]*?topics: \[([^\]]*)\]/g)) {
    const repo = block[1];
    const topics = [...block[2].matchAll(/"([^"]+)"/g)].map(match => match[1]);
    for (const topic of topics) {
      const resolved = canonicalKeys(topic);
      for (const key of resolved) {
        if (!TECHNOLOGIES[key]) failures.push(`${repo}: topic "${topic}" resolves to unknown canonical key ${key}`);
      }
    }
  }

  // npm package keys must name real fallback repositories.
  for (const entry of source.matchAll(/"([A-Za-z0-9._-]+)": "(nuxt-[a-z-]+)"/g)) {
    if (!names.includes(entry[1])) failures.push(`npm package map names unknown repository ${entry[1]}`);
  }
  return failures;
}

/* ------------------------------------------------------------------ *
 * This repository's own portfolio.json
 * ------------------------------------------------------------------ */
export function verifyPortfolioMetadata() {
  const failures = [];
  let metadata;
  try { metadata = JSON.parse(read("portfolio.json")); }
  catch (error) { return [`portfolio.json is not parseable: ${error.message}`]; }

  for (const field of ["project", "repository", "links", "stack", "caseStudy"]) {
    if (!metadata[field]) failures.push(`portfolio.json is missing the ${field} section`);
  }
  if (metadata.project && !metadata.project.slug) failures.push("portfolio.json has no project slug");
  if (metadata.project?.lifecycle && !LIFECYCLE_VALUES.includes(metadata.project.lifecycle)) {
    failures.push(`portfolio.json lifecycle "${metadata.project.lifecycle}" is not one of ${LIFECYCLE_VALUES.join(", ")}`);
  }

  // Structurally required links must be well-formed absolute URLs. Reachability
  // is deliberately not tested here.
  for (const [name, value] of Object.entries(metadata.links || {})) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "string") { failures.push(`portfolio.json link ${name} is not a string`); continue; }
    if (value.startsWith("./")) continue;
    try { new URL(value); } catch { failures.push(`portfolio.json link ${name} is not a valid URL: ${value}`); }
  }

  // Declared languages must be technologies the registry recognises, otherwise
  // a project silently drops out of its own filter.
  for (const language of metadata.stack?.languages || []) {
    if (!canonicalKeys(language).length) failures.push(`portfolio.json language "${language}" has no canonical technology`);
  }
  return failures;
}

/* ------------------------------------------------------------------ *
 * Null relationships
 * ------------------------------------------------------------------ */
export function verifyContentRelations() {
  const failures = [];
  const notes = read("frontend/src/features/notes/notesData.ts");
  const caseStudies = read("frontend/src/data/caseStudiesData.ts");
  const fallback = read("frontend/src/features/projects/repoTypes.ts");

  const noteSlugs = [...notes.matchAll(/slug: "([^"]+)"/g)].map(match => match[1]);
  const caseStudyIds = [...caseStudies.matchAll(/^\s{4}id: "([^"]+)"/gm)].map(match => match[1]);
  const repoNames = [...fallback.matchAll(/name: "([^"]+)"/g)].map(match => match[1]);

  const relations = (source, field) => [...source.matchAll(new RegExp(`${field}: \\[([^\\]]*)\\]`, "g"))]
    .map(match => [...match[1].matchAll(/"([^"]+)"/g)].map(entry => entry[1]));

  const checkTargets = (groups, valid, label, owners = []) => {
    groups.forEach((targets, index) => {
      if (new Set(targets).size !== targets.length) failures.push(`${label}: duplicate target in one relation list`);
      for (const target of targets) {
        if (!valid.includes(target)) failures.push(`${label}: "${target}" does not resolve to a known target`);
        if (owners[index] && owners[index] === target) failures.push(`${label}: "${target}" refers to itself`);
      }
    });
  };

  checkTargets(relations(notes, "relatedProjects"), repoNames, "note relatedProjects");
  checkTargets(relations(notes, "relatedCaseStudies"), caseStudyIds, "note relatedCaseStudies");
  checkTargets(relations(caseStudies, "relatedProjects"), repoNames, "case study relatedProjects");
  checkTargets(relations(caseStudies, "relatedNotes"), noteSlugs, "case study relatedNotes");

  if (new Set(noteSlugs).size !== noteSlugs.length) failures.push("Duplicate engineering note slug");
  if (new Set(caseStudyIds).size !== caseStudyIds.length) failures.push("Duplicate client case study id");
  return failures;
}

/* ------------------------------------------------------------------ *
 * Release metadata
 * ------------------------------------------------------------------ */
export function verifyReleaseIntegrity(resolveReleaseCodename) {
  const failures = [];
  const pkg = JSON.parse(read("package.json"));
  const releases = JSON.parse(read("config/releases.json"));
  const readme = read("README.md");
  const changelog = read("docs/CHANGELOG.md");

  const version = pkg.version;
  const codename = resolveReleaseCodename(releases, version);
  if (!codename) failures.push(`The active version ${version} resolves to no codename`);

  // One structured source of truth: every family and historical entry is
  // exercised through the resolver instead of a hand-written case list that has
  // to be edited by hand at every family change.
  const families = Object.keys(releases.families || {});
  const reserved = Object.keys(releases.reserved || {});
  const codenames = [...Object.values(releases.families || {}).map(entry => entry.codename),
                     ...Object.values(releases.historical || {}).map(entry => entry.codename)];
  if (new Set(codenames).size !== codenames.length) failures.push("A codename is used by more than one release family");
  for (const family of families) {
    if (reserved.includes(family)) failures.push(`Family ${family} is both live and reserved`);
    const expected = releases.families[family].codename;
    for (const patch of ["0", "1", "99"]) {
      if (resolveReleaseCodename(releases, `${family}.${patch}`) !== expected) {
        failures.push(`${family}.${patch} does not resolve to ${expected}`);
      }
    }
  }
  for (const [exact, entry] of Object.entries(releases.historical || {})) {
    if (resolveReleaseCodename(releases, exact) !== entry.codename) failures.push(`${exact} does not resolve to ${entry.codename}`);
  }
  // A reserved family must not look like a shipped one.
  for (const family of reserved) {
    if (resolveReleaseCodename(releases, `${family}.0`) !== null) failures.push(`Reserved family ${family} resolves as if released`);
  }

  // CHANGELOG: newest entry is the active version, and no version appears twice.
  const documented = [...changelog.matchAll(/^## ([\d.]+)/gm)].map(match => match[1]);
  if (documented[0] !== version) failures.push(`docs/CHANGELOG.md newest release is ${documented[0]}, expected ${version}`);
  if (new Set(documented).size !== documented.length) failures.push("docs/CHANGELOG.md documents a version twice");

  // README: the latest six, newest first, no duplicates, current release present.
  const section = readme.split("## Release history")[1]?.split("## License")[0] || "";
  const listed = [...section.matchAll(/^### v([\d.]+)/gm)].map(match => match[1]);
  if (!listed.includes(version)) failures.push(`README release history does not include ${version}`);
  if (new Set(listed).size !== listed.length) failures.push("README lists a release version twice");
  if (listed.length > 6) failures.push(`README lists ${listed.length} releases; the contract is the latest 6`);
  if (documented.length >= 6 && listed.length !== 6) failures.push(`README lists ${listed.length} releases; 6 are available`);

  const compare = (a, b) => {
    const left = a.split(".").map(Number), right = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((left[i] || 0) !== (right[i] || 0)) return (right[i] || 0) - (left[i] || 0);
    return 0;
  };
  const sorted = [...listed].sort(compare);
  if (listed.join(",") !== sorted.join(",")) failures.push(`README releases are not newest-first: ${listed.join(", ")}`);
  for (const listedVersion of listed) {
    if (!documented.includes(listedVersion)) failures.push(`README lists ${listedVersion}, which docs/CHANGELOG.md does not document`);
  }

  // Generated build metadata must describe the active release.
  const build = read("frontend/src/generated/build.ts");
  if (!build.includes(`BUILD_VERSION = ${JSON.stringify(version)}`)) failures.push("Generated build metadata does not carry the active version");
  if (codename && !build.includes(`BUILD_CODENAME = ${JSON.stringify(codename)}`)) failures.push("Generated build metadata does not carry the active codename");
  return failures;
}

/** Every project directory that must carry portfolio metadata. */
export function verifyProjectAssets() {
  const failures = [];
  const notesDir = resolve("frontend/public/notes-content");
  if (existsSync(notesDir)) {
    const index = JSON.parse(read("frontend/public/notes-index.json"));
    const files = readdirSync(notesDir);
    for (const note of index) {
      if (!files.includes(`${note.slug}.md`)) failures.push(`Note ${note.slug} has no markdown file`);
    }
  }
  return failures;
}
