import { spawnSync } from "node:child_process";

// PHP is present in CI and on the host, but not on every workstation. A missing
// binary is reported and skipped rather than failing a local run; CI is the
// authoritative result.
const probe = spawnSync("php", ["-v"], { stdio: "ignore", shell: process.platform === "win32" });
if (probe.error || probe.status !== 0) {
  console.log("PHP TEST NOT RUN — PHP EXECUTABLE UNAVAILABLE");
  process.exit(0);
}

const suites = ["backend/tests/recaptcha-decision.php", "backend/tests/config-isolation.php", "backend/tests/github-health.php"];
for (const suite of suites) {
  const run = spawnSync("php", [suite], { stdio: "inherit", shell: process.platform === "win32" });
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}
process.exit(0);
