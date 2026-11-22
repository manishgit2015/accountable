// V-E11 (T4.4): add, edit, delete and drag with the keyboard only, with focus visible at every stop
// (NFR-7, R66). No mouse is used in these tests: only Tab, Shift+Tab, Enter, Space, the arrows, Escape and typing.
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

interface Focused {
  description: string;
  visible: boolean;
}

/** What has focus, and whether it shows a focus indicator (an outline or the focus-ring shadow). */
async function focused(page: Page): Promise<Focused> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { description: "(nothing)", visible: false };
    const label =
      el.getAttribute("aria-label") ||
      (el as HTMLInputElement).labels?.[0]?.textContent ||
      el.textContent ||
      el.getAttribute("placeholder") ||
      "";
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
    // A field shows its ring on its wrapper (the search box) in a few places.
    const wrapper = el.closest(".search");
    const wrapperShadow = !!wrapper && getComputedStyle(wrapper).boxShadow !== "none";
    return {
      description: `${el.tagName.toLowerCase()} "${label.trim().replace(/\s+/g, " ").slice(0, 60)}"`,
      visible: outline || shadow || wrapperShadow,
    };
  });
}

/**
 * Press Tab until the focused element's description matches `target`, checking every stop on the way
 * shows its focus. Fails if it takes more than `limit` presses.
 */
async function tabTo(page: Page, target: RegExp, { limit = 80, back = false } = {}): Promise<void> {
  const unseen: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const now = await focused(page);
    if (!now.visible) unseen.push(now.description);
    if (target.test(now.description)) {
      expect(unseen, "NFR-7: focus is visible at every stop").toEqual([]);
      return;
    }
  }
  throw new Error(`Didn't reach ${target} in ${limit} presses of Tab`);
}

async function expectFocusVisible(page: Page): Promise<void> {
  const now = await focused(page);
  expect(now.visible, `NFR-7: focus is visible on ${now.description}`).toBe(true);
}

test("NFR-7 an organization is added, edited and deleted with the keyboard only", async ({ page }) => {
  await page.goto("/organizations");
  const main = page.getByRole("main");
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();

  // Add.
  await tabTo(page, /^button "Add organization"$/);
  await page.keyboard.press("Enter");
  const add = page.getByRole("dialog", { name: "Add organization" });
  await expect(add).toBeVisible();
  await tabTo(page, /^input "Name"$/);
  await page.keyboard.type("Keyboard Only Ltd");
  await tabTo(page, /^input "Industry"$/);
  await page.keyboard.type("Accessibility");
  await page.keyboard.press("Enter"); // submits the form
  await expect(add).toBeHidden();
  await expect(main.getByRole("row", { name: /Keyboard Only Ltd/ })).toContainText("Accessibility");

  // Find it with the search box.
  await tabTo(page, /Search organizations/, { back: true });
  await page.keyboard.type("Keyboard Only");
  await expect(main.getByText("Showing 1–1 of 1")).toBeVisible();

  // Edit, from the row's menu: Enter opens it, the arrows move, Enter picks.
  await tabTo(page, /^button "Row actions"$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await expectFocusVisible(page);
  await page.keyboard.press("Enter");
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await expect(edit).toBeVisible();
  await tabTo(page, /^input "Industry"$/);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Inclusive design");
  await page.keyboard.press("Enter");
  await expect(edit).toBeHidden();
  await expect(main.getByRole("row", { name: /Keyboard Only Ltd/ })).toContainText("Inclusive design");

  // Escape closes a panel without saving.
  await tabTo(page, /^button "Row actions"$/);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(edit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();

  // Delete: the menu's Delete item, then the dialog's Delete button.
  await tabTo(page, /^button "Row actions"$/);
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await expectFocusVisible(page);
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("alertdialog", { name: "Delete Keyboard Only Ltd?" });
  await expect(confirm).toBeVisible();
  await tabTo(page, /^button "Delete"$/, { limit: 10 });
  await page.keyboard.press("Enter");
  await expect(confirm).toBeHidden();
  await expect(main.getByText("No matches for ‘Keyboard Only’")).toBeVisible();
});

test("NFR-7 a deal is added from the top bar with the keyboard only", async ({ page }) => {
  await page.goto("/deals");
  const main = page.getByRole("main");
  await expect(main.getByText("Showing 1–25 of 45")).toBeVisible();

  await tabTo(page, /^button "Add deal"$/);
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Add deal" });
  await expect(panel).toBeVisible();
  await tabTo(page, /^input "Name"$/);
  await page.keyboard.type("Keyboard kiosk");
  // Native selects: typing picks the matching option without opening the list.
  await tabTo(page, /^select "Organization/);
  await page.keyboard.type("Northwind");
  await expect(panel.getByLabel("Organization")).toHaveValue(/\d+/);
  await tabTo(page, /^select "Main contact/);
  await page.keyboard.type("Priya");
  await expect(panel.getByLabel("Main contact")).not.toHaveValue("");
  await tabTo(page, /^select "Stage/);
  await page.keyboard.type("Proposal");
  await expect(panel.getByLabel("Stage")).toHaveValue("proposal");
  await expect(panel.getByLabel("Probability (%)")).toHaveValue("40"); // R15 prefill
  await tabTo(page, /^input "Value \(USD\)"$/);
  await page.keyboard.type("15000");
  await tabTo(page, /^input "Close date"$/);
  // Chrome orders a date field's parts by the computer's region (dd/mm or mm/dd), so the date reads
  // the same either way.
  await page.keyboard.type("12122026");
  await expect(panel.getByLabel("Close date")).toHaveValue("2026-12-12");
  await tabTo(page, /^button "Add deal"$/, { limit: 10 });
  await page.keyboard.press("Enter");
  await expect(panel).toBeHidden();

  // A new deal opens on its own page.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Keyboard kiosk");
  const details = page.getByRole("main");
  await expect(details.getByRole("link", { name: "Northwind Logistics" })).toBeVisible();
  await expect(details.getByRole("combobox", { name: "Stage" })).toHaveValue("proposal");
  await expect(details).toContainText("$15,000");
  await expect(details).toContainText("40%");
});

test("R66 NFR-7 a pipeline card is reached with Tab, moved with Space and the arrows, and opened with Enter", async ({
  page,
}) => {
  await page.goto("/pipeline");
  const board = page.getByRole("main");
  const column = (stage: string) => board.getByRole("region", { name: `${stage} column` });
  await expect(column("New").getByRole("button", { name: /^Website rebuild,/ })).toBeVisible();

  await tabTo(page, /Website rebuild, .*Press Space to move it/, { limit: 120 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(100); // dnd-kit starts listening for the arrows a moment after Space lifts the card
  await page.keyboard.press("ArrowRight");
  await expect(column("Qualified").locator(".drop")).toBeVisible(); // the drop gap follows each key
  await page.keyboard.press("ArrowRight");
  await expect(column("Proposal").locator(".drop")).toBeVisible();
  await page.keyboard.press("Space");
  const moved = column("Proposal").getByRole("button", { name: /^Website rebuild,/ });
  await expect(moved).toBeVisible();
  await expect(moved).toContainText("40%");

  // The card keeps focus after the drop, so Enter opens it straight away.
  await page.waitForTimeout(100); // dnd-kit ignores activation for 50 ms after a drop
  await expect(moved).toBeFocused();
  await expectFocusVisible(page);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Website rebuild");
  await expect(page.getByRole("main")).toContainText("Proposal");
});
