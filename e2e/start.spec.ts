// V-E01: the app lands on the dashboard with sample data, and every section shows it (AC1, R4, WF-1).
// Replaces smoke.spec.ts (T1.8).
import { expect, test } from "./fixtures";

test("AC1 R4 opens on the dashboard with sample data", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Sections" }).getByRole("link");
  await expect(tabs).toHaveText(["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"]);
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveClass(/active/);

  // Hero: the greeting at 14:30 (R79), the date and summary line, the four figures (R70).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Good afternoon");
  const hero = page.getByRole("region", { name: "Summary" });
  await expect(hero).toContainText("November 2026");
  await expect(hero).toContainText(/follow-ups? overdue|deals? running late|Nothing overdue/);
  await expect(page.getByTestId("figure-open")).toContainText(/\$\d/);
  await expect(page.getByTestId("figure-expected")).toContainText(/\$\d/);
  await expect(page.getByTestId("figure-won")).toContainText(/so far/);
  await expect(page.getByTestId("figure-win-rate")).toContainText(/\d+%/);

  // The charts and lists (R71–R76): the line, the funnel, the bars, the donut, follow-ups, recent.
  await expect(page.getByRole("img", { name: "Revenue won each month for the last 12 months" })).toBeVisible();
  await expect(page.locator(".hero-chart .recharts-area-curve")).toBeVisible();
  await expect(page.getByRole("list", { name: "Sales funnel" }).getByRole("listitem")).toHaveCount(5);
  await expect(
    page
      .getByRole("img", { name: /Deals won and lost/ })
      .locator(".recharts-bar-rectangle")
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Open value by stage/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Overdue" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Recent activity" }).getByRole("listitem")).toHaveCount(10);
});

test("AC1 every section shows the sample data", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pipeline");
  for (const stage of ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]) {
    await expect(page.getByRole("region", { name: `${stage} column` })).toBeVisible();
  }
  await expect(page.getByTestId("deal-card").first()).toBeVisible();
  await expect(page.getByTestId("open-pipeline")).toContainText(/\$\d/);

  await page.getByRole("link", { name: "Deals", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deals");
  await expect(page.getByText("Showing 1–25 of 45")).toBeVisible();

  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contacts");
  await expect(page.getByText("Showing 1–25 of 40")).toBeVisible();

  await page.getByRole("link", { name: "Organizations", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organizations");
  await expect(page.getByText("Showing 1–12 of 12")).toBeVisible();
});
