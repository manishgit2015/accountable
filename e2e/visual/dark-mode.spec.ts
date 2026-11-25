// V-M04 and R94 for the dark-mode change (docs/changes/dark-mode/plan.md, section 4.3).
// Light mode must look exactly as it did before dark mode, apart from the toggle. T0 took these baselines
// on the code before any change (`node scripts/run-tests.mjs visual dark-mode --update-snapshots`), and
// every later run compares light mode with them. The top bar's right-hand group is masked, because the
// toggle goes there (T3). The baselines are in docs/changes/dark-mode/baseline/ (snapshotPathTemplate in
// playwright.config.ts). Run with `node scripts/run-tests.mjs visual dark-mode`. Not part of `npm test`.
import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";

test.use({ viewport: { width: 1440, height: 900 } });

function baseline(name: string): string[] {
  return ["dark-mode", "baseline", `${name}.png`];
}

async function expectLightUnchanged(page: Page, name: string, fullPage = true): Promise<void> {
  await expect(page).toHaveScreenshot(baseline(name), {
    fullPage,
    mask: [page.locator(".topbar-right")],
  });
}

test("R94 dashboard in light mode is unchanged", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expectLightUnchanged(page, "dashboard");
});

test("R94 pipeline in light mode is unchanged", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
  await expect(page.getByText(/Closed in/).first()).toBeVisible();
  await expectLightUnchanged(page, "pipeline");
});

test("R94 deals table in light mode is unchanged", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible();
  await expect(page.getByText(/Showing 1–25 of/)).toBeVisible();
  await expectLightUnchanged(page, "deals");
});

test("R94 deal page in light mode is unchanged", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("row").nth(1).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Created at/).first()).toBeVisible();
  await expectLightUnchanged(page, "deal-page");
});

test("R94 add deal side panel in light mode is unchanged", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByText(/Showing 1–25 of/)).toBeVisible();
  await page.locator(".topbar").getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("dialog", { name: "Add deal" })).toBeVisible();
  await expectLightUnchanged(page, "side-panel", false);
});

test("R94 delete dialog in light mode is unchanged", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("button", { name: "Row actions" }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toContainText(/will be deleted|will be kept|Delete/);
  await expectLightUnchanged(page, "delete-dialog", false);
});
