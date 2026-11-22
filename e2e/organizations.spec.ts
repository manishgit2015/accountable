// V-E02: add, search, sort, edit and delete organizations; the delete warns with the server's counts,
// and the linked contacts and deals then show "None" (AC2, R30, R31, R34, R40–R43, WF-8).
import { expect, test } from "./fixtures";

test("AC2 R40–R43 adds, searches, sorts and edits an organization", async ({ page }) => {
  await page.goto("/organizations");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Add organization" }).click();
  const panel = page.getByRole("dialog", { name: "Add organization" });
  await panel.getByRole("button", { name: "Add organization" }).click();
  await expect(panel.getByText("Enter a name.")).toBeVisible(); // R45
  await panel.getByLabel("Name").fill("Zephyr Test Works");
  await panel.getByLabel("Website").fill("zephyr.example");
  await panel.getByLabel("Industry").fill("Testing");
  await panel.getByRole("button", { name: "Add organization" }).click();
  await expect(panel).toBeHidden();
  await expect(main.getByText("Showing 1–13 of 13")).toBeVisible();

  // R40: search matches any text column, ignoring case.
  await main.getByRole("searchbox", { name: "Search organizations" }).fill("ZEPHYR");
  const row = main.getByRole("row", { name: /Zephyr Test Works/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link", { name: "zephyr.example" })).toHaveAttribute("href", "https://zephyr.example");
  await expect(main.getByText("Showing 1–1 of 1")).toBeVisible();
  await main.getByRole("searchbox").fill("no such thing");
  await expect(main.getByText("No matches for ‘no such thing’")).toBeVisible();
  await main.getByRole("button", { name: "Clear search" }).click();

  // R41: sort by a heading, then reverse.
  const nameHeader = main.getByRole("columnheader", { name: "Name" });
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(main.getByRole("row").nth(1)).toContainText("Atlas Fabrication");
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(main.getByRole("row").nth(1)).toContainText("Zephyr Test Works");

  // R42: Edit from the row menu.
  await main
    .getByRole("row", { name: /Zephyr Test Works/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await expect(edit.getByLabel("Website")).toHaveValue("https://zephyr.example");
  await edit.getByLabel("Industry").fill("Quality assurance");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(main.getByRole("row", { name: /Zephyr Test Works/ })).toContainText("Quality assurance");

  // R42: clicking a row opens its page.
  await main
    .getByRole("row", { name: /Zephyr Test Works/ })
    .getByText("Quality assurance")
    .click();
  await expect(page).toHaveURL(/\/organizations\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zephyr Test Works");
});

test("R30 R31 R34 deleting an organization warns with counts and keeps its contacts and deals", async ({ page }) => {
  await page.goto("/organizations");
  const main = page.getByRole("main");
  await main
    .getByRole("row", { name: /Northwind Logistics/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Delete Northwind Logistics?" });
  await expect(dialog).toContainText("Its 3 contacts and 5 deals will be kept, with no organization.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(main.getByRole("row", { name: /Northwind Logistics/ })).toBeVisible(); // nothing deleted

  await main
    .getByRole("row", { name: /Northwind Logistics/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(main.getByRole("row", { name: /Northwind Logistics/ })).toHaveCount(0);
  await expect(main.getByText("Showing 1–11 of 11")).toBeVisible();

  // R34: the links show "None".
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("Priya Raman");
  await expect(page.getByRole("row", { name: /Priya Raman/ })).toContainText("None");
  await page.getByRole("link", { name: "Deals", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search deals" }).fill("Fleet telematics");
  await expect(page.getByRole("row", { name: /Fleet telematics pilot/ })).toContainText("None");
});
