import { pathToFileURL } from "node:url";
import { encodePathSegments, normalizeReadmeAssetUrl } from "../src/githubAssetUrlCore.js";

const REPO = { owner: "osameh15", repoName: "ArappMainBack-End", defaultBranch: "main" };

export function verifyReadmeAssetUrls() {
const failures = [];
const pass = message => void message;
const fail = message => failures.push(message);
const eq = (actual, expected, label) => actual === expected ? pass(label) : fail(`${label}: expected ${expected}, got ${actual}`);

// --- Segment encoding: exactly once, for every supported shape. -------------
const segmentCases = [
  ["My Image.png", "My%20Image.png", "raw space"],
  ["My%20Image.png", "My%20Image.png", "already-encoded space is not re-encoded"],
  ["100% complete.png", "100%25%20complete.png", "literal percent"],
  ["تصویر نمونه.png", encodeURIComponent("تصویر نمونه.png"), "unicode"],
  ["image#1.png", "image%231.png", "hash in filename"],
  ["image?1.png", "image%3F1.png", "question mark in filename"],
  ["image+1.png", "image%2B1.png", "plus sign"],
  ["%E2%9C%93.png", "%E2%9C%93.png", "valid escape preserved"],
  ["%ZZ.png", "%25ZZ.png", "malformed escape does not throw"],
  ["a%2Fb.png", "a%2Fb.png", "encoded slash stays inside its segment"],
  ["docs/screenshots/My Image.png", "docs/screenshots/My%20Image.png", "nested directories"],
];
for (const [input, expected, label] of segmentCases) {
  eq(encodePathSegments(input), expected, `segment: ${label}`);
  eq(encodePathSegments(encodePathSegments(input)), encodePathSegments(input), `segment idempotent: ${label}`);
}

// --- Absolute URLs ----------------------------------------------------------
// The real defect: a third party's raw URL was rewritten onto our own repo AND
// double-encoded. Both halves must stay fixed.
const laravel = "https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg";
eq(normalizeReadmeAssetUrl(laravel, REPO), laravel, "third-party raw URL is left untouched");
const normalizedLaravel = normalizeReadmeAssetUrl(laravel, REPO);
if (!normalizedLaravel.includes("%2520")) pass("third-party raw URL contains no %2520"); else fail("third-party raw URL was double-encoded");

eq(normalizeReadmeAssetUrl("https://raw.githubusercontent.com/osameh15/osameh.dev/main/docs/img/a.png", REPO),
  "https://raw.githubusercontent.com/osameh15/osameh.dev/main/docs/img/a.png", "well-formed raw URL for another of our repos is untouched");
eq(normalizeReadmeAssetUrl("https://raw.githubusercontent.com/images/shot.png", REPO),
  "https://raw.githubusercontent.com/osameh15/ArappMainBack-End/main/images/shot.png", "legacy prefix-less raw path is repaired");
eq(normalizeReadmeAssetUrl("https://raw.githubusercontent.com/images/My%20Shot.png", REPO),
  "https://raw.githubusercontent.com/osameh15/ArappMainBack-End/main/images/My%20Shot.png", "repaired legacy path is not double-encoded");
eq(normalizeReadmeAssetUrl("https://example.com/image.png", REPO), "https://example.com/image.png", "unrelated absolute URL preserved");
eq(normalizeReadmeAssetUrl("https://github.com/osameh15/ArappMainBack-End/blob/main/docs/My%20Image.png", REPO),
  "https://raw.githubusercontent.com/osameh15/ArappMainBack-End/main/docs/My%20Image.png", "our blob URL becomes raw without double-encoding");

// --- Relative paths ---------------------------------------------------------
const root = "https://raw.githubusercontent.com/osameh15/ArappMainBack-End/main/";
eq(normalizeReadmeAssetUrl("image.png", REPO), root + "image.png", "bare relative");
eq(normalizeReadmeAssetUrl("./image.png", REPO), root + "image.png", "dot-slash relative");
eq(normalizeReadmeAssetUrl("docs/My Image.png", REPO), root + "docs/My%20Image.png", "relative raw space");
eq(normalizeReadmeAssetUrl("docs/My%20Image.png", REPO), root + "docs/My%20Image.png", "relative already-encoded space");
eq(normalizeReadmeAssetUrl("docs/تصویر.png", REPO), root + "docs/" + encodeURIComponent("تصویر.png"), "relative unicode");
eq(normalizeReadmeAssetUrl("/docs/a.png", REPO), root + "docs/a.png", "leading slash is repository-relative");

// --- Security ---------------------------------------------------------------
eq(normalizeReadmeAssetUrl("javascript:alert(1)", REPO), "", "javascript: rejected");
eq(normalizeReadmeAssetUrl("data:text/html,<script>", REPO), "", "non-image data: rejected");
eq(normalizeReadmeAssetUrl("data:image/png;base64,AAA", REPO), "data:image/png;base64,AAA", "image data: preserved");
eq(normalizeReadmeAssetUrl("", REPO), "", "empty input");
const traversal = normalizeReadmeAssetUrl("../../../../etc/passwd", REPO);
if (traversal.startsWith("https://raw.githubusercontent.com/")) pass(`traversal stays on raw host: ${traversal}`);
else fail(`traversal escaped the raw host: ${traversal}`);

// --- Idempotence over the whole normalizer ---------------------------------
for (const input of [laravel, "docs/My Image.png", "docs/My%20Image.png", "image.png", "https://example.com/a.png"]) {
  const once = normalizeReadmeAssetUrl(input, REPO);
  eq(normalizeReadmeAssetUrl(once, REPO), once, `normalizer idempotent: ${input.slice(0, 48)}`);
}

  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = verifyReadmeAssetUrls();
  for (const failure of failures) console.error(`✗ ${failure}`);
  if (failures.length) { console.error(`${failures.length} README asset URL check(s) failed.`); process.exit(1); }
  console.log("All README asset URL checks passed.");
}
