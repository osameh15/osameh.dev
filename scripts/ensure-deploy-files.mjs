import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  ["public/.htaccess", "dist/.htaccess"],
  ["public/api/github.php", "dist/api/github.php"],
  ["public/favicon.svg", "dist/favicon.svg"],
  ["public/og-cover.webp", "dist/og-cover.webp"],
  ["public/og-cover-social.jpg", "dist/og-cover-social.jpg"],
  ["public/build-info.json", "dist/build-info.json"],
];

for (const [source, target] of files) {
  const from = resolve(source);
  const to = resolve(target);
  if (!existsSync(from)) throw new Error(`Missing deployment file: ${source}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// Keep the strict CSP valid even if Vite changes whitespace around the JSON-LD block.
// The source .htaccess contains a placeholder; the built dist/.htaccess receives the exact hash.
const indexPath = resolve("dist/index.html");
const htaccessPath = resolve("dist/.htaccess");
const html = readFileSync(indexPath, "utf8");
const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
if (!jsonLdMatch) throw new Error("Missing JSON-LD script in dist/index.html");

const jsonLdHash = createHash("sha256").update(jsonLdMatch[1], "utf8").digest("base64");
let htaccess = readFileSync(htaccessPath, "utf8");
if (!htaccess.includes("__JSONLD_CSP_HASH__")) throw new Error("Missing JSON-LD CSP placeholder in dist/.htaccess");
htaccess = htaccess.replaceAll("__JSONLD_CSP_HASH__", jsonLdHash);
writeFileSync(htaccessPath, htaccess);
