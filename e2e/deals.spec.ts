// V-E04: the deal round, late deals standing out, and the probability filled in from the stage
// (AC2, AC4, R12, R15, R19, R23, R44, R45).
import { expect, test } from "./fixtures";

test("R19 R44 late deals show a Raspberry Late badge and date", async ({ page }) => {
  await page.goto("/deals");
  const main = page.getByRole("main");
  await main.getByRole("searchbox", { name: "Search deals" }).fill("Clinic scheduling");
  const row = main.getByRole("row", { name: /Clinic scheduling suite/ });
  await expect(row.locator(".badge-late")).toHaveText("Late");
  await expect(row.locator(".late-text")).toHaveCSS("color", "rgb(209, 46, 87)"); // --raspberry-text
  // A deal that isn't late has neither.
  await main.getByRole("searchbox").fill("Fleet telematics");
  await expect(main.getByRole("row", { name: /Fleet telematics pilot/ }).locator(".badge-late")).toHaveCount(0);
});

test("R47 R41 sorts by close date by default, and by value on a click", async ({ page }) => {
  await page.goto("/deals");
  const main = page.getByRole("main");
  await expect(main.getByRole("columnheader", { name: "Close date" })).toHaveAttribute("aria-sort", "ascending");
  await main.getByRole("columnheader", { name: "Value (USD)" }).getByRole("button").click();
  const values = await main.locator("tbody tr td:nth-child(5)").allTextContents();
  const numbers = values.map((v) => Number(v.replace(/\D/g, "")));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
});

test("AC4 R15 R23 adds a deal: probability from the stage, contacts filtered by organization", async ({ page }) => {
  await page.goto("/deals");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Add deal" }).click();
  const panel = page.getByRole("dialog", { name: "Add deal" });

  await panel.getByLabel("Name").fill("Depot scanners");
  await expect(panel.getByLabel("Probability (%)")).toHaveValue("5");
  await panel.getByLabel("Stage").selectOption("proposal");
  await expect(panel.getByLabel("Probability (%)")).toHaveValue("40");

  await panel.getByLabel("Organization").selectOption({ label: "Northwind Logistics" });
  const contacts = await panel.getByLabel("Main contact").locator("option").allTextContents();
  expect(contacts).toEqual(["Choose a contact", "Owen Fletcher", "Priya Raman", "Sasha Kim", "+ Add contact"]);
  await panel.getByLabel("Main contact").selectOption({ label: "Owen Fletcher" });
  await panel.getByLabel("Value (USD)").fill("24000");
  await panel.getByLabel("Close date").fill("2027-01-15");
  await panel.getByLabel("Probability (%)").fill("45"); // overridden before saving (R15)
  await panel.getByRole("button", { name: "Add deal" }).click();
  await expect(panel).toBeHidden();

  await main.getByRole("searchbox", { name: "Search deals" }).fill("Depot scanners");
  const row = main.getByRole("row", { name: /Depot scanners/ });
  await expect(row).toContainText("Northwind Logistics");
  await expect(row).toContainText("Owen Fletcher");
  await expect(row).toContainText("Proposal");
  await expect(row).toContainText("$24,000");
  await expect(row).toContainText("45%");
  await expect(row).toContainText("$10,800");
  await expect(row).toContainText("15 Jan 2027");
});

test("AC2 R23 edits a deal and refuses a contact from another organization", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 422/); // the refused save, on purpose
  await page.goto("/deals");
  const main = page.getByRole("main");
  await main.getByRole("searchbox", { name: "Search deals" }).fill("Fleet telematics");
  await main
    .getByRole("row", { name: /Fleet telematics pilot/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit deal" });
  // Spec 4.5: another organization no longer matches the main contact, so the server refuses it.
  await edit.getByLabel("Organization").selectOption({ label: "Bramble & Oak" });
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByText("Choose a contact from Bramble & Oak.")).toBeVisible();
  await expect(edit.getByLabel("Name")).toHaveValue("Fleet telematics pilot"); // R48: the form stays open
  await edit.getByLabel("Organization").selectOption({ label: "Northwind Logistics" });
  await edit.getByLabel("Main contact").selectOption({ label: "Priya Raman" });
  await edit.getByLabel("Value (USD)").fill("21500");
  await edit.getByLabel("Stage").selectOption("qualified");
  await expect(edit.getByLabel("Probability (%)")).toHaveValue("20");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  const row = main.getByRole("row", { name: /Fleet telematics pilot/ });
  await expect(row).toContainText("$21,500");
  await expect(row).toContainText("Qualified");
  await expect(row).toContainText("20%");
});

test("AC2 R33 deletes a deal after warning about its activities and stage changes", async ({ page }) => {
  await page.goto("/deals");
  const main = page.getByRole("main");
  await main.getByRole("searchbox", { name: "Search deals" }).fill("Fleet telematics");
  await main
    .getByRole("row", { name: /Fleet telematics pilot/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete Fleet telematics pilot?" });
  await expect(dialog).toContainText(/Its \d+ activit(y|ies) and \d+ stage changes? will be deleted\./);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(main.getByText("No matches for ‘Fleet telematics’")).toBeVisible();
});
