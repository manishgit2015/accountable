// V-E09 (T4.3): `clear --yes` empties every screen, which still works; `seed --yes` brings the sample data
// back. Both run while the app is running (AC2, R4, R78, REL-10). The commands are the app's own CLI
// (`npm run clear` / `npm run seed` run the same module), against the test database.
import { expect, resetDatabase, test } from "./fixtures";

test("AC2 R4 R78 REL-10 after clear every screen is empty but works, and seed brings the sample data back", async ({
  page,
}) => {
  const main = page.getByRole("main");
  const tabs = page.getByRole("navigation", { name: "Sections" });

  // The app is open on the sample data when the command runs.
  await page.goto("/organizations");
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();
  resetDatabase("clear");

  // The open tab shows the change on its next refetch: here, moving to another section and back.
  await tabs.getByRole("link", { name: "Dashboard" }).click();
  for (const empty of [
    "No deals won in the last 12 months",
    "No deals created in the last 12 months",
    "No deals closed in the last 12 months",
    "No open deals",
    "No follow-ups due",
    "No activity yet",
  ]) {
    await expect(main.getByText(empty), empty).toBeVisible();
  }

  await tabs.getByRole("link", { name: "Pipeline" }).click();
  for (const stage of ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]) {
    const column = main.getByRole("region", { name: `${stage} column` });
    await expect(column.getByLabel("0 deals")).toBeVisible();
  }
  await expect(main.getByTestId("open-pipeline")).toHaveText("$0");

  for (const [section, noun, add] of [
    ["Deals", "deals", "Add deal"],
    ["Contacts", "contacts", "Add contact"],
    ["Organizations", "organizations", "Add organization"],
  ]) {
    await tabs.getByRole("link", { name: section }).click();
    await expect(main.getByText(`No ${noun} yet`)).toBeVisible();
    // The page's own button and the empty state's.
    await expect(main.getByRole("button", { name: add })).toHaveCount(2);
  }

  // Empty but working: the first record can be added straight away, from the empty state's button.
  await main.getByRole("button", { name: "Add organization" }).last().click();
  const panel = page.getByRole("dialog", { name: "Add organization" });
  await panel.getByLabel("Name").fill("First Customer Co");
  await panel.getByRole("button", { name: "Add organization" }).click();
  await expect(panel).toBeHidden();
  await expect(main.getByText("Showing 1–1 of 1")).toBeVisible();

  // seed --yes replaces everything with the sample data again.
  resetDatabase("seed");
  await page.reload();
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();
  await expect(main.getByRole("row", { name: /First Customer Co/ })).toHaveCount(0);
  await expect(main.getByRole("row", { name: /Northwind Logistics/ })).toBeVisible();

  await tabs.getByRole("link", { name: "Deals" }).click();
  await expect(main.getByText("Showing 1–25 of 45")).toBeVisible();
  await tabs.getByRole("link", { name: "Contacts" }).click();
  await expect(main.getByText("Showing 1–25 of 40")).toBeVisible();
  await tabs.getByRole("link", { name: "Dashboard" }).click();
  await expect(main.getByText("No open deals")).toHaveCount(0);
  await expect(main.getByText("No activity yet")).toHaveCount(0);
});
