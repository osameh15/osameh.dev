import { spawnSync } from "node:child_process";

// PHP is present in CI and on the host, but not on every workstation. A missing
// binary is reported and skipped rather than failing a local run; CI is the
// authoritative result.
const probe = spawnSync("php", ["-v"], { stdio: "ignore", shell: process.platform === "win32" });
if (probe.error || probe.status !== 0) {
  console.log("PHP TEST NOT RUN — PHP EXECUTABLE UNAVAILABLE");
  process.exit(0);
}

const run = spawnSync("php", ["backend/tests/recaptcha-decision.php"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(run.status ?? 1);
