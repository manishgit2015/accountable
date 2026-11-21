// Smoke test: the app opens with its top bar and reaches the API through the proxy (R1).
// Replaced by start.spec.ts in T3.8.
import { expect, test } from "./fixtures";

test("R1 the app opens on the dashboard with the top bar and reaches the API", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Sections" }).getByRole("link");
  await expect(tabs).toHaveText(["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"]);
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByTestId("api-status")).toHaveText("Connected to Accountable 0.1.0");

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pipeline");
  await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toHaveClass(/active/);
});
