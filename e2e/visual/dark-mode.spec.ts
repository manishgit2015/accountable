// V-M04 and R94 for the mvp-darkmode change (docs/changes/mvp-darkmode/plan.md, section 4.3).
// Light mode must look exactly as it did before dark mode, apart from the toggle. T0 took these baselines
// on the code before any change (`node scripts/run-tests.mjs visual dark-mode --update-snapshots`), and
// every later run compares light mode with them. The top bar's right-hand group was masked in the
// baselines, because the toggle goes there (T3). The comparison hides the toggle first, so that group has
// the same box as before and the mask covers exactly the same pixels: anything else that changed still
// fails. The toggle's own look is checked in the screenshots in both modes, and by eye.
// mvp-multiuser (R94): the toggle became the user menu button, at the end of the same group. The comparison
// hides it instead, so the group still holds only "Add deal", as in the baselines, and the mask is unchanged.
// The product owner also approved one more light-mode change: a focused secondary button now shows the focus
// ring (spec 3.9; the baselines show the delete dialog's Cancel, which the dialog focuses, without it). The
// comparison puts back the old unfocused look on that one rule; V-E11 checks the ring itself.
// The baselines are in docs/changes/mvp-darkmode/baseline/ (snapshotPathTemplate in playwright.config.ts).
// Run with `node scripts/run-tests.mjs visual dark-mode`. Not part of `npm test`.
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";

test.use({ viewport: { width: 1440, height: 900 } });

function baseline(name: string): string[] {
  return ["mvp-darkmode", "baseline", `${name}.png`];
}

async function expectLightUnchanged(page: Page, name: string, fullPage = true): Promise<void> {
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.addStyleTag({
    content:
      ".user-button { display: none !important; } .btn-secondary:focus-visible { box-shadow: var(--shadow) !important; }",
  });
  // threshold 0: any change in any pixel's color fails, not only a visible one (Playwright's default is 0.2).
  await expect(page).toHaveScreenshot(baseline(name), {
    fullPage,
    mask: [page.locator(".topbar-right")],
    threshold: 0,
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

// Intent success criterion 3 (plan phase 7): the dashboard and the pipeline, full page at 1440px, in both
// modes, for the product owner's review. The toggle is in view here. The approved copies in
// docs/changes/mvp-darkmode/ are replaced only when asked, with ACCOUNTABLE_SCREENSHOTS=1 (spec DEP-2); otherwise
// the screenshots go to Playwright's output folder, so a routine run never changes the approved evidence.
const CHANGE_DIR = fileURLToPath(new URL("../../docs/changes/mvp-darkmode/", import.meta.url));
const replaceApproved = process.env.ACCOUNTABLE_SCREENSHOTS === "1";
const shotPath = (name: string) => (replaceApproved ? `${CHANGE_DIR}${name}` : test.info().outputPath(name));

for (const mode of ["light", "dark"] as const) {
  test(`V-M04 dashboard and pipeline in ${mode} mode`, async ({ page }) => {
    await page.goto("/");
    if (mode === "dark") {
      await page.getByRole("button", { name: /^Account menu, / }).click();
      await page.getByRole("menuitemradio", { name: "Dark" }).click();
      await page.keyboard.press("Escape");
    }
    await expect(page.getByText("Recent activity")).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: shotPath(`dashboard-${mode}.png`),
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/pipeline");
    await expect(page.getByText(/Closed in/).first()).toBeVisible();
    await page.screenshot({
      path: shotPath(`pipeline-${mode}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
