/** Resolve exact historical metadata first, then an active major/minor family. */
export function resolveReleaseCodename(metadata, version) {
  if (!version) return null;
  const clean = String(version).trim().replace(/^v/i, "");
  if (!clean) return null;
  const exact = metadata.historical?.[clean]?.codename;
  if (exact) return exact;
  const match = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(clean);
  return (match && metadata.families?.[`${match[1]}.${match[2]}`]?.codename) || null;
}
