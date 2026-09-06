import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "dist/index.html", "dist/.htaccess", "dist/build-info.json", "dist/api/github.php", "dist/api/contact.php",
  "dist/api/health.php", "dist/project.php", "dist/note.php", "dist/case-study.php", "dist/case-studies-index.json", "dist/sitemap.php", "dist/notes-index.json", "dist/sw.js"
];
const missing = required.filter(file => !existsSync(resolve(file)));
if (missing.length) throw new Error(`Missing deploy files: ${missing.join(", ")}`);

const notes = JSON.parse(readFileSync(resolve("dist/notes-index.json"), "utf8"));
for (const note of notes) {
  const path = resolve(`dist/notes-content/${note.slug}.md`);
  if (!existsSync(path)) throw new Error(`Built note missing: ${note.slug}`);
}
const html = readFileSync(resolve("dist/index.html"), "utf8");
const localRefs = [...html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)["']/g)].map(match => match[1]);
for (const ref of localRefs) {
  if (["/", "/home", "/about", "/projects", "/experience", "/now", "/changelog", "/notes", "/case-studies", "/contact", "/resume"].includes(ref)) continue;
  const file = resolve(`dist${ref}`);
  if (!existsSync(file) && !ref.startsWith("/projects/") && !ref.startsWith("/notes/") && !ref.startsWith("/case-studies/")) throw new Error(`Broken built local reference: ${ref}`);
}
const caseStudies = JSON.parse(readFileSync(resolve("dist/case-studies-index.json"), "utf8"));
console.log(`Verified deployment bundle, ${notes.length} notes, and ${caseStudies.length} case studies.`);
