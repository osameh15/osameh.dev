import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const indexPath = resolve("dist/index.html");
const robotsPath = resolve("dist/robots.txt");
const htaccessPath = resolve("dist/.htaccess");

let html = readFileSync(indexPath, "utf8");
html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow,noarchive" />');
html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');
html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, '');
writeFileSync(indexPath, html);
writeFileSync(robotsPath, "User-agent: *\nDisallow: /\n");

let htaccess = readFileSync(htaccessPath, "utf8");
htaccess = htaccess.replace('<IfModule mod_headers.c>\n  Header always set X-Content-Type-Options', '<IfModule mod_headers.c>\n  Header always set X-Robots-Tag "noindex, nofollow, noarchive"\n  Header always set X-Content-Type-Options');
writeFileSync(htaccessPath, htaccess);
console.log("Prepared staging bundle: noindex/noarchive enabled.");
