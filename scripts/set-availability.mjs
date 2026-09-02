import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const file = path.resolve("config/availability.json");
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const aliases = {
  "open-selective": "selective",
  limited: "focused",
};
const raw = String(process.argv[2] || "").trim().toLowerCase();
const requested = aliases[raw] || raw;
const allowed = Object.keys(config.profiles || {});

function list() {
  console.log("Portfolio mood presets:\n");
  for (const key of allowed) {
    const profile = config.profiles[key];
    const marker = key === config.activeStatus ? "*" : " ";
    console.log(`${marker} ${key.padEnd(11)} ${profile.label}`);
  }
  console.log("\nChange mood with: npm run mood -- <preset>");
}

if (!raw || raw === "list" || raw === "--list" || raw === "-l") {
  list();
  process.exit(0);
}

if (!allowed.includes(requested)) {
  console.error(`Unknown portfolio mood: ${raw}`);
  console.error(`Allowed moods: ${allowed.join(", ")}`);
  console.error("Compatibility aliases: open-selective → selective, limited → focused");
  process.exit(1);
}

if (config.activeStatus === requested) {
  console.log(`Portfolio mood is already: ${requested}`);
  console.log(`Header: ${config.profiles[requested].shortLabel}`);
  process.exit(0);
}

config.activeStatus = requested;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Portfolio mood changed to: ${requested}`);
console.log(`Header: ${config.profiles[requested].shortLabel}`);
console.log(`Status: ${config.profiles[requested].label}`);
console.log("Push to develop to verify on staging, or use the manual GitHub Action.");
