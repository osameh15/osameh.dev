// Fingerprinted asset retention across deployments.
//
// The deploy mirrors the artifact with --delete, so the previous build's hashed
// assets used to disappear the moment a new build was published. Document HTML
// is cacheable (`public, max-age=300, stale-while-revalidate=...`) and the CDN
// keys variants by request headers, so a client could still be handed the
// previous build's document minutes after a deploy - a document referencing
// /assets/index-<oldhash>.js that no longer existed. Those requests 404'd and
// the application never booted.
//
// The invariant this module enforces:
//
//   a document that any cache may still serve must never reference an asset
//   that has already been removed from the origin.
//
// Purge is not the guarantee. A purge can be delayed, partial or regionally
// inconsistent, so correctness rests on retention: the previous builds' assets
// stay on the origin until no cached document can still reference them.
//
// Retention is bounded in both directions. A generation survives while it is
// one of the newest KEEP_GENERATIONS, or while it is younger than
// MIN_RETENTION_MS - whichever keeps it longer. Anything older than both is
// unreachable by any cached document and is pruned.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Previous builds kept on the origin regardless of age. Rollback needs at least one. */
export const KEEP_GENERATIONS = 3;

/**
 * Minimum time a superseded generation stays reachable.
 *
 * The longest a document may be served from cache is its own
 * `max-age + stale-while-revalidate` (300 + 60 = 360s for note, case-study and
 * project documents). Six hours is that window many times over, so a cached
 * document always dies long before the assets it names.
 */
export const MIN_RETENTION_MS = 6 * 60 * 60 * 1000;

/** Name of the retention ledger, kept at the web root beside build-info.json. */
export const LEDGER_FILE = "asset-retention.json";

const EMPTY_LEDGER = { version: 1, generations: [] };

/** Parses a ledger, treating anything malformed or absent as "no history". */
export function readLedger(text) {
  if (!text) return { ...EMPTY_LEDGER, generations: [] };
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.generations)) return { ...EMPTY_LEDGER, generations: [] };
    const generations = parsed.generations
      .filter(entry => entry && typeof entry.buildId === "string" && Array.isArray(entry.assets))
      .map(entry => ({
        buildId: entry.buildId,
        deployedAt: typeof entry.deployedAt === "string" ? entry.deployedAt : new Date(0).toISOString(),
        assets: [...new Set(entry.assets.filter(asset => typeof asset === "string"))].sort(),
      }));
    return { version: 1, generations };
  } catch {
    // A corrupt ledger must not authorise deletions. Treating it as empty keeps
    // every asset currently on the origin instead.
    return { ...EMPTY_LEDGER, generations: [] };
  }
}

/** The fingerprinted assets a built bundle publishes, as web-root-relative paths. */
export function collectBuildAssets(distDir) {
  const root = resolve(distDir);
  const assetsDir = join(root, "assets");
  if (!existsSync(assetsDir)) return [];
  const out = [];
  const visit = directory => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else out.push(`assets/${path.slice(assetsDir.length + 1).replaceAll("\\", "/")}`);
    }
  };
  visit(assetsDir);
  return out.sort();
}

/**
 * Decides what the origin keeps and what it may delete after publishing `build`.
 *
 * Pure: the caller supplies the clock and the previous ledger, so the same
 * inputs always produce the same plan and the whole policy is testable without
 * a server. `delete` never contains an asset that a retained generation still
 * names, which is what makes a shared (unchanged) asset survive a prune of the
 * build it first appeared in.
 */
export function planAssetRetention({
  ledger = EMPTY_LEDGER,
  build,
  now = Date.now(),
  keepGenerations = KEEP_GENERATIONS,
  minRetentionMs = MIN_RETENTION_MS,
} = {}) {
  if (!build || typeof build.buildId !== "string" || !Array.isArray(build.assets)) {
    throw new Error("planAssetRetention requires a build with a buildId and an assets array");
  }
  const deployedAt = build.deployedAt || new Date(now).toISOString();
  const current = {
    buildId: build.buildId,
    deployedAt,
    assets: [...new Set(build.assets)].sort(),
  };

  // Re-deploying the same build id replaces its entry rather than stacking a
  // duplicate generation, so a re-run of a deploy job cannot push a still-needed
  // generation out of the retention window.
  const history = ledger.generations.filter(entry => entry.buildId !== current.buildId);
  const ordered = [current, ...history];

  const retained = [];
  const pruned = [];
  ordered.forEach((generation, index) => {
    const age = now - Date.parse(generation.deployedAt);
    const youngEnough = Number.isFinite(age) ? age < minRetentionMs : true;
    if (index < keepGenerations || youngEnough) retained.push(generation);
    else pruned.push(generation);
  });

  const reachable = new Set(retained.flatMap(generation => generation.assets));
  const deletions = [...new Set(pruned.flatMap(generation => generation.assets))]
    .filter(asset => !reachable.has(asset))
    .sort();

  return {
    ledger: { version: 1, generations: retained },
    keep: [...reachable].sort(),
    delete: deletions,
    pruned: pruned.map(generation => generation.buildId),
  };
}

/**
 * Deterministic proof of the deployment invariant, with no server and no CDN.
 *
 * Simulates a sequence of deploys and asserts that at no point is an asset
 * deleted while a document that any cache may still serve could reference it.
 */
