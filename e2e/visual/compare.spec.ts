// V-M04 (T5.2): full-page screenshots of the dashboard and pipeline at 1440px, for comparing by eye with
// mockup 1 (docs/mockups/1-spec-reference/dashboard.png and pipeline.png). Not a pass/fail pixel test:
// it only checks each page has loaded, with no console error (V-E00), before taking the picture.
// Run with `node scripts/run-tests.mjs visual`. Not part of `npm test`.
import { fileURLToPath } from "node:url";

import { expect, test } from "../fixtures";

const OUT = fileURLToPath(new URL("../../docs/evidence/2026-11-22-visual/", import.meta.url));

test.use({ viewport: { width: 1440, height: 900 } });

test("V-M04 dashboard at 1440px", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
  // Let Recharts finish its entry animation.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}dashboard.png`, fullPage: true });
});

test("V-M04 pipeline at 1440px", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
  await expect(page.getByText(/Closed in/).first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}pipeline.png`, fullPage: true });
});
