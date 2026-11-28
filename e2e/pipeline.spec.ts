// V-E06: drag across and within columns, the order surviving a reload, "Add deal" in a column, late
// cards, keyboard drag, and rollback when the API fails (AC4, R60–R67, REL-8, REL-11, WF-4).
import type { Locator, Page } from "@playwright/test";

import { dragTo, expect, test } from "./fixtures";

const column = (page: Page, stage: string) => page.getByRole("region", { name: `${stage} column` });
const card = (scope: Page | Locator, name: string) => scope.getByTestId("deal-card").filter({ hasText: name });
const names = (scope: Locator) => scope.locator("[data-testid=deal-card] .t").allTextContents();
const count = (scope: Locator) => scope.locator(".col-head .count");

/** Open the board and wait for its cards. */
async function openBoard(page: Page) {
  await page.goto("/pipeline");
  await expect(page.getByTestId("deal-card").first()).toBeVisible();
}

test("AC4 R63 R15 dragging a card into a gap in another column changes its stage, exactly there", async ({ page }) => {
  await openBoard(page);
  const qualified = column(page, "Qualified");
  const before = await names(qualified);
  const openBefore = await page.getByTestId("open-expected").textContent();
  await expect(count(column(page, "New"))).toHaveText("5");

  // Drop on the top edge of Qualified's second card: between its first and second.
  await dragTo(page, card(page, "Fleet telematics pilot"), card(qualified, before[1] ?? ""), "top");

  await expect(count(qualified)).toHaveText("5");
  await expect(count(column(page, "New"))).toHaveText("4");
  await expect.poll(() => names(qualified)).toEqual([before[0], "Fleet telematics pilot", ...before.slice(1)]);
  const moved = card(qualified, "Fleet telematics pilot");
  await expect(moved).toContainText("20%"); // R15: Qualified's usual probability
  await expect(page.getByTestId("open-expected")).not.toHaveText(openBefore ?? ""); // R64: totals moved

  // R63: the order is saved and survives a reload.
  await page.reload();
  await expect
    .poll(() => names(column(page, "Qualified")))
    .toEqual([before[0], "Fleet telematics pilot", ...before.slice(1)]);

  // WF-4: the timeline says so.
  await card(page, "Fleet telematics pilot").click();
  await expect(page.getByRole("list", { name: "Timeline" })).toContainText("Moved from New to Qualified");
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("qualified");
});

test("R63 dragging within a column puts the card exactly where it was dropped", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1300 }); // the column's last card is below 900px
  await openBoard(page);
  const proposal = column(page, "Proposal");
  const before = await names(proposal);
  const last = before[before.length - 1] ?? "";
  await dragTo(page, card(proposal, last), card(proposal, before[0] ?? ""), "top");
  const expected = [last, ...before.slice(0, -1)];
  await expect.poll(() => names(proposal)).toEqual(expected);
  await page.reload();
  await expect.poll(() => names(column(page, "Proposal"))).toEqual(expected);
  // Same stage: no stage change and the probability is unchanged.
  await expect(card(page, last)).toContainText("40%");
});

test("R66 a card can be moved with the keyboard: Space, arrows, Space; Escape cancels", async ({ page }) => {
  await openBoard(page);
  const handle = page.getByRole("button", { name: /^Website rebuild,/ });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100); // dnd-kit listens for the arrows a moment after Space lifts the card (RK-17)
  await page.keyboard.press("ArrowRight");
  await expect(column(page, "Qualified").locator(".drop")).toBeVisible(); // the drop gap follows
  await page.keyboard.press("Escape");
  await expect(card(column(page, "New"), "Website rebuild")).toBeVisible(); // cancelled: still in New

  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100); // dnd-kit listens for the arrows a moment after Space lifts the card (RK-17)
  await page.keyboard.press("ArrowRight");
  await expect(column(page, "Qualified").locator(".drop")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(card(column(page, "Qualified"), "Website rebuild")).toBeVisible();
  await expect(card(column(page, "Qualified"), "Website rebuild")).toContainText("20%");
  await page.reload();
  await expect(card(column(page, "Qualified"), "Website rebuild")).toBeVisible();
});

