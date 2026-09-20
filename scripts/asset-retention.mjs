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
//
// Bootstrap and adoption. An origin can hold fingerprinted assets that no valid
// ledger describes: everything published before the ledger existed, and
// everything published while a ledger was missing or malformed. Those files are
// not deleted on sight - a stale document may still name them - and they are not
// immortal either. The deploy enumerates the remote asset directory and adopts
// whatever it finds outside the ledger into one synthetic generation, timestamped
// with the observation time, which is conservative because the real publication
// time is unknowable. From then on the adopted generation obeys the same policy
// as any other, so it leaves the retention window and is pruned like the rest.
//
// Two things stay strictly fail-safe. A missing or malformed ledger authorises
// zero deletions for that deploy - it bootstraps a valid one instead - and a
// remote inventory that cannot be read authorises zero deletions as well, and
// says so rather than reporting bounded retention it did not prove.

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

const EMPTY_LEDGER = { version: 1, generations: [], valid: true };

/** Prefix of the synthetic generation that adopts assets no ledger described. */
export const ADOPTED_PREFIX = "legacy-untracked";

/**
 * Parses a ledger.
 *
 * `valid` is the fail-safe signal: false means the origin had no usable history,
 * whether the file was absent, empty, malformed or the wrong shape. A deploy that
 * reads an invalid ledger deletes nothing and bootstraps a valid one.
 */
