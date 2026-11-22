// V-E12 (T4.4): no horizontal page scroll at 1024px and 1280px on any screen (R5, NFR-10).
// Each screen is checked with its data shown, and with a side panel and a dialog open, since those
// overlay the page.
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const SCREENS: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: "Dashboard",
    path: "/",
    ready: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("main .grid")).toBeVisible();
    },
  },
  {
    name: "Pipeline",
    path: "/pipeline",
    ready: (page) => expect(page.getByRole("region", { name: "New column" })).toBeVisible(),
  },
  { name: "Deals", path: "/deals", ready: (page) => expect(page.getByText("Showing 1–25 of 45")).toBeVisible() },
  { name: "Contacts", path: "/contacts", ready: (page) => expect(page.getByText("Showing 1–25 of 40")).toBeVisible() },
  {
    name: "Organizations",
    path: "/organizations",
    ready: (page) => expect(page.getByText("Showing 1–12 of 12")).toBeVisible(),
  },
];

/** The page's scroll width beyond the window, in pixels: 0 means no horizontal scroll. */
async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  });
}

/** Elements that stick out past the window's right edge, to say what overflows when the check fails. */
async function culprits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} (${Math.round(el.getBoundingClientRect().right)}px)`);
  });
}

async function expectNoHorizontalScroll(page: Page, what: string): Promise<void> {
  const extra = await overflow(page);
  expect(extra, `R5: ${what} scrolls sideways by ${extra}px: ${(await culprits(page)).join(", ")}`).toBeLessThanOrEqual(
    0,
  );
}

for (const width of [1024, 1280]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test(`R5 no horizontal scroll on the five sections at ${width}px`, async ({ page }) => {
      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await screen.ready(page);
        await expectNoHorizontalScroll(page, screen.name);
      }
    });

    test(`R5 no horizontal scroll on the record pages, side panels and dialogs at ${width}px`, async ({ page }) => {
      const main = page.getByRole("main");
      for (const [list, row, heading] of [
        ["/organizations", /Northwind Logistics/, "Northwind Logistics"],
        ["/contacts", /Priya Raman/, "Priya Raman"],
        ["/deals", /Grid analytics licence/, "Grid analytics licence"],
      ] as const) {
        await page.goto(list);
        await main.getByRole("searchbox").fill(heading);
        await main.getByRole("row", { name: row }).getByRole("cell").first().click();
        await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
        await expect(page.getByRole("list", { name: "Timeline" })).toBeVisible();
        await expectNoHorizontalScroll(page, `${heading}'s page`);
      }

      // The side panel (the widest form: a deal) and the delete dialog.
      await page.goto("/deals");
      await main.getByRole("button", { name: "Add deal" }).click();
      await expect(page.getByRole("dialog", { name: "Add deal" })).toBeVisible();
      await expectNoHorizontalScroll(page, "the Add deal panel");
      await page.keyboard.press("Escape");

      await main.getByRole("searchbox").fill("Website rebuild");
      await main
        .getByRole("row", { name: /Website rebuild/ })
        .getByRole("button", { name: "Row actions" })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoHorizontalScroll(page, "the delete dialog");
    });
  });
}
