// Renders index.html frame by frame into an MP4.
//
//   node motion/cv-reel/render.mjs                 -> motion/cv-reel/osameh-cv-reel.mp4 (with soundtrack)
//   node motion/cv-reel/render.mjs --stills 2,6,12 -> PNG stills at those seconds
//
// The composition is a pure function of time (window.renderAt), so every frame
// is captured exactly rather than screen-recorded. Needs ffmpeg on PATH (or
// FFMPEG=/path/to/ffmpeg) and the repo's Playwright dev dependency. Set
// CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's own.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const args = process.argv.slice(2);
const stillsAt = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
const out = join(here, "osameh-cv-reel.mp4");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, "index.html")).href + "?render");
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
});
const duration = await page.evaluate(() => window.DURATION);
const frame = async t => {
  await page.evaluate(time => window.renderAt(time), t);
  return page.locator("#stage").screenshot({ type: "png", animations: "disabled" });
};

if (stillsAt) {
  for (const t of stillsAt) {
    const path = join(here, `still-${String(t).replace(".", "_")}s.png`);
    await page.evaluate(time => window.renderAt(time), t);
    await page.locator("#stage").screenshot({ path });
    console.log("wrote", path);
  }
} else {
  await import("./soundtrack.mjs"); // (re)writes soundtrack.wav
  const ffmpeg = spawn(process.env.FFMPEG || "ffmpeg", [
    "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-i", join(here, "soundtrack.wav"), "-map", "0:v", "-map", "1:a",
    "-c:a", "aac", "-b:a", "192k", "-shortest",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    const png = await frame(i / FPS);
    if (!ffmpeg.stdin.write(png)) await new Promise(r => ffmpeg.stdin.once("drain", r));
    if (i % FPS === 0) process.stdout.write(`\rframe ${i}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise((res, rej) => ffmpeg.on("close", code => code === 0 ? res() : rej(new Error("ffmpeg exited " + code))));
  console.log("\nwrote", out);
}
await browser.close();
