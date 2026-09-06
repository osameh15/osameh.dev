import releases from "../config/releases.json";
import { resolveReleaseCodename } from "./releaseMetadataCore.js";

/**
 * Release-codename resolution. `config/releases.json` is the single source of
 * truth; no component may hardcode a codename.
 *
 * A codename belongs to a release FAMILY (major.minor), so every patch in that
 * family inherits it: 5.2.0, 5.2.1 and 5.2.99 are all Cipher. Historical
 * releases named before the family policy use exact-version mappings.
 *
 * `reserved` names are forward planning only and are deliberately NOT resolved,
 * so an unreleased family can never surface in the UI as an active release.
 */
export const RELEASE_THEME = releases.theme;

/** Codename for a version, or null when no release metadata maps that version. */
export function getReleaseCodename(version: string | null | undefined): string | null {
  return resolveReleaseCodename(releases, version);
}

/**
 * Runtime release label. Mapped: "v5.2.0 · CIPHER". Unmapped: "v5.1.1".
 * Never renders a dangling separator, "null" or "undefined".
 */
export function formatReleaseLabel(version: string | null | undefined, options?: { prefix?: boolean; uppercase?: boolean }): string {
  if (!version) return "";
  const clean = version.trim().replace(/^v/i, "");
  const prefix = options?.prefix === false ? "" : "v";
  const codename = getReleaseCodename(clean);
  if (!codename) return `${prefix}${clean}`;
  return `${prefix}${clean} · ${options?.uppercase === false ? codename : codename.toUpperCase()}`;
}

/** Documentation/GitHub form: "5.2.0 — Cipher", or just the unmapped version. */
export function formatReleaseTitle(version: string | null | undefined): string {
  if (!version) return "";
  const clean = version.trim().replace(/^v/i, "");
  const codename = getReleaseCodename(clean);
  return codename ? `${clean} — ${codename}` : clean;
}
