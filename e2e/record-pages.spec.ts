// V-E05: the links on each record page, the organization's combined timeline, and a record that
// doesn't exist (AC3, R50–R52, R54, R56).
import { expect, test } from "./fixtures";

test("AC3 R50–R52 the record pages link to each other", async ({ page }) => {
  await page.goto("/organizations");
  await page
    .getByRole("row", { name: /Northwind Logistics/ })
    .getByText("Logistics", { exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Northwind Logistics");
  await expect(page.getByRole("list", { name: "Contacts" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("list", { name: "Deals" }).getByRole("listitem")).toHaveCount(5);

  await page.getByRole("list", { name: "Contacts" }).getByRole("link", { name: "Priya Raman" }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Priya Raman");
  const deals = page.getByRole("list", { name: "Deals" });
  await expect(deals.getByRole("link", { name: "Fleet telematics pilot" })).toBeVisible();

  await deals.getByRole("link", { name: "Fleet telematics pilot" }).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fleet telematics pilot");
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("new");
  await expect(page.getByRole("link", { name: "Priya Raman" })).toBeVisible();
  await page.getByRole("link", { name: "Northwind Logistics" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Northwind Logistics");
});

test("R50 R54 the organization's timeline combines its contacts' and deals' entries", async ({ page }) => {
  await page.goto("/organizations");
  await page
    .getByRole("row", { name: /Northwind Logistics/ })
    .getByText("Logistics", { exact: true })
    .click();
  const timeline = page.getByRole("list", { name: "Timeline" });
  const entries = timeline.getByRole("listitem");
  await expect(entries.first()).toBeVisible();
  // Activities on a contact, and stage changes of its deals, each saying where they came from (R54).
  await expect(
    timeline.locator("[data-kind=activity]").getByRole("link", { name: "Priya Raman" }).first(),
  ).toBeVisible();
  await expect(timeline.locator("[data-kind=stage_change]").first()).toContainText(/Moved from|Created at/);
  await expect(timeline.locator("[data-kind=stage_change] a").first()).toHaveAttribute("href", /\/deals\/\d+/);
  // R55: stage changes can't be edited or deleted; activities can.
  await expect(timeline.locator("[data-kind=stage_change]").getByRole("button")).toHaveCount(0);
  await expect(timeline.locator("[data-kind=activity]").first().getByRole("button", { name: "Edit" })).toBeVisible();
});

test("R52 the deal page warns when a deal is late", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search deals" }).fill("Clinic scheduling");
  await page
    .getByRole("row", { name: /Clinic scheduling suite/ })
    .getByText("Clinic scheduling suite")
    .click();
  await expect(page.getByRole("status")).toContainText("This deal is running late");
});

test("R56 a record that doesn't exist says so, with a link back to the list", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 404/); // the missing records, on purpose
  for (const [path, noun, list] of [
    ["/organizations/99999", "organization", "organizations"],
    ["/contacts/99999", "contact", "contacts"],
    ["/deals/99999", "deal", "deals"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: `This ${noun} no longer exists` })).toBeVisible();
    await page.getByRole("link", { name: `Back to ${list}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${list}$`));
  }
});

test("R56 a record deleted while its page is open says so", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 404/);
  await page.goto("/organizations");
  await page
    .getByRole("row", { name: /Lumen Studio/ })
    .getByText("Creative services")
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lumen Studio");
  const id = page.url().split("/").pop();
  // Delete it as another tab would, then come back to the page.
  const response = await page.request.delete(`/api/organizations/${id}`, {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(204);
  await page.reload();
  await expect(page.getByRole("heading", { name: "This organization no longer exists" })).toBeVisible();
});

// Found in the V-M01 walkthrough (T5.4): deleting from a record's own page refetched that record, which
// answered 404 (a console error) and showed "no longer exists" instead of going back to the list.
test("R30 deleting from a record's page goes back to its list, with no 404", async ({ page }) => {
  for (const [list, name, noun] of [
    ["deals", "Brand refresh", "deals"],
    ["contacts", "Holly Turner", "contacts"],
    ["organizations", "Oakridge Dental Group", "organizations"],
  ] as const) {
    await page.goto(`/${list}`);
    await page.getByRole("searchbox").fill(name);
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByText(name, { exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    // The page header's Delete (the timeline entries have their own after it).
    await page.getByRole("button", { name: "Delete", exact: true }).first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: `Delete ${name}?` })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${noun}$`));
    await expect(page.getByRole("heading", { name: /no longer exists/ })).toHaveCount(0);
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  }
});