export function verifyAssetRetention() {
  const failures = [];
  const hour = 60 * 60 * 1000;
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  const at = hours => new Date(t0 + hours * hour).toISOString();

  const buildA = { buildId: "A", deployedAt: at(0), assets: ["assets/index-aaa.js", "assets/index-aaa.css", "assets/shared-zzz.woff2"] };
  const buildB = { buildId: "B", deployedAt: at(1), assets: ["assets/index-bbb.js", "assets/index-bbb.css", "assets/shared-zzz.woff2"] };

  // 1. Publishing A on an empty origin deletes nothing.
  const first = planAssetRetention({ ledger: readLedger(null), build: buildA, now: t0 });
  if (first.delete.length) failures.push(`The first deploy planned deletions: ${first.delete.join(", ")}`);

  // 2. The core overlap: right after B, every asset A's document names is kept.
  const second = planAssetRetention({ ledger: first.ledger, build: buildB, now: t0 + hour });
  for (const asset of buildA.assets) {
    if (!second.keep.includes(asset)) failures.push(`Deploying B stopped retaining ${asset}, which a cached A document still references`);
  }
  for (const asset of buildB.assets) {
    if (!second.keep.includes(asset)) failures.push(`Deploying B did not retain its own asset ${asset}`);
  }
  if (second.delete.length) failures.push(`Deploying B deleted a still-reachable asset: ${second.delete.join(", ")}`);

  // 3. Rollback to A: A's assets are still on the origin, so A boots.
  const rollback = planAssetRetention({ ledger: second.ledger, build: buildA, now: t0 + 2 * hour });
  for (const asset of buildA.assets) {
    if (!rollback.keep.includes(asset)) failures.push(`Rolling back to A could not serve ${asset}`);
  }

  // 4. Bounded storage: many deploys, well past the age floor, prune old
  //    generations instead of accumulating for ever.
  let ledger = second.ledger;
  for (let index = 0; index < 6; index += 1) {
    const build = {
      buildId: `C${index}`,
      deployedAt: at(12 + index * 12),
      assets: [`assets/index-c${index}.js`],
    };
    ledger = planAssetRetention({ ledger, build, now: Date.parse(build.deployedAt) }).ledger;
  }
  if (ledger.generations.length > KEEP_GENERATIONS) {
    failures.push(`Retention is unbounded: ${ledger.generations.length} generations survived, maximum is ${KEEP_GENERATIONS}`);
  }
  const survivingAssets = new Set(ledger.generations.flatMap(generation => generation.assets));
  if (survivingAssets.has("assets/index-aaa.js")) failures.push("A long-superseded generation was never pruned");

  // 5. A generation younger than the stale-document window is retained even
  //    when it has already fallen outside the generation count.
  const rapid = Array.from({ length: KEEP_GENERATIONS + 2 }, (unused, index) => ({
    buildId: `R${index}`,
    deployedAt: at(100 + index * 0.05),
    assets: [`assets/index-r${index}.js`],
  }));
  let rapidLedger = readLedger(null);
  let lastPlan = null;
  for (const build of rapid) {
    lastPlan = planAssetRetention({ ledger: rapidLedger, build, now: Date.parse(build.deployedAt) });
    rapidLedger = lastPlan.ledger;
  }
  if (lastPlan.delete.length) {
    failures.push(`Deploys inside the stale-document window deleted assets a cached document may still name: ${lastPlan.delete.join(", ")}`);
  }
  if (!rapidLedger.generations.some(generation => generation.buildId === "R0")) {
    failures.push("A generation younger than the minimum retention window was pruned by generation count alone");
  }

  // 6. An asset carried unchanged into a newer build survives the prune of the
  //    generation it first shipped in.
  const sharedPlan = planAssetRetention({
    ledger: { version: 1, generations: [{ buildId: "old", deployedAt: at(0), assets: ["assets/shared-zzz.woff2", "assets/gone-old.js"] }] },
    build: { buildId: "new", deployedAt: at(400), assets: ["assets/shared-zzz.woff2"] },
    now: t0 + 400 * hour,
    keepGenerations: 1,
  });
  if (sharedPlan.delete.includes("assets/shared-zzz.woff2")) failures.push("An asset still shipped by the current build was scheduled for deletion");
  if (!sharedPlan.delete.includes("assets/gone-old.js")) failures.push("An unreachable asset was not scheduled for deletion");

  // 7. A corrupt or missing ledger must never authorise a deletion.
  const corrupt = planAssetRetention({ ledger: readLedger("{not json"), build: buildB, now: t0 + 500 * hour });
  if (corrupt.delete.length) failures.push("A corrupt ledger authorised deletions instead of failing safe");

  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];

  if (command === "plan") {
    // Used by the deploy workflows: reads the ledger fetched from the origin and
    // the built bundle, and writes the next ledger plus the deletion list.
    const [, , , distDir, ledgerPath, buildId, outLedger, outDeletions] = process.argv;
    const ledger = readLedger(existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : null);
    const plan = planAssetRetention({ ledger, build: { buildId, assets: collectBuildAssets(distDir) } });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outLedger, JSON.stringify(plan.ledger, null, 2) + "\n");
    writeFileSync(outDeletions, plan.delete.join("\n") + (plan.delete.length ? "\n" : ""));
    console.log(`Retaining ${plan.keep.length} asset(s) across ${plan.ledger.generations.length} generation(s); pruning ${plan.delete.length}.`);
    if (plan.pruned.length) console.log(`Pruned generations: ${plan.pruned.join(", ")}`);
  } else {
    const failures = verifyAssetRetention();
    for (const failure of failures) console.error(`✗ ${failure}`);
    if (failures.length) { console.error(`\nAsset retention verification failed (${failures.length}).`); process.exit(1); }
    console.log("✓ Fingerprinted asset retention keeps every cached document's assets reachable, stays bounded, and fails safe");
  }
}
