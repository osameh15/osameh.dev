import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    // CI installs and runs Playwright's own pinned Chromium, which is the
    // authoritative browser for this suite. A workstation that cannot download
    // it can point the same run at an installed browser instead:
    //   PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    port: 4173,
    // CI always builds and serves its own controlled preview. Locally, an
    // already-running preview on the same port is reused instead of failing
    // the entire run.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
