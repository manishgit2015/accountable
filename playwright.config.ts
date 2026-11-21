// End-to-end tests with the installed Google Chrome (DEP-1, spec 13.2).
// Playwright starts both servers itself, on the test ports with the test database that
// scripts/run-tests.mjs sets, so `npm test` needs nothing else running.
import { defineConfig } from "@playwright/test";

const apiPort = process.env.ACCOUNTABLE_API_PORT || "8001";
const webPort = process.env.ACCOUNTABLE_WEB_PORT || "5174";
const testDb = process.env.ACCOUNTABLE_DB;

if (!testDb) {
  throw new Error("Run the end-to-end tests with `npm test`, which gives them a temporary database.");
}

const env = {
  ACCOUNTABLE_DB: testDb,
  ACCOUNTABLE_API_PORT: apiPort,
  ACCOUNTABLE_WEB_PORT: webPort,
};

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["perf/**", "visual/**"],
  // One worker: the tests share one database and one pair of servers (RK-17).
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
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
