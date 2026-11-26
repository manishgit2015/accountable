// V-E13: the light and dark mode toggle in real Chrome (R90-R92, R94, R95, NFR-7; plan section 4.2).
// Colors are read from the page as computed by the browser, so the tokens' values are what's checked.
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const LIGHT = {
  page: "rgb(240, 244, 245)",
  panel: "rgb(255, 255, 255)",
  raised: "rgb(255, 255, 255)",
};
const DARK = {
  page: "rgb(4, 35, 46)",
  panel: "rgb(0, 0, 0)",
  raised: "rgb(14, 50, 64)",
};
const SECTIONS = ["/", "/pipeline", "/deals", "/contacts", "/organizations"];

const toggle = (page: Page) => page.locator(".topbar").getByRole("button", { name: "Dark mode" });
const html = (page: Page) => page.locator("html");

function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function expectColors(page: Page, colors: typeof LIGHT, surfaces: Record<string, Locator>) {
  expect(await background(page.locator("body")), "page").toBe(colors.page);
  for (const [name, locator] of Object.entries(surfaces)) {
    const raised = name.startsWith("raised:");
    expect(await background(locator.first()), name).toBe(raised ? colors.raised : colors.panel);
  }
}

test("R91 R94 the app starts in light mode, with the light tokens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expectColors(page, LIGHT, {
    panel: page.locator(".panel"),
    topbar: page.locator(".topbar"),
  });
});

test("R90 the toggle is in the top bar on every section and on a record page", async ({ page }) => {
  for (const path of SECTIONS) {
    await page.goto(path);
    await expect(toggle(page), path).toBeVisible();
  }
  await page.goto("/deals");
  await page.getByRole("row").nth(1).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expect(toggle(page)).toBeVisible();
});

test("R90 R95 switching to dark changes every surface at once, on each kind of screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");

  // Dashboard, with a chart tooltip on the raised surface.
  const chart = page.locator(".recharts-wrapper").first();
  const box = await chart.boundingBox();
  if (!box) throw new Error("No revenue chart");
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(chart.locator(".recharts-default-tooltip")).toBeVisible();
  await expectColors(page, DARK, {
    panel: page.locator(".panel"),
    topbar: page.locator(".topbar"),
    "raised: chart tooltip": chart.locator(".recharts-default-tooltip"),
  });

  await page.goto("/pipeline");
  await expect(page.getByTestId("deal-card").first()).toBeVisible();
  await expectColors(page, DARK, { card: page.getByTestId("deal-card") });

  await page.goto("/deals");
  await expect(page.getByText(/Showing 1–25 of/)).toBeVisible();
  await expectColors(page, DARK, { table: page.locator(".table-panel") });

  await page.getByRole("button", { name: "Row actions" }).first().click();
  await expectColors(page, DARK, {
    "raised: row menu": page.getByRole("menu"),
  });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expectColors(page, DARK, {
    "raised: delete dialog": page.getByRole("alertdialog"),
  });
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

  await page.locator(".topbar").getByRole("button", { name: "Add deal" }).click();
  await expectColors(page, DARK, {
    "raised: side panel": page.getByRole("dialog", { name: "Add deal" }),
  });
  await page.keyboard.press("Escape");

  await page.getByRole("row").nth(1).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expectColors(page, DARK, {
    "record page panel": page.locator(".panel"),
  });
});

test("R90 changing mode keeps the page and what's typed in its forms", async ({ page }) => {
  await page.goto("/contacts");
  const search = page.getByRole("searchbox", { name: "Search contacts" });
  await search.fill("Priya");
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(search).toHaveValue("Priya");

  await page.getByRole("row").nth(1).click();
  const form = page.getByRole("form", { name: "Log activity" });
  await form.getByLabel("Description").fill("Called about the renewal");
  const url = page.url();
  await toggle(page).click();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(page.url()).toBe(url);
  await expect(form.getByLabel("Description")).toHaveValue("Called about the renewal");
});

test("R92 the choice is remembered after a reload, and applied before the page is drawn", async ({ page }) => {
  // Record data-theme at the moment <body> first exists: after <head>'s scripts, before anything can paint.
  await page.addInitScript(() => {
    const record = () => {
      if (!document.body) return false;
      (window as unknown as { themeAtBody: string | null }).themeAtBody =
        document.documentElement.getAttribute("data-theme");
      return true;
    };
    if (!record()) {
      const observer = new MutationObserver(() => {
        if (record()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  const themeAtBody = () => page.evaluate(() => (window as unknown as { themeAtBody: string | null }).themeAtBody);

  await page.goto("/pipeline");
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await page.reload();
  expect(await themeAtBody()).toBe("dark");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expectColors(page, DARK, { topbar: page.locator(".topbar") });

  await toggle(page).click();
  await page.reload();
  expect(await themeAtBody()).toBeNull();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("R90 NFR-7 the toggle works from the keyboard, with its focus ring showing", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Organizations" }).focus();
  await page.keyboard.press("Tab");
  await expect(toggle(page)).toBeFocused();
  // Light mode's focus ring is Cerulean at 45%.
  expect(await toggle(page).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgba(17, 138, 178, 0.45)");

  await page.keyboard.press("Space");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toBeFocused();
  // Dark mode's focus ring is the lighter Cerulean at 60%.
  expect(await toggle(page).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgba(91, 192, 227, 0.6)");

  await page.keyboard.press("Enter");
  await expect(html(page)).not.toHaveAttribute("data-theme");
});

test("R93 with site data blocked, the app starts light and the toggle switches both ways, with no errors", async ({
  page,
}) => {
  // As Chrome does when site data is blocked: reading window.localStorage itself throws.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Failed to read the 'localStorage' property from 'Window'", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");

  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await toggle(page).click();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  // V-E00 fails this test on any console error or uncaught page error.
});

test("NFR-7 chart tooltip text is in ink, not the series colors, in both modes", async ({ page }) => {
  const ink = { light: "rgb(7, 59, 76)", dark: "rgb(205, 216, 219)" };
  for (const mode of ["light", "dark"] as const) {
    await page.goto("/");
    if (mode === "dark") await toggle(page).click();
    await expect(page.getByText("Recent activity")).toBeVisible();
    for (const index of [0, 1]) {
      const chart = page.locator(".recharts-wrapper").nth(index);
      const box = await chart.boundingBox();
      if (!box) throw new Error(`No chart ${index}`);
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
      const items = chart.locator(".recharts-tooltip-item");
      await expect(items.first()).toBeVisible();
      const colors = await items.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
      expect(colors.length, `${mode} chart ${index}`).toBeGreaterThan(0);
      expect(new Set(colors), `${mode} chart ${index}`).toEqual(new Set([ink[mode]]));
    }
  }
});

test("R90 the toggle's icon is 18px square in both modes, inside a 36px button", async ({ page }) => {
  await page.goto("/");
  for (const mode of ["light", "dark"] as const) {
    if (mode === "dark") await toggle(page).click();
    const button = await toggle(page).boundingBox();
    const icon = await toggle(page).locator("svg").boundingBox();
    expect(button, mode).toMatchObject({ width: 36, height: 36 });
    expect(icon, mode).toMatchObject({ width: 18, height: 18 });
  }
});

test("R90 changing mode keeps the scroll position", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByText("Showing 1–25 of 45")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
  // Click the element itself: Playwright's own click would scroll it into view first.
  await toggle(page).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
  await toggle(page).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
});
