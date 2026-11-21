// Every end-to-end test imports `test` and `expect` from here, not from @playwright/test (V-E00).
// - The test database is reset before each test.
// - The test fails on any browser console error or uncaught page error (R7).
// - The test fails on any request that leaves 127.0.0.1 or localhost (R2, NFR-4).
// - The browser's clock is fixed, so "today" is the same in every run (spec 13.2).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test as base, expect } from "@playwright/test";

/** Saturday 21 November 2026, 14:30 local time: the same moment as the backend tests' clock. */
export const FIXED_NOW = new Date(2026, 10, 21, 14, 30, 0);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_DB = resolve(ROOT, "backend", "data", "accountable.db");
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** Reset the test database to its starting data, through the app's own command. */
export function resetDatabase(mode: "seed" | "clear" = "seed"): void {
  const db = process.env.ACCOUNTABLE_DB;
  if (!db || resolve(db).toLowerCase() === DEFAULT_DB.toLowerCase()) {
    throw new Error("The end-to-end tests need a temporary ACCOUNTABLE_DB. Run them with `npm test`.");
  }
  // The seed and clear commands arrive in T2.7. Until then the database is new for each run.
  if (!existsSync(resolve(ROOT, "backend", "app", "cli.py"))) return;
  const result = spawnSync(
    "uv",
    ["run", "--no-sync", "--directory", "backend", "python", "-m", "app.cli", mode, "--yes"],
    {
      cwd: ROOT,
      env: process.env,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Resetting the test database failed: ${result.stderr || result.error?.message}`);
  }
}

export const test = base.extend<{ guards: void }>({
  guards: [
    async ({ page }, use) => {
      resetDatabase();
      await page.clock.setFixedTime(FIXED_NOW);

      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`Console error: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`));
      await page.route(
        (url) => !LOCAL_HOSTS.has(url.hostname) && url.protocol !== "data:" && url.protocol !== "blob:",
        async (route) => {
          problems.push(`Request outside this computer: ${route.request().url()}`);
          await route.abort();
        },
      );

      await use();

      expect(problems, "V-E00: no console errors and no requests outside localhost").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
