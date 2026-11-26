// End-to-end tests with the installed Google Chrome (DEP-1, spec 13.2).
// Playwright starts both servers itself, on the test ports with the test database that
// scripts/run-tests.mjs sets, so `npm test` needs nothing else running.
import { defineConfig } from "@playwright/test";

const apiPort = process.env.ACCOUNTABLE_API_PORT || "8001";
const webPort = process.env.ACCOUNTABLE_WEB_PORT || "5174";
const testDb = process.env.ACCOUNTABLE_DB;
// `npm run test:perf` sets this: run only e2e/perf/ (V-P01), against its performance data.
const perf = process.env.ACCOUNTABLE_PERF === "1";
// `node scripts/run-tests.mjs visual` sets this: run only e2e/visual/ (V-M04 screenshots, T5.2).
const visual = process.env.ACCOUNTABLE_VISUAL === "1";

if (!testDb) {
  throw new Error("Run the end-to-end tests with `npm test`, which gives them a temporary database.");
}

const env = {
  ACCOUNTABLE_DB: testDb,
  ACCOUNTABLE_API_PORT: apiPort,
  ACCOUNTABLE_WEB_PORT: webPort,
  // Set by scripts/run-tests.mjs: the backend's clock matches the browser's (e2e/fixtures.ts FIXED_NOW).
  ACCOUNTABLE_FIXED_NOW: process.env.ACCOUNTABLE_FIXED_NOW ?? "",
};

export default defineConfig({
  testDir: perf ? "e2e/perf" : visual ? "e2e/visual" : "e2e",
  testIgnore: perf || visual ? [] : ["perf/**", "visual/**"],
  timeout: perf ? 300_000 : 30_000,
  // One worker: the tests share one database and one pair of servers (RK-17).
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  // Screenshot baselines (visual suite only) live in the change folder that owns them: a test names its
  // path under docs/changes/, for example ["mvp-darkmode", "baseline", "dashboard.png"].
  snapshotPathTemplate: "docs/changes/{arg}{ext}",
  use: {
    channel: "chrome",
    baseURL: `http://127.0.0.1:${webPort}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "uv run --no-sync --directory backend python -m app.main",
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev --workspace frontend",
      url: `http://127.0.0.1:${webPort}`,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