test("R66 Enter on a focused card opens the deal", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: /^Website rebuild,/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Website rebuild");
});

test("R65 Add deal in a column opens the form with that stage, and the card goes to the top", async ({ page }) => {
  await openBoard(page);
  const negotiation = column(page, "Negotiation");
  await negotiation.getByRole("button", { name: "Add deal" }).click();
  const panel = page.getByRole("dialog", { name: "Add deal in Negotiation" });
  await expect(panel.getByLabel("Stage")).toHaveValue("negotiation");
  await expect(panel.getByLabel("Probability (%)")).toHaveValue("70");
  await panel.getByLabel("Name").fill("Harbour cranes");
  await panel.getByLabel("Organization").selectOption({ label: "Tidewater Marine Supply" });
  await panel.getByLabel("Main contact").selectOption({ index: 1 });
  await panel.getByLabel("Value (USD)").fill("75000");
  await panel.getByLabel("Close date").fill("2027-02-01");
  await panel.getByRole("button", { name: "Add deal" }).click();
  await expect(panel).toBeHidden();
  await expect.poll(async () => (await names(negotiation))[0]).toBe("Harbour cranes");
  await expect(card(negotiation, "Harbour cranes")).toContainText("$75,000");
});

test("R62 late cards show a Late badge with the date", async ({ page }) => {
  await openBoard(page);
  const late = card(page, "Clinic scheduling suite");
  await expect(late.locator(".badge-late")).toHaveText(/^Late · \d+ \w{3}$/);
  await expect(card(page, "Fleet telematics pilot").locator(".badge-late")).toHaveCount(0);
});

test("R60 Won and Lost show this month's deals only, with their totals", async ({ page }) => {
  await openBoard(page);
  const won = column(page, "Won");
  await expect(won).toContainText("this month");
  await expect(won).toContainText("Closed in November");
  await expect(won.getByTestId("closed-row").first()).toBeVisible();
  // A deal won before this month is in the Deals table but not on the board.
  await expect(won.getByText("Chandlery web shop")).toHaveCount(0);
  await expect(column(page, "Won").getByRole("button", { name: "Add deal" })).toHaveCount(0);
});

test("R64 REL-8 a failed move puts the card and totals back and says so", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 500/); // the failure is mocked, on purpose
  await openBoard(page);
  const totals = await page.getByTestId("open-expected").textContent();
  await page.route("**/api/deals/*/move", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "internal", message: "Something went wrong.", request_id: "r1" } }),
    }),
  );
  await dragTo(
    page,
    card(page, "Annual support plan"),
    column(page, "Proposal").getByTestId("deal-card").first(),
    "top",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Couldn't move the deal. Check the app is still running and try again.",
  );
  await expect(card(column(page, "New"), "Annual support plan")).toBeVisible();
  await expect(card(column(page, "Proposal"), "Annual support plan")).toHaveCount(0);
  await expect(page.getByTestId("open-expected")).toHaveText(totals ?? "");
});

test("REL-11 a move against a changed board reloads it and says so", async ({ page, guards, request }) => {
  guards.allowConsoleError(/status of 409/); // the stale move, on purpose
  await openBoard(page);
  // Another tab moves Proposal's top card away, so this board's neighbours are stale.
  const proposal = column(page, "Proposal");
  const top = (await names(proposal))[0] ?? "";
  const deals = (await (await request.get("/api/deals")).json()) as { id: number; name: string }[];
  const topId = deals.find((d) => d.name === top)?.id;
  const changed = await request.patch(`/api/deals/${topId}`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { stage: "negotiation" },
  });
  expect(changed.status()).toBe(200);
  await dragTo(page, card(page, "Annual support plan"), card(proposal, top), "top");
  await expect(page.getByRole("alert")).toContainText("The board changed. Try again.");
  // The board reloaded: the other tab's change shows.
  await expect(card(column(page, "Proposal"), top)).toHaveCount(0);
});
