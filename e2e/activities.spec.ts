// V-E08: log each activity type with a follow-up, see them on the deal's and contact's timelines and
// on the dashboard until they're done; edit and delete them (AC5, R53, R55, R76, WF-5).
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

async function openDeal(page: Page, name: string) {
  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search deals" }).fill(name);
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByText(name)
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
}

async function logActivity(page: Page, type: string, description: string, followUp: string) {
  const form = page.getByRole("form", { name: "Log activity" });
  await form.getByLabel("Type").selectOption(type);
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Follow-up date (optional)").fill(followUp);
  await form.getByRole("button", { name: "Log activity" }).click();
  await expect(form.getByLabel("Description")).toHaveValue(""); // cleared once saved
}

test("AC5 R53 R76 logs a call, an email and a note with follow-ups, shown until done", async ({ page }) => {
  await openDeal(page, "Fleet telematics pilot");
  const form = page.getByRole("form", { name: "Log activity" });
  // R13: "when it happened" defaults to now.
  await expect(form.getByLabel("When it happened")).toHaveValue("2026-11-21T14:30");
  await logActivity(page, "call", "Called about the pilot scope", "2026-11-22");
  await logActivity(page, "email", "Sent the pilot terms", "2026-11-25");
  await logActivity(page, "note", "Wants a second quote first", "2026-11-19"); // in the past: overdue

  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline.getByRole("listitem").first()).toContainText("Wants a second quote first");
  for (const [text, type] of [
    ["Called about the pilot scope", "call"],
    ["Sent the pilot terms", "email"],
    ["Wants a second quote first", "note"],
  ]) {
    const entry = timeline.getByRole("listitem").filter({ hasText: text });
    await expect(entry.getByLabel(type, { exact: true })).toBeVisible();
    await expect(entry).toContainText("Today, 14:30");
  }
  await expect(timeline.getByRole("listitem").filter({ hasText: "Called about" })).toContainText("Follow up 22 Nov");

  // The deal's activities show on its main contact's timeline too (R51).
  await page.getByRole("link", { name: "Priya Raman" }).click();
  const contactTimeline = page.getByRole("list", { name: "Timeline" });
  await expect(contactTimeline.getByText("Sent the pilot terms")).toBeVisible();
  await expect(
    contactTimeline
      .getByRole("listitem")
      .filter({ hasText: "Sent the pilot terms" })
      .getByRole("link", { name: "Fleet telematics pilot" }),
  ).toBeVisible();

  // R76: on the dashboard in the right groups.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const overdue = page.getByRole("region", { name: "Overdue" });
  const week = page.getByRole("region", { name: "Next 7 days" });
  await expect(overdue.getByText("Wants a second quote first")).toBeVisible();
  await expect(week.getByText("Called about the pilot scope")).toBeVisible();
  await expect(week.getByText("Sent the pilot terms")).toBeVisible();

  // Ticking one removes it at once, and it stays done after a reload.
  await week.getByRole("checkbox", { name: "Mark done: Called about the pilot scope" }).click();
  await expect(week.getByText("Called about the pilot scope")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Next 7 days" }).getByText("Sent the pilot terms")).toBeVisible();
  // Gone from every follow-up group. (It still shows under Recent activity, which lists what happened, R75.)
  for (const group of ["Overdue", "Today", "Next 7 days"]) {
    await expect(page.getByRole("region", { name: group }).getByText("Called about the pilot scope")).toHaveCount(0);
  }

  // On the timeline it shows as done, and unticking makes it open again (spec 4.3).
  await openDeal(page, "Fleet telematics pilot");
  const done = page.getByRole("list", { name: "Timeline" }).getByRole("listitem").filter({ hasText: "Called about" });
  await expect(done.getByRole("checkbox")).toBeChecked();
  await expect(done).toContainText("Done");
  await done.getByRole("checkbox").uncheck();
  await expect(done.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Next 7 days" }).getByText("Called about the pilot scope"),
  ).toBeVisible();
});

test("WF-5 logs a call on a contact's page and finishes it from the dashboard", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("Owen Fletcher");
  await page
    .getByRole("row", { name: /Owen Fletcher/ })
    .getByText("Owen Fletcher")
    .click();
  await logActivity(page, "call", "Asked about fleet size", "2026-11-22");
  await expect(page.getByRole("list", { name: "Timeline" }).getByText("Asked about fleet size")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const week = page.getByRole("region", { name: "Next 7 days" });
  await expect(week.getByRole("link", { name: "Owen Fletcher" })).toBeVisible();
  await week.getByRole("checkbox", { name: "Mark done: Asked about fleet size" }).click();
  await expect(week.getByText("Asked about fleet size")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Next 7 days" }).getByText("Asked about fleet size")).toHaveCount(0);
});

test("R55 edits and deletes an activity from the timeline", async ({ page }) => {
  await openDeal(page, "Fleet telematics pilot");
  await logActivity(page, "note", "Draft note", "");
  const timeline = page.getByRole("list", { name: "Timeline" });
  const entry = timeline.getByRole("listitem").filter({ hasText: "Draft note" });
  await entry.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit activity" });
  await edit.getByLabel("Description").fill("Final note");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(timeline.getByText("Final note")).toBeVisible();

  await timeline
    .getByRole("listitem")
    .filter({ hasText: "Final note" })
    .getByRole("button", { name: "Delete" })
    .click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this activity?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(timeline.getByText("Final note")).toBeVisible();
  await timeline
    .getByRole("listitem")
    .filter({ hasText: "Final note" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(timeline.getByText("Final note")).toHaveCount(0);
});
