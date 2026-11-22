// V-E07: winning a deal shows at once on the dashboard, sets the close date to today and 100%, adds
// "Moved from Negotiation to Won" to the timeline and recent activity, and makes the contact a
// customer. Reopening keeps the date and the customer status (AC6, R16–R18, R24, R77, WF-6, WF-7).
import type { Page } from "@playwright/test";

import { dragTo, expect, test } from "./fixtures";

const DEAL = "Plant safety training"; // in Negotiation in the sample data

/** A Negotiation deal whose main contact isn't a customer yet, from the API. */
async function dealWithProspect(page: Page): Promise<{ deal: string; contact: string; status: string }> {
  const deals = (await (await page.request.get("/api/deals")).json()) as {
    name: string;
    stage: string;
    contact_id: number | null;
  }[];
  const contacts = (await (await page.request.get("/api/contacts")).json()) as {
    id: number;
    name: string;
    status: string;
  }[];
  for (const d of deals.filter((x) => x.stage === "negotiation")) {
    const c = contacts.find((x) => x.id === d.contact_id);
    if (c && c.status !== "customer") return { deal: d.name, contact: c.name, status: c.status };
  }
  throw new Error("The sample data has no Negotiation deal whose contact isn't a customer.");
}

test("AC6 WF-6 R16–R18 R77 winning a deal", async ({ page }) => {
  await page.goto("/");
  const { deal: DEAL, contact: CONTACT, status } = await dealWithProspect(page);
  const wonFigure = page.getByTestId("figure-won");
  await expect(wonFigure).toContainText("so far");
  const countBefore = Number((await wonFigure.locator(".s").textContent())?.match(/\d+/)?.[0]);

  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search contacts" }).fill(CONTACT);
  await expect(page.getByRole("row", { name: new RegExp(CONTACT) })).toContainText(
    status === "lead" ? "Lead" : "Qualified",
  );

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  const won = page.getByRole("region", { name: "Won column" });
  await expect(won.getByTestId("closed-row").first()).toBeVisible();
  const card = page.getByTestId("deal-card").filter({ hasText: DEAL });
  await dragTo(page, card, won.getByTestId("closed-row").first(), "top");
  // It goes to the top of Won, which lists the most recent first.
  await expect(won.getByTestId("closed-row").first()).toContainText(DEAL);
  await expect(won.getByTestId("closed-row").first()).toContainText("21 Nov");

  // The deal: closed today, at 100%, with the move on its timeline (R16, R18). dnd-kit ignores clicks
  // for 50 ms after a drop, so wait a moment as a person would.
  await page.waitForTimeout(100);
  await won.getByTestId("closed-row").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(DEAL);
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("won");
  const details = page.locator("dl.details");
  await expect(details).toContainText("100%");
  await expect(details).toContainText("21 Nov 2026");
  await expect(page.getByRole("list", { name: "Timeline" }).getByRole("listitem").first()).toContainText(
    "Moved from Negotiation to Won",
  );

  // The contact became a customer (R17).
  await page.getByRole("link", { name: CONTACT }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Customer");

  // The dashboard counts it in this month at once, and recent activity shows the move (R75, R77).
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(wonFigure.locator(".s")).toHaveText(`${countBefore + 1} deals so far`);
  await expect(page.getByRole("list", { name: "Recent activity" }).getByRole("listitem").first()).toContainText(
    `${DEAL} moved from Negotiation to Won`,
  );
  await page
    .getByRole("list", { name: "Recent activity" })
    .getByRole("link", { name: `${DEAL} moved from Negotiation to Won` })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(DEAL);
});

test("WF-7 R24 reopening a won deal keeps its close date and the customer status", async ({ page }) => {
  await page.goto("/pipeline");
  const won = page.getByRole("region", { name: "Won column" });
  const negotiation = page.getByRole("region", { name: "Negotiation column" });
  await expect(won.getByTestId("closed-row").first()).toBeVisible();
  await dragTo(
    page,
    page.getByTestId("deal-card").filter({ hasText: DEAL }),
    won.getByTestId("closed-row").first(),
    "top",
  );
  await expect(won.getByTestId("closed-row").first()).toContainText(DEAL);

  await dragTo(page, won.getByTestId("closed-row").first(), negotiation.getByTestId("deal-card").first(), "top");
  const reopened = negotiation.getByTestId("deal-card").filter({ hasText: DEAL });
  await expect(reopened).toContainText("70%");
  await expect(reopened).toContainText("21 Nov 2026"); // the close date set by the win stays
  await page.waitForTimeout(100); // clicks are ignored for 50 ms after a drop
  await reopened.click();
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("negotiation");
  await expect(page.getByRole("list", { name: "Timeline" }).getByRole("listitem").first()).toContainText(
    "Moved from Won to Negotiation",
  );
  await page.getByRole("link", { name: "Marcus Bell" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Customer");
});
