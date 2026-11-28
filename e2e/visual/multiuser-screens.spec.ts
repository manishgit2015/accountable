// V-M04 for mvp-multiuser: every screen in light and dark mode at 1440px, including the sign-in screen and the
// user menu, which mockup 1 doesn't show, and the top bar with the menu open at 1024px and 1280px. Not a
// pass/fail pixel test: each page is checked to have loaded, with no console error (V-E00), before its picture.
// The pictures go to docs/evidence/2026-11-28-mvp-multiuser/, to compare by eye with the brand and spec 3.9.
// Run with `node scripts/run-tests.mjs visual multiuser-screens`. Not part of `npm test`. Test data only.
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { PRIYA } from "../signIn";

const OUT = fileURLToPath(new URL("../../docs/evidence/2026-11-28-mvp-multiuser/", import.meta.url));
const MODES = ["light", "dark"] as const;

test.use({ viewport: { width: 1440, height: 900 } });

async function setMode(page: Page, mode: (typeof MODES)[number]) {
  await page.evaluate((m) => window.localStorage.setItem("accountable.theme", m), mode);
  await page.reload();
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage, animations: "disabled" });
}

test.describe("signed out", () => {
  test.use({ signedInAs: null });

  for (const mode of MODES) {
    test(`V-M04 the sign-in screen in ${mode} mode, empty and with wrong details`, async ({ page, guards }) => {
      guards.allowConsoleError(/status of 401/);
      await page.goto("/");
      await setMode(page, mode);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await shot(page, `sign-in-${mode}`);
      await page.getByLabel("Email").fill(PRIYA);
      await page.getByLabel("Password").fill("not-the-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await shot(page, `sign-in-wrong-${mode}`);
    });
  }
});

const PAGES: [string, string, (page: Page) => Promise<void>][] = [
  ["dashboard", "/", async (page) => void (await expect(page.getByText("Recent activity")).toBeVisible())],
  ["pipeline", "/pipeline", async (page) => void (await expect(page.getByText(/Closed in/).first()).toBeVisible())],
  ["deals", "/deals", async (page) => void (await expect(page.getByText(/Showing 1–25 of/)).toBeVisible())],
  ["contacts", "/contacts", async (page) => void (await expect(page.getByText(/Showing 1–25 of/)).toBeVisible())],
  ["organizations", "/organizations", async (page) => void (await expect(page.getByRole("row").nth(1)).toBeVisible())],
];

for (const mode of MODES) {
  test(`V-M04 every section and a record page of each kind in ${mode} mode`, async ({ page, request }) => {
    await page.goto("/");
    await setMode(page, mode);
    for (const [name, path, ready] of PAGES) {
      await page.goto(path);
      await ready(page);
      if (name === "dashboard") await page.waitForTimeout(1500); // Recharts' entry animation
      await shot(page, `${name}-${mode}`);
    }
    for (const kind of ["deals", "contacts", "organizations"]) {
      const records = (await (await request.get(`/api/${kind}`)).json()) as { id: number }[];
      await page.goto(`/${kind}/${records[0].id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForTimeout(300);
      await shot(page, `${kind.slice(0, -1)}-page-${mode}`);
    }
  });

  test(`V-M04 the user menu, open, in ${mode} mode at 1440, 1280 and 1024px`, async ({ page }) => {
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/deals");
      await setMode(page, mode);
      await expect(page.getByText(/Showing 1–25 of/)).toBeVisible();
      await page.getByRole("button", { name: "Account menu, Priya Shah" }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      // No sideways scroll at any width (R5).
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${OUT}user-menu-${mode}-${width}.png`, clip: { x: 0, y: 0, width, height: 420 } });
    }
  });
}
