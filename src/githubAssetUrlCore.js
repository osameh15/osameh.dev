/**
 * GitHub README asset URL normalization.
 *
 * One invariant governs this module: every path segment is percent-encoded
 * EXACTLY once, so `normalize(normalize(path)) === normalize(path)`. README
 * authors write both raw ("My Image.png") and pre-encoded ("My%20Image.png")
 * paths, and URL parsers hand back already-encoded pathnames, so a plain
 * `encodeURIComponent` pass turns "%20" into "%2520" and breaks the asset.
 */

/** Decode a segment when it holds valid escapes; malformed input is left alone. */
function decodeSegmentOnce(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    // e.g. "%ZZ" or a literal "%" - encodeURIComponent below escapes it safely.
    return segment;
  }
}

/**
 * Encode each structural path segment exactly once.
 *
 * Splitting on "/" happens BEFORE decoding, so an encoded slash ("a%2Fb") stays
 * inside its own segment and is re-encoded as "%2F" rather than being promoted
 * into path structure.
 */
export function encodePathSegments(value) {
  return String(value)
    .split("/")
    .filter(Boolean)
    .map(segment => encodeURIComponent(decodeSegmentOnce(segment)))
    .join("/");
}

/**
 * Resolve a README asset reference to a fetchable URL.
 *
 * `owner`/`repoName`/`defaultBranch` describe the repository the README came
 * from; repository-relative assets resolve against its raw content root.
 */
export function normalizeReadmeAssetUrl(source, { owner, repoName, defaultBranch }) {
  const value = String(source || "").replace(/&amp;/g, "&").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("//")) return "https:" + value;

  if (/^https:\/\//i.test(value)) {
    // GitHub blob links are HTML pages, not image resources. Convert our own.
    const blob = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
    if (blob && blob[1].toLowerCase() === owner.toLowerCase() && blob[2].toLowerCase() === repoName.toLowerCase()) {
      return `https://raw.githubusercontent.com/${encodePathSegments(blob[1])}/${encodePathSegments(blob[2])}/${encodePathSegments(blob[3])}/${encodePathSegments(blob[4])}`;
    }

    try {
      const absolute = new URL(value);
      if (absolute.hostname.toLowerCase() === "raw.githubusercontent.com") {
        const parts = absolute.pathname.split("/").filter(Boolean);
        // A well-formed raw URL is owner/repo/ref/path - at least four segments.
        // Anything that long already addresses a real repository (very often a
        // third party's, such as a framework's logo) and must be left alone.
        // Only genuinely prefix-less legacy paths are repaired against this repo.
        if (parts.length < 4 && parts.length) {
          return `https://raw.githubusercontent.com/${encodePathSegments(owner)}/${encodePathSegments(repoName)}/${encodePathSegments(defaultBranch)}/${encodePathSegments(parts.join("/"))}`;
        }
      }
    } catch {
      return "";
    }
    return value;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";

  const clean = value.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/^\/+/, "");
  if (!clean) return "";
  const base = `https://raw.githubusercontent.com/${encodePathSegments(owner)}/${encodePathSegments(repoName)}/${encodePathSegments(defaultBranch)}/`;
  try {
    // The URL parser encodes raw characters and preserves existing escapes, so
    // relative paths are already normalized exactly once by resolution alone.
    return new URL(clean, base).href;
  } catch {
    return "";
  }
}
