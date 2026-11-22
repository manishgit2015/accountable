// Every end-to-end test imports `test` and `expect` from here, not from @playwright/test (V-E00).
// - The test database is reset before each test.
// - The test fails on any browser console error or uncaught page error (R7).
// - The test fails on any request that leaves 127.0.0.1 or localhost (R2, NFR-4).
// - The browser's clock is fixed, so "today" is the same in every run (spec 13.2).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * Saturday 21 November 2026, 14:30 local time: the same moment as the backend tests' clock, and the e2e
 * backend's clock too, which scripts/run-tests.mjs fixes with ACCOUNTABLE_FIXED_NOW (Phase 4 decision).
 */
export const FIXED_NOW = new Date(2026, 10, 21, 14, 30, 0);

const backendNow = process.env.ACCOUNTABLE_FIXED_NOW;
if (!backendNow || new Date(backendNow).getTime() !== FIXED_NOW.getTime()) {
  throw new Error(
    `The e2e backend's clock (ACCOUNTABLE_FIXED_NOW=${backendNow ?? "unset"}) must match FIXED_NOW. Run them with \`npm test\`.`,
  );
}

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

export interface Guards {
  /**
   * Accept console errors matching `pattern` in this test only. For a test that causes an error on
   * purpose (a missing record's 404, a stale board's 409, a mocked 500): Chrome logs each failed
   * request as "Failed to load resource". Every other console error still fails the test.
   */
  allowConsoleError: (pattern: RegExp) => void;
}

export const test = base.extend<{ guards: Guards }>({
  guards: [
    async ({ page }, use) => {
      const allowed: RegExp[] = [];
      resetDatabase();
      await page.clock.setFixedTime(FIXED_NOW);

      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (allowed.some((pattern) => pattern.test(text))) return;
        problems.push(`Console error: ${text}`);
      });
      page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`));
      await page.route(
        (url) => !LOCAL_HOSTS.has(url.hostname) && url.protocol !== "data:" && url.protocol !== "blob:",
        async (route) => {
          problems.push(`Request outside this computer: ${route.request().url()}`);
          await route.abort();
        },
      );

      await use({ allowConsoleError: (pattern) => allowed.push(pattern) });

      expect(problems, "V-E00: no console errors and no requests outside localhost").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Drag `source` onto `target` with the mouse, in small steps so dnd-kit sees a real drag (RK-17).
 * `at` picks where on the target to let go: its top edge, middle or bottom edge.
 */
export async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  at: "top" | "middle" | "bottom" = "middle",
): Promise<void> {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("dragTo: an element isn't visible");
  const x = to.x + to.width / 2;
  const y = at === "top" ? to.y + 6 : at === "bottom" ? to.y + to.height - 6 : to.y + to.height / 2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(x, y, { steps: 20 });
  await page.mouse.move(x, y + 1, { steps: 3 });
  await page.mouse.up();
}
