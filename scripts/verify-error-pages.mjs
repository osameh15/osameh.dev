// Guards for the branded HTTP error experience.
//
// Two separate contracts are checked. The repository contract covers what the
// server is configured to do; the bundle contract covers what actually reaches
// the document root. An ErrorDocument pointing at a file the artifact does not
// contain is the failure mode that turns a branded error back into the hosting
// provider's default page, so the two are verified against each other.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ERROR_ROBOTS, ERROR_STATUSES, errorTabName } from "./error-pages.mjs";

// Text that would mean an error document is a hosting template rather than ours.
const FOREIGN_BRANDING = [/DirectAdmin/i, /cPanel/i, /Apache\/\d/i, /Powered by/i, /ParsPack/i, /پارس ?پک/];

/** The rules the server configuration itself must satisfy. */
export function verifyErrorConfiguration(htaccessPath = "backend/server/.htaccess") {
  const failures = [];
  const htaccess = readFileSync(resolve(htaccessPath), "utf8");

  for (const { status } of ERROR_STATUSES) {
    const directive = new RegExp(`^\\s*ErrorDocument\\s+${status}\\s+/errors/${status}\\.html\\s*$`, "m");
    if (!directive.test(htaccess)) failures.push(`Missing ErrorDocument ${status} /errors/${status}.html`);
  }

  // A remote ErrorDocument turns the error into a redirect and loses the status.
  if (/^\s*ErrorDocument\s+\d{3}\s+https?:/mi.test(htaccess)) {
    failures.push("An ErrorDocument points at an absolute URL, which would redirect and discard the original status code");
  }

  // The error documents must stay outside indexing, and out of both sitemaps.
  // The rule is deliberately scoped with "Header set": a directly requested
  // error document answers 200 and is the only indexable case, and a site-wide
  // "Header always set X-Robots-Tag" belongs to the staging packager alone.
  const errorFilesBlock = /<FilesMatch "\^\(\?:400\|401\|403\|404\|405\|408\|429\|500\|502\|503\|504\)\\\.html\$">([\s\S]*?)<\/FilesMatch>/.exec(htaccess);
  if (!errorFilesBlock) failures.push("Error documents are not covered by an X-Robots-Tag noindex rule");
  else {
    if (!/^\s*Header set X-Robots-Tag "noindex, nofollow, noarchive"\s*$/m.test(errorFilesBlock[1])) {
      failures.push("Error documents are missing a scoped X-Robots-Tag noindex header");
    }
    if (/Header always set X-Robots-Tag/.test(errorFilesBlock[1])) {
      failures.push("The error-document X-Robots-Tag rule uses \"always\", which reads as a site-wide indexing policy");
    }
  }

  // /api/ refusals must stay machine-readable, so the library-include refusal is
  // answered by the API's own JSON endpoint rather than by an Apache error.
  if (!/RewriteRule \^api\/\(\?:lib\/\|recaptcha\\\.php\$\|config\\\.php\$\|health-probe\\\.php\$\) api\/forbidden\.php \[L\]/.test(htaccess)) {
    failures.push("Backend library includes are no longer refused through the JSON /api/ forbidden endpoint");
  }
  const forbidden = existsSync(resolve("backend/api/forbidden.php")) ? readFileSync(resolve("backend/api/forbidden.php"), "utf8") : "";
  if (!/http_response_code\(403\)/.test(forbidden) || !/application\/json/.test(forbidden)) {
    failures.push("backend/api/forbidden.php does not answer with a JSON 403");
  }

  // Every API refusal carries its own body. A bodyless status is exactly what
  // Apache replaces with an ErrorDocument, which would hand a client HTML.
  const analytics = readFileSync(resolve("backend/api/analytics.php"), "utf8");
  const methodRefusal = analytics.slice(analytics.indexOf("http_response_code(405)"), analytics.indexOf("http_response_code(405)") + 400);
  if (!/json_encode/.test(methodRefusal)) failures.push("backend/api/analytics.php returns a 405 with no JSON body");

  return failures;
}

/** The rules a built or packaged bundle must satisfy. */
export function verifyErrorDocuments(bundleDir) {
  const failures = [];

  const stylesheet = resolve(bundleDir, "errors/error.css");
  if (!existsSync(stylesheet)) failures.push(`${bundleDir}/errors/error.css is missing`);

  for (const { status, reason } of ERROR_STATUSES) {
    const path = resolve(bundleDir, `errors/${status}.html`);
    if (!existsSync(path)) { failures.push(`${bundleDir}/errors/${status}.html is missing`); continue; }
    const html = readFileSync(path, "utf8");

    if (!html.includes(`content="${ERROR_ROBOTS}"`)) failures.push(`errors/${status}.html is missing the ${ERROR_ROBOTS} robots meta tag`);
    if (!html.includes(`>${status}<`)) failures.push(`errors/${status}.html does not display the status ${status}`);
    if (!html.includes(reason)) failures.push(`errors/${status}.html does not carry the reason phrase "${reason}"`);
    if (!html.includes(errorTabName(status))) failures.push(`errors/${status}.html does not use the C++ editor identity ${errorTabName(status)}`);
    if (!html.includes('href="/errors/error.css"')) failures.push(`errors/${status}.html does not load the shared error stylesheet`);
    if (!html.includes('href="/"')) failures.push(`errors/${status}.html has no link back to the site root`);

    // The whole point of a static error document is that it renders when the
    // application does not. Any script at all, or any bundle reference, breaks
    // that and would also be refused by the Content-Security-Policy.
    if (/<script\b/i.test(html)) failures.push(`errors/${status}.html contains a script`);
    if (/javascript:/i.test(html)) failures.push(`errors/${status}.html contains a javascript: URL`);
    if (/\/assets\//.test(html)) failures.push(`errors/${status}.html depends on a hashed application bundle asset`);
    if (/<style\b/i.test(html)) failures.push(`errors/${status}.html uses an inline <style> block, which the Content-Security-Policy refuses`);

    for (const pattern of FOREIGN_BRANDING) {
      if (pattern.test(html)) failures.push(`errors/${status}.html carries foreign hosting branding matching ${pattern}`);
    }
  }

  return failures;
}
