// V-E03: the contact round, the status filter with counts, and adding an organization from the
// contact form's picker without leaving it (AC2, AC3, R11, R32, R44, R45, WF-3).
import { expect, test } from "./fixtures";

test("R44 the status filter shows each status with its count", async ({ page }) => {
  await page.goto("/contacts");
  const main = page.getByRole("main");
  const filter = main.getByRole("group", { name: "Status" });
  await expect(filter.getByRole("button", { name: /^All 40$/ })).toHaveAttribute("aria-pressed", "true");

  for (const status of ["Lead", "Qualified", "Customer"]) {
    const button = filter.getByRole("button", { name: new RegExp(`^${status} \\d+$`) });
    const count = Number((await button.textContent())?.replace(/\D/g, ""));
    expect(count).toBeGreaterThan(0);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(main.getByText(`Showing 1–${Math.min(count, 25)} of ${count}`)).toBeVisible();
    const badges = main.locator("tbody .badge");
    await expect(badges.first()).toHaveText(status);
    expect(new Set(await badges.allTextContents())).toEqual(new Set([status]));
  }
  await filter.getByRole("button", { name: /^All/ }).click();
  await expect(main.getByText("Showing 1–25 of 40")).toBeVisible();
});

test("WF-3 R45 adds a lead with a new organization made from the picker", async ({ page }) => {
  await page.goto("/contacts");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Add contact" }).click();
  const panel = page.getByRole("dialog", { name: "Add contact" });

  // R11: an organization is required, for a lead too.
  await panel.getByLabel("Name").fill("Nell Haverford");
  await panel.getByRole("button", { name: "Add contact" }).click();
  await expect(panel.getByText("Choose an organization.")).toBeVisible();

  await panel.getByLabel("Organization").selectOption({ label: "+ Add organization" });
  const orgPanel = page.getByRole("dialog", { name: "Add organization" });
  await orgPanel.getByLabel("Name").fill("Quill and Ink Press");
  await orgPanel.getByRole("button", { name: "Add organization" }).click();
  await expect(orgPanel).toBeHidden();

  // Back in the contact form, with the new organization chosen and the name still typed.
  await expect(panel.getByLabel("Organization").locator("option:checked")).toHaveText("Quill and Ink Press");
  await expect(panel.getByLabel("Name")).toHaveValue("Nell Haverford");
  await expect(panel.getByLabel("Status")).toHaveValue("lead");
  await panel.getByLabel("Email").fill("nell@quill.example");
  await panel.getByRole("button", { name: "Add contact" }).click();
  await expect(panel).toBeHidden();

  await main.getByRole("searchbox", { name: "Search contacts" }).fill("haverford");
  const row = main.getByRole("row", { name: /Nell Haverford/ });
  await expect(row).toContainText("Quill and Ink Press");
  await expect(row).toContainText("Lead");

  // The contact is on the organization's page.
  await row.getByRole("link", { name: "Quill and Ink Press" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quill and Ink Press");
  await expect(page.getByRole("list", { name: "Contacts" })).toContainText("Nell Haverford");
});

test("AC2 R32 edits a contact, then deletes it with the server's counts", async ({ page }) => {
  await page.goto("/contacts");
  const main = page.getByRole("main");
  await main.getByRole("searchbox", { name: "Search contacts" }).fill("Priya Raman");
  await main
    .getByRole("row", { name: /Priya Raman/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit contact" });
  await edit.getByLabel("Job title").fill("Chief Operating Officer");
  await edit.getByLabel("Phone").fill("phone me");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByText("Use only digits, spaces and + ( ) - . in a phone number.")).toBeVisible();
  await edit.getByLabel("Phone").fill("+44 161 555 0100");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(main.getByRole("row", { name: /Priya Raman/ })).toContainText("Chief Operating Officer");

  await main
    .getByRole("row", { name: /Priya Raman/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete Priya Raman?" });
  await expect(dialog).toContainText(
    /Their \d+ deals? will be kept, with no main contact\. Their \d+ activit(y|ies) will be deleted\./,
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(main.getByText("No matches for ‘Priya Raman’")).toBeVisible();
});