export function readLedger(text) {
  const invalid = { version: 1, generations: [], valid: false };
  if (!text || !text.trim()) return invalid;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.generations)) return invalid;
    const generations = parsed.generations
      .filter(entry => entry && typeof entry.buildId === "string" && Array.isArray(entry.assets))
      .map(entry => ({
        buildId: entry.buildId,
        deployedAt: typeof entry.deployedAt === "string" ? entry.deployedAt : new Date(0).toISOString(),
        assets: [...new Set(entry.assets.filter(asset => typeof asset === "string"))].sort(),
        // Adoption metadata survives every round trip, so a later deploy can tell
        // an observed generation from a published one and never re-adopts it.
        ...(entry.adopted === true ? { adopted: true } : {}),
        ...(typeof entry.firstObservedAt === "string" ? { firstObservedAt: entry.firstObservedAt } : {}),
        ...(typeof entry.adoptedAt === "string" ? { adoptedAt: entry.adoptedAt } : {}),
      }));
    return { version: 1, generations, valid: true };
  } catch {
    // A corrupt ledger must not authorise deletions. Treating it as no history
    // keeps every asset currently on the origin instead.
    return invalid;
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
 * Is this path part of the fingerprinted build-asset namespace this module owns?
 *
 * Only `assets/<name>-<hash>.<ext>` with Rollup's eight-character fingerprint
 * qualifies. Everything else the origin holds - `robots.txt`, `icons/`, the error
 * documents, a hand-placed file that happens to sit under `assets/` - is outside
 * the model: never adopted, never counted, never deleted. The fingerprint must
 * look like a fingerprint rather than an English word, so `hero-template.css`
 * stays unmanaged while `index-DUmGD1ls.css` is managed.
 */
export function isManagedAsset(path) {
  if (typeof path !== "string" || !path.startsWith("assets/") || path.includes("..")) return false;
  const fingerprint = /-([A-Za-z0-9_-]{8})\.[A-Za-z0-9]+$/.exec(path);
  return Boolean(fingerprint) && /[A-Z0-9_-]/.test(fingerprint[1]);
}

/**
 * Normalises a remote directory listing into managed asset paths.
 *
 * Returns null for "inventory unknown" - a listing that could not be obtained -
 * which is a different answer from an empty listing and is what suppresses
 * deletions. Accepts bare names (`lftp cls -1`) and rooted paths alike, and
 * silently drops directories, noise lines and unmanaged files.
 */
export function parseRemoteInventory(text) {
  if (text === null || text === undefined) return null;
  const entries = new Set();
  for (const raw of String(text).split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.endsWith("/")) continue;
    line = line.replace(/^\.?\/+/, "");
    if (!line.startsWith("assets/")) line = `assets/${line}`;
    if (isManagedAsset(line)) entries.add(line);
  }
  return [...entries].sort();
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
  inventory = null,
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
  const adoptedId = `${ADOPTED_PREFIX}-${current.buildId}`;
  const history = ledger.generations.filter(
    entry => entry.buildId !== current.buildId && entry.buildId !== adoptedId,
  );

  // Adoption. Anything on the origin that neither this build nor the ledger
  // accounts for becomes one synthetic generation, observed now. `now` is
  // deliberately conservative: the real publication time is unknowable, so the
  // adopted files get a full retention window starting at first sight, which also
  // guarantees the overlap a stale document referencing them still needs.
  const observedAt = new Date(now).toISOString();
  const tracked = new Set([...current.assets, ...history.flatMap(generation => generation.assets)]);
  const orphans = inventory ? inventory.filter(asset => isManagedAsset(asset) && !tracked.has(asset)).sort() : [];
  const adopted = orphans.length
    ? {
        buildId: adoptedId,
        deployedAt: observedAt,
        assets: orphans,
        adopted: true,
        firstObservedAt: observedAt,
        adoptedAt: observedAt,
      }
    : null;

  // The adopted generation is the oldest thing on the origin, so it sits last:
  // it survives on age now and leaves the window before any published generation.
  const ordered = [current, ...history, ...(adopted ? [adopted] : [])];

  const retained = [];
  const pruned = [];
  ordered.forEach((generation, index) => {
    const age = now - Date.parse(generation.deployedAt);
    const youngEnough = Number.isFinite(age) ? age < minRetentionMs : true;
    if (index < keepGenerations || youngEnough) retained.push(generation);
    else pruned.push(generation);
  });

  const reachable = new Set(retained.flatMap(generation => generation.assets));
  let deletions = [...new Set(pruned.flatMap(generation => generation.assets))]
    .filter(asset => !reachable.has(asset))
    .sort();

  // The two fail-safes. Neither is reachable through the policy above - an
  // invalid ledger carries no history to prune - but both are asserted here so
  // the guarantee is a property of the plan rather than of its inputs.
  const suppressed = [];
  if (ledger.valid === false) {
    suppressed.push("the ledger on the origin was missing or malformed, so this deploy bootstraps one and deletes nothing");
  }
  if (!inventory) {
    suppressed.push("the remote asset inventory could not be read, so no deletion can be proved safe");
  }
  if (suppressed.length) deletions = [];
  // With an inventory in hand, delete only what is demonstrably there; an asset
  // already gone is not a deletion this deploy needs to perform.
  else {
    const present = new Set(inventory);
    deletions = deletions.filter(asset => present.has(asset));
  }

  return {
    ledger: { version: 1, generations: retained },
    keep: [...reachable].sort(),
    delete: deletions,
    pruned: pruned.map(generation => generation.buildId),
    adopted,
    orphans: inventory ? orphans : null,
    inventoryKnown: Boolean(inventory),
    bootstrapped: ledger.valid === false,
    suppressed,
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
    inventory: ["assets/gone-old.js", "assets/shared-zzz.woff2"],
    keepGenerations: 1,
  });
  if (sharedPlan.delete.includes("assets/shared-zzz.woff2")) failures.push("An asset still shipped by the current build was scheduled for deletion");
  if (!sharedPlan.delete.includes("assets/gone-old.js")) failures.push("An unreachable asset was not scheduled for deletion");

  // 7. A corrupt or missing ledger must never authorise a deletion.
  const corrupt = planAssetRetention({ ledger: readLedger("{not json"), build: buildB, now: t0 + 500 * hour });
  if (corrupt.delete.length) failures.push("A corrupt ledger authorised deletions instead of failing safe");

  // ---- Bootstrap and adoption of assets no ledger ever described ----

  const legacyA = ["assets/index-A1aaaaaa.js", "assets/index-A1aaaaaa.css"];
  const legacyB = ["assets/index-B2bbbbbb.js", "assets/index-B2bbbbbb.css"];
  const legacy = [...legacyA, ...legacyB];
  const buildC = { buildId: "C", deployedAt: at(0), assets: ["assets/index-C3cccccc.js", "assets/index-C3cccccc.css"] };

  /** Deploys `build` against a simulated origin, returning the plan and the origin after it. */
  const deployAgainst = (ledgerIn, build, remote, { inventoryKnown = true } = {}) => {
    const inventory = inventoryKnown ? [...new Set([...remote, ...build.assets])].sort() : null;
    const plan = planAssetRetention({ ledger: ledgerIn, build, now: Date.parse(build.deployedAt), inventory });
    const next = new Set([...remote, ...build.assets]);
    for (const asset of plan.delete) next.delete(asset);
    return { plan, remote: next };
  };

  // 8. The required bootstrap scenario. Generations A and B are on the origin,
  //    no ledger exists, and C is deployed: nothing is deleted, A and B survive,
  //    C is published, and the new ledger accounts for all three.
  const bootstrap = deployAgainst(readLedger(null), buildC, new Set(legacy));
  if (bootstrap.plan.delete.length) failures.push(`A bootstrap deploy deleted assets instead of adopting them: ${bootstrap.plan.delete.join(", ")}`);
  if (!bootstrap.plan.bootstrapped) failures.push("A deploy reading no ledger did not report itself as a bootstrap");
  for (const asset of [...legacy, ...buildC.assets]) {
    if (!bootstrap.plan.keep.includes(asset)) failures.push(`The bootstrap deploy stopped retaining ${asset}`);
    if (!bootstrap.remote.has(asset)) failures.push(`The bootstrap deploy removed ${asset} from the origin`);
  }
  const bootstrapLedgerAssets = new Set(bootstrap.plan.ledger.generations.flatMap(generation => generation.assets));
  for (const asset of legacy) {
    if (!bootstrapLedgerAssets.has(asset)) failures.push(`${asset} was left outside the retention ledger after the bootstrap deploy`);
  }
  if (!bootstrap.plan.ledger.generations.some(generation => generation.adopted === true && generation.buildId.startsWith(ADOPTED_PREFIX))) {
    failures.push("The bootstrap deploy produced no adopted generation for the previously untracked assets");
  }

  // 9. Boundedness after adoption. Advancing deploys past both the generation
  //    count and the age floor must make the adopted assets prune-eligible: no
  //    asset is immortal merely because it predated the ledger.
  let boundedLedger = bootstrap.plan.ledger;
  let boundedRemote = bootstrap.remote;
  for (let index = 0; index < KEEP_GENERATIONS + 2; index += 1) {
    const build = { buildId: `D${index}`, deployedAt: at(8 + index * 8), assets: [`assets/index-D${index}dddddd.js`] };
    const step = deployAgainst(boundedLedger, build, boundedRemote);
    boundedLedger = step.plan.ledger;
    boundedRemote = step.remote;
  }
  for (const asset of legacy) {
    if (boundedRemote.has(asset)) failures.push(`Adopted legacy asset ${asset} was never pruned; retention is unbounded for assets that predate the ledger`);
  }
  if (boundedLedger.generations.some(generation => generation.buildId.startsWith(ADOPTED_PREFIX))) {
    failures.push("The adopted generation outlived both retention rules instead of ageing out");
  }
  if (boundedLedger.generations.length > KEEP_GENERATIONS) {
    failures.push(`Retention after adoption is unbounded: ${boundedLedger.generations.length} generations survived`);
  }

  // 10. Adoption happens once. The next deploy sees the adopted assets in the
  //     ledger, so it neither re-adopts them nor restarts their retention window.
  const readopt = deployAgainst(
    readLedger(JSON.stringify(bootstrap.plan.ledger)),
    { buildId: "C2", deployedAt: at(1), assets: ["assets/index-C4cccccc.js"] },
    bootstrap.remote,
  );
  const adoptedGenerations = readopt.plan.ledger.generations.filter(generation => generation.buildId.startsWith(ADOPTED_PREFIX));
  if (adoptedGenerations.length !== 1) failures.push(`A second deploy produced ${adoptedGenerations.length} adopted generations instead of reusing the first`);
  else if (adoptedGenerations[0].adoptedAt !== at(0)) failures.push("A later deploy restarted the adopted generation's retention window");
  if (readopt.plan.orphans && readopt.plan.orphans.length) failures.push(`A deploy re-adopted assets the ledger already tracked: ${readopt.plan.orphans.join(", ")}`);

  // 11. The corrupt-ledger recovery path: remote assets exist, the ledger is
  //     malformed. The first deploy deletes nothing and rebuilds a valid ledger
  //     from the verified inventory alone; normal pruning resumes afterwards.
  const recovery = deployAgainst(readLedger("{ generations: [oops"), buildC, new Set(legacy));
  if (recovery.plan.delete.length) failures.push("A corrupt ledger authorised deletions during recovery");
  if (!recovery.plan.bootstrapped) failures.push("A deploy recovering from a corrupt ledger did not report itself as a bootstrap");
  const recovered = new Set(recovery.plan.ledger.generations.flatMap(generation => generation.assets));
  for (const asset of [...legacy, ...buildC.assets]) {
    if (!recovered.has(asset)) failures.push(`Recovery from a corrupt ledger lost track of ${asset}`);
  }
  if ([...recovered].some(asset => !isManagedAsset(asset))) failures.push("Recovery invented ledger entries that are not verified remote assets");
  const afterRecovery = planAssetRetention({
    ledger: readLedger(JSON.stringify(recovery.plan.ledger)),
    build: { buildId: "E", deployedAt: at(400), assets: ["assets/index-E5eeeeee.js"] },
    now: t0 + 400 * hour,
    inventory: [...recovery.remote, "assets/index-E5eeeeee.js"].sort(),
    keepGenerations: 1,
  });
  if (!afterRecovery.delete.length) failures.push("Pruning did not resume after a ledger was recovered");
  if (afterRecovery.bootstrapped) failures.push("A deploy reading the recovered ledger still reported a bootstrap");

  // 12. An inventory that could not be read proves nothing, so it deletes
  //     nothing - even with a perfectly valid ledger holding a stale generation.
  const blind = planAssetRetention({
    ledger: readLedger(JSON.stringify({ version: 1, generations: [{ buildId: "old", deployedAt: at(0), assets: ["assets/index-F6ffffff.js"] }] })),
    build: { buildId: "G", deployedAt: at(400), assets: ["assets/index-G7gggggg.js"] },
    now: t0 + 400 * hour,
    inventory: null,
    keepGenerations: 1,
  });
  if (blind.delete.length) failures.push("A deploy that could not enumerate the origin still planned deletions");
  if (blind.inventoryKnown) failures.push("A deploy with no inventory reported one");
  if (!blind.suppressed.length) failures.push("A deploy with no inventory did not report that it could not establish a safe state");

  // 13. Classification. Only the fingerprinted build-asset namespace is managed:
  //     unrelated static files are never adopted and never deleted.
  const unmanaged = ["assets/logo.svg", "assets/hero-template.css", "assets/", "robots.txt", "icons/apple-touch-icon.png", "build-info.json"];
  for (const path of unmanaged) {
    if (isManagedAsset(path)) failures.push(`${path} was classified as a managed fingerprinted asset`);
  }
  for (const path of ["assets/index-DUmGD1ls.css", "assets/index-Bhx6G0Px.js"]) {
    if (!isManagedAsset(path)) failures.push(`${path} was not recognised as a fingerprinted build asset`);
  }
  const mixed = planAssetRetention({
    ledger: readLedger(null),
    build: buildC,
    now: t0,
    inventory: parseRemoteInventory(["/assets/index-A1aaaaaa.js", "index-B2bbbbbb.css", "assets/logo.svg", "assets/sub/", "", "robots.txt"].join("\n")),
  });
  if (mixed.delete.length) failures.push("A bootstrap deploy with mixed remote content planned deletions");
  const mixedAdopted = mixed.adopted ? mixed.adopted.assets : [];
  if (mixedAdopted.some(asset => !isManagedAsset(asset))) failures.push(`Adoption pulled in a file outside the build-asset namespace: ${mixedAdopted.join(", ")}`);
  if (!mixedAdopted.includes("assets/index-A1aaaaaa.js") || !mixedAdopted.includes("assets/index-B2bbbbbb.css")) {
    failures.push("Adoption missed a fingerprinted asset present on the origin");
  }
  if (parseRemoteInventory(null) !== null) failures.push("An unreadable inventory was reported as an empty one");

  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];

  if (command === "plan") {
    // Used by the deploy workflows: reads the ledger and the remote asset
    // listing fetched from the origin plus the built bundle, and writes the next
    // ledger and the deletion list. A missing inventory file means the listing
    // could not be obtained, which is not the same as an empty directory.
    const [, , , distDir, ledgerPath, buildId, outLedger, outDeletions, inventoryPath] = process.argv;
    const assets = collectBuildAssets(distDir);

    // The remote listing enumerates the asset root only. A nested asset would
    // therefore never be accounted for, so the build may not produce one.
    const nested = assets.filter(asset => asset.slice("assets/".length).includes("/"));
    if (nested.length) {
      console.error(`::error::The bundle publishes assets in nested directories (${nested.join(", ")}), which the remote inventory does not enumerate.`);
      process.exit(1);
    }
    const unmanaged = assets.filter(asset => !isManagedAsset(asset));
    if (unmanaged.length) {
      console.log(`Not managed by retention (unfingerprinted, left untouched): ${unmanaged.join(", ")}`);
    }

    const ledger = readLedger(existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : null);
    let inventory = parseRemoteInventory(
      inventoryPath && existsSync(inventoryPath) ? readFileSync(inventoryPath, "utf8") : null,
    );
    // The build published its own assets moments ago, so an empty listing is a
    // failed listing rather than an empty origin.
    if (inventory && !inventory.length) inventory = null;

    const plan = planAssetRetention({ ledger, build: { buildId, assets }, inventory });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outLedger, JSON.stringify(plan.ledger, null, 2) + "\n");
    writeFileSync(outDeletions, plan.delete.join("\n") + (plan.delete.length ? "\n" : ""));

    console.log(`Remote inventory: ${plan.inventoryKnown ? `${inventory.length} managed asset(s) observed` : "unavailable"}.`);
    if (plan.bootstrapped) console.log("No valid ledger on the origin: this deploy bootstraps one and deletes nothing.");
    if (plan.adopted) {
      console.log(`Adopted ${plan.adopted.assets.length} previously untracked asset(s) as generation ${plan.adopted.buildId}: ${plan.adopted.assets.join(", ")}`);
    } else if (plan.inventoryKnown) {
      console.log("No untracked fingerprinted assets on the origin.");
    }
    console.log(`Retaining ${plan.keep.length} asset(s) across ${plan.ledger.generations.length} generation(s); pruning ${plan.delete.length}.`);
    if (plan.pruned.length) console.log(`Pruned generations: ${plan.pruned.join(", ")}`);
    // An unreadable inventory is the one case that leaves the deploy unable to
    // prove anything about the origin. A bootstrap is the opposite: it deletes
    // nothing and hands the next deploy a ledger that accounts for everything.
    if (!plan.inventoryKnown) {
      console.log("::warning::Prune phase could not establish a safe state: the remote asset inventory could not be read. Zero deletions were performed and bounded retention is not proved for this deploy.");
    } else if (plan.bootstrapped) {
      console.log("Bootstrap complete: zero deletions, and the ledger now accounts for every fingerprinted asset on the origin. Bounded pruning resumes on the next deploy.");
    }
  } else {
    const failures = verifyAssetRetention();
    for (const failure of failures) console.error(`✗ ${failure}`);
    if (failures.length) { console.error(`\nAsset retention verification failed (${failures.length}).`); process.exit(1); }
    console.log("✓ Fingerprinted asset retention keeps every cached document's assets reachable, stays bounded, and fails safe");
  }
}
