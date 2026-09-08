// Secret-leakage guard.
//
// The private secrets file holds the GitHub token and both reCAPTCHA secrets.
// It lives outside the document root on the server, is git-ignored, and must
// never appear in the repository, in dist/, or in a packaged environment
// bundle. Public reCAPTCHA SITE keys are a different thing entirely - they are
// meant to ship - so this guard is about secrets and about where the site keys
// are allowed to be written.
//
// Nothing here prints a secret value. It matches on names and shapes only.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PRIVATE_SECRET_FILE = "osameh-portfolio-secrets.php";

/** Every file under a directory, skipping nothing - a bundle must be fully covered. */
function walk(root) {
  const out = [];
  const visit = directory => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else out.push(path);
    }
  };
  if (existsSync(root)) visit(root);
  return out;
}

/**
 * Verifies that a built or packaged bundle carries no server secret material.
 *
 * @param {string} root Directory to scan (dist, dist-staging, dist-production).
 * @returns {string[]} Failure messages, empty when the bundle is clean.
 */
export function verifyBundleSecrets(root) {
  const failures = [];
  const base = resolve(root);
  if (!existsSync(base)) return [`Bundle directory does not exist: ${root}`];

  for (const path of walk(base)) {
    const name = relative(base, path).replaceAll("\\", "/");
    if (name.endsWith(PRIVATE_SECRET_FILE)) failures.push(`${root} contains the private secrets file: ${name}`);
    if (/(^|\/)private\//.test(name)) failures.push(`${root} contains a private/ path: ${name}`);

    // Text assets only. A secret would have to be readable to be leaked.
    if (!/\.(?:js|mjs|cjs|map|html|json|php|txt|css|webmanifest|xml)$/i.test(name)) continue;
    const source = readFileSync(path, "utf8");
    if (/RECAPTCHA_SECRET/i.test(source) && !name.startsWith("lib/recaptcha.php")) {
      failures.push(`${root}/${name} references a reCAPTCHA secret name outside the server-side verifier`);
    }
    // The client bundle must never carry a secret-shaped assignment.
    if (/\.(?:js|mjs|cjs|map|html|css)$/i.test(name) && /recaptcha[^\n]{0,40}secret\s*[:=]/i.test(source)) {
      failures.push(`${root}/${name} assigns a reCAPTCHA secret in client-side output`);
    }
  }
  return failures;
}

/**
 * Verifies the repository itself: no committed secrets file, no secret read
 * from a VITE_* variable, and public site keys written in exactly one module.
 *
 * @param {string[]} trackedFiles Output of `git ls-files`, already split.
 * @returns {string[]} Failure messages, empty when the repository is clean.
 */
export function verifyRepositorySecrets(trackedFiles) {
  const failures = [];

  for (const file of trackedFiles) {
    if (file.endsWith(PRIVATE_SECRET_FILE)) failures.push(`The private secrets file is tracked by git: ${file}`);
    if (file.startsWith("private/")) failures.push(`A private/ path is tracked by git: ${file}`);
  }

  const gitignore = existsSync(resolve(".gitignore")) ? readFileSync(resolve(".gitignore"), "utf8") : "";
  if (!gitignore.includes(PRIVATE_SECRET_FILE)) failures.push(".gitignore no longer excludes the private secrets file");
  if (!/^private\/$/m.test(gitignore)) failures.push(".gitignore no longer excludes the private/ directory");

  // Site keys are public, but they belong in one module so an environment can
  // never be selected by a stray literal somewhere else.
  const configPath = "frontend/src/config/recaptchaConfig.ts";
  const configSource = readFileSync(resolve(configPath), "utf8");
  const siteKeys = [...configSource.matchAll(/"(6L[A-Za-z0-9_-]{20,})"/g)].map(match => match[1]);
  if (siteKeys.length !== 2) failures.push(`${configPath} must define exactly the two public site keys, found ${siteKeys.length}`);

  const sourceFiles = trackedFiles.filter(file => /^(?:frontend|backend|scripts|tests)\//.test(file) && /\.(?:ts|tsx|js|mjs|css|php|html|json)$/i.test(file));
  for (const file of sourceFiles) {
    if (file === configPath) continue;
    // `git ls-files` still lists a path that has been moved but not yet
    // committed. Scan what is actually on disk.
    if (!existsSync(resolve(file))) continue;
    const source = readFileSync(resolve(file), "utf8");
    for (const key of siteKeys) {
      if (source.includes(key)) failures.push(`${file} hardcodes a reCAPTCHA site key; select it through ${configPath}`);
    }
    if (/VITE_[A-Z_]*RECAPTCHA/i.test(source)) failures.push(`${file} exposes reCAPTCHA configuration through a VITE_ variable`);
    if (/RECAPTCHA_SECRET/i.test(source) && file !== "backend/lib/recaptcha.php" && file !== "scripts/verify-secrets.mjs") {
      failures.push(`${file} references a reCAPTCHA secret name outside the server-side verifier`);
    }
  }

  return failures;
}
