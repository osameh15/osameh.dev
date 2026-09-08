// Validates the Neural Cipher icon pack and social artwork.
//
// Reads PNG/JPEG headers directly - no image dependency - so a wrong-sized or
// missing brand asset fails before it can ship. Legacy names deleted in v5.2.0
// must also stay unreferenced, otherwise a runtime request would 404.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Every frontend source file, wherever a feature happens to live. */
function frontendSourceFiles(root = "frontend/src") {
  const out = [];
  const visit = directory => {
    for (const entry of readdirSync(resolve(directory))) {
      const path = join(directory, entry);
      if (statSync(resolve(path)).isDirectory()) visit(path);
      else if (/\.(?:ts|tsx|css)$/.test(entry)) out.push(path.replaceAll("\\\\", "/"));
    }
  };
  visit(root);
  return out;
}
import { pathToFileURL } from "node:url";

function pngSize(path) {
  const buffer = readFileSync(path);
  if (buffer.slice(1, 4).toString() !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(path) {
  const buffer = readFileSync(path);
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

// Runtime icons only. Authoring assets (source, 1024 master, app-icon-*) live in
// public/ but are pruned from the deploy bundle.
const requiredIcons = {
  "icon-16x16.png": [16, 16],
  "icon-32x32.png": [32, 32],
  "icon-48x48.png": [48, 48],
  "icon-64x64.png": [64, 64],
  "icon-128x128.png": [128, 128],
  "icon-256x256.png": [256, 256],
  "apple-touch-icon.png": [180, 180],
  "pwa-192x192.png": [192, 192],
  "pwa-512x512.png": [512, 512],
};
const retiredIcons = ["icon-192.png", "icon-512.png"];

export function verifyBrandAssets() {
  const failures = [];

  for (const [name, [width, height]] of Object.entries(requiredIcons)) {
    const path = resolve("frontend/public/icons", name);
    if (!existsSync(path)) { failures.push(`Missing brand icon: frontend/public/icons/${name}`); continue; }
    const size = pngSize(path);
    if (!size) failures.push(`Brand icon is not a valid PNG: ${name}`);
    else if (size.width !== width || size.height !== height) failures.push(`Brand icon ${name} is ${size.width}x${size.height}, expected ${width}x${height}`);
  }

  if (!existsSync(resolve("frontend/public/icons/favicon.ico"))) failures.push("Missing frontend/public/icons/favicon.ico");
  if (!existsSync(resolve("frontend/public/icons/README.md"))) failures.push("Missing frontend/public/icons/README.md icon-pack documentation");

  // Social artwork must be a real 1200x630 card.
  const social = resolve("frontend/public/og-cover-social.jpg");
  if (!existsSync(social)) failures.push("Missing frontend/public/og-cover-social.jpg");
  else {
    const size = jpegSize(social);
    if (!size) failures.push("og-cover-social.jpg is not a readable JPEG");
    else if (size.width !== 1200 || size.height !== 630) failures.push(`og-cover-social.jpg is ${size.width}x${size.height}, expected 1200x630`);
  }

  // Retired names must not appear anywhere that produces a runtime request.
  const scanned = [
    "frontend/index.html",
    "frontend/public/manifest.webmanifest",
    "frontend/public/sw.js",
    "backend/server/.htaccess",
    "scripts/ensure-deploy-files.mjs",
    ...frontendSourceFiles(),
  ];
  for (const file of scanned) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    const source = readFileSync(path, "utf8");
    for (const retired of retiredIcons) {
      if (source.includes(retired)) failures.push(`${file} still references the retired icon ${retired}`);
    }
    if (/favicon\.svg/.test(source)) failures.push(`${file} still references the retired favicon.svg brand mark`);
  }

  // The manifest must point at icons that actually exist.
  const manifestPath = resolve("frontend/public/manifest.webmanifest");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      for (const icon of manifest.icons || []) {
        const target = resolve("frontend/public", String(icon.src).replace(/^\//, ""));
        if (!existsSync(target)) failures.push(`Manifest references a missing icon: ${icon.src}`);
      }
      if (!(manifest.icons || []).some(icon => String(icon.sizes) === "192x192")) failures.push("Manifest is missing a 192x192 PWA icon");
      if (!(manifest.icons || []).some(icon => String(icon.sizes) === "512x512")) failures.push("Manifest is missing a 512x512 PWA icon");
    } catch {
      failures.push("frontend/public/manifest.webmanifest is not valid JSON");
    }
  }

  // The document head must wire the new pack.
  const index = existsSync(resolve("frontend/index.html")) ? readFileSync(resolve("frontend/index.html"), "utf8") : "";
  if (!index.includes("/icons/favicon.ico")) failures.push("index.html does not reference the new favicon.ico");
  if (!/apple-touch-icon["'][^>]*sizes="180x180"|sizes="180x180"[^>]*apple-touch-icon/.test(index) && !index.includes("/icons/apple-touch-icon.png")) failures.push("index.html does not reference the 180x180 Apple touch icon");

  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = verifyBrandAssets();
  for (const failure of failures) console.error(`✗ ${failure}`);
  if (failures.length) { console.error(`\nBrand asset verification failed (${failures.length}).`); process.exit(1); }
  console.log("✓ Neural Cipher icon pack, manifest icons, and 1200x630 social artwork verified");
}
