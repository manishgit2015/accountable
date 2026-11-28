// V-E13: Light, Dark and System from the user menu in real Chrome (R90-R96, R106, R109, NFR-7).
// Colors, sizes and positions are read from the page as the browser computed them.
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PRIYA, TEST_PASSWORD } from "./signIn";

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

const menuButton = (page: Page) => page.locator(".topbar").getByRole("button", { name: "Account menu, Priya Shah" });
const html = (page: Page) => page.locator("html");
const option = (page: Page, name: "Light" | "Dark" | "System") => page.getByRole("menuitemradio", { name });

/** Open the user menu, pick a theme, and close the menu again (it stays open on its own, R90). */
async function choose(page: Page, name: "Light" | "Dark" | "System") {
  await menuButton(page).click();
  await option(page, name).click();
  await expect(option(page, name)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}

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

test("R91 R94 the app starts in light mode, with the light tokens, and Light chosen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await expectColors(page, LIGHT, { panel: page.locator(".panel"), topbar: page.locator(".topbar") });
  await menuButton(page).click();
  await expect(option(page, "Light")).toHaveAttribute("aria-checked", "true");
});

test("R90 R106 the user menu is in the top bar on every section and on a record page", async ({ page }) => {
  for (const path of SECTIONS) {
    await page.goto(path);
    await expect(menuButton(page), path).toHaveText("PS");
  }
  await page.goto("/deals");
  await page.getByRole("row").nth(1).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await menuButton(page).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("Priya Shah");
  await expect(menu).toContainText("priya@test.example");
  await expect(menu.getByRole("menuitemradio")).toHaveText(["Light", "Dark", "System"]);
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
});

test("R106 the menu button is a 36px Midnight circle at the end of the top bar, its menu 260px under it", async ({
  page,
}) => {
  await page.goto("/");
  const button = menuButton(page);
  const box = await button.boundingBox();
  const bar = await page.locator(".topbar").boundingBox();
  const addDeal = await page.locator(".topbar").getByRole("button", { name: "Add deal" }).boundingBox();
  if (!box || !bar || !addDeal) throw new Error("top bar not drawn");
  expect(box).toMatchObject({ width: 36, height: 36 });
  expect(box.x).toBeGreaterThan(addDeal.x); // after "Add deal", the last thing in the bar
  expect(bar.x + bar.width - (box.x + box.width)).toBeLessThan(24);
  const style = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      color: s.color,
      radius: s.borderRadius,
      font: `${s.fontSize}/${s.fontWeight}`,
    };
  });
  expect(style).toEqual({ background: "rgb(7, 59, 76)", color: "rgb(255, 255, 255)", radius: "50%", font: "13px/600" });

  await button.click();
  const menu = await page.getByRole("menu").boundingBox();
  if (!menu) throw new Error("menu not drawn");
  expect(menu.width).toBe(260);
  expect(menu.y).toBeGreaterThanOrEqual(box.y + box.height);
  expect(Math.abs(menu.x + menu.width - (box.x + box.width))).toBeLessThanOrEqual(1); // lined up on the right
});

test("R90 R95 choosing Dark changes every surface at once, on each kind of screen, and keeps the menu open", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await menuButton(page).click();
  await option(page, "Dark").click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("menu")).toBeVisible(); // stays open, so the change can be seen
  await expectColors(page, DARK, { "raised: user menu": page.getByRole("menu") });
  await page.keyboard.press("Escape");

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
  await expectColors(page, DARK, { "raised: row menu": page.getByRole("menu") });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expectColors(page, DARK, { "raised: delete dialog": page.getByRole("alertdialog") });
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

  await page.locator(".topbar").getByRole("button", { name: "Add deal" }).click();
  await expectColors(page, DARK, { "raised: side panel": page.getByRole("dialog", { name: "Add deal" }) });
  await page.keyboard.press("Escape");

  await page.getByRole("row").nth(1).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expectColors(page, DARK, { "record page panel": page.locator(".panel") });
});

test("R90 changing mode keeps the page and what's typed in its forms", async ({ page }) => {
  await page.goto("/contacts");
  const search = page.getByRole("searchbox", { name: "Search contacts" });
  await search.fill("Priya");
  await choose(page, "Dark");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(search).toHaveValue("Priya");

  await page.getByRole("row").nth(1).click();
  const form = page.getByRole("form", { name: "Log activity" });
  await form.getByLabel("Description").fill("Called about the renewal");
  const url = page.url();
  await choose(page, "Light");
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(page.url()).toBe(url);
  await expect(form.getByLabel("Description")).toHaveValue("Called about the renewal");
});

/** Record data-theme at the moment <body> first exists: after <head>'s scripts, before anything can paint. */
async function recordThemeAtFirstPaint(page: Page) {
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
  return () => page.evaluate(() => (window as unknown as { themeAtBody: string | null }).themeAtBody);
}

test("R92 the choice is remembered after a reload, and applied before the page is drawn", async ({ page }) => {
  const themeAtBody = await recordThemeAtFirstPaint(page);
  await page.goto("/pipeline");
  await choose(page, "Dark");

  await page.reload();
  expect(await themeAtBody()).toBe("dark");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expectColors(page, DARK, { topbar: page.locator(".topbar") });
  await menuButton(page).click();
  await expect(option(page, "Dark")).toHaveAttribute("aria-checked", "true");
  await option(page, "Light").click();
  await page.keyboard.press("Escape");

  await page.reload();
  expect(await themeAtBody()).toBeNull();
  await expect(html(page)).not.toHaveAttribute("data-theme");
});

test("R96 System follows the device, before the first paint and when it changes, with no reload", async ({ page }) => {
  const themeAtBody = await recordThemeAtFirstPaint(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/contacts");
  const search = page.getByRole("searchbox", { name: "Search contacts" });
  await choose(page, "System");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await search.fill("Priya");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(search).toHaveValue("Priya"); // no reload

  await page.reload();
  expect(await themeAtBody()).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  expect(await themeAtBody()).toBeNull();
});

test("R109 NFR-7 the menu works from the keyboard, with the focus ring showing", async ({ page }) => {
  await page.goto("/deals");
  await page.locator(".topbar").getByRole("button", { name: "Add deal" }).focus();
  await page.keyboard.press("Tab");
  await expect(menuButton(page)).toBeFocused();
  // Light mode's focus ring is Cerulean at 45%.
  expect(await menuButton(page).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgba(17, 138, 178, 0.45)");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  // Opening from the keyboard puts focus on the first item, Light; Down moves to Dark.
  await expect(option(page, "Light")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option(page, "Dark")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  // Dark mode's focus ring is the lighter Cerulean at 60%.
  expect(await menuButton(page).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgba(91, 192, 227, 0.6)");

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("R93 with site data blocked, the app starts light and every choice still works, with no errors", async ({
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
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  // With storage blocked, no session can be kept, so the person signs in on each visit (R102), in memory.
  await page.getByLabel("Email").fill(PRIYA);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(html(page)).not.toHaveAttribute("data-theme");

  await choose(page, "Dark");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await choose(page, "Light");
  await expect(html(page)).not.toHaveAttribute("data-theme");
  await choose(page, "System");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  // V-E00 fails this test on any console error or uncaught page error.
});

test("NFR-7 chart tooltip text is in ink, not the series colors, in both modes", async ({ page }) => {
  const ink = { light: "rgb(7, 59, 76)", dark: "rgb(205, 216, 219)" };
  for (const mode of ["light", "dark"] as const) {
    await page.goto("/");
    if (mode === "dark") await choose(page, "Dark");
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

test("R90 changing mode keeps the scroll position", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByText("Showing 1–25 of 45")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
  // Open the menu from the keyboard, focusing the button without scrolling to it: a click, or Playwright's
  // own focus, would scroll it into view first. (Closing the menu puts focus back on the button, which
  // scrolls to it, as where the person opened it from; the mode change itself keeps the position.)
  await menuButton(page).evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeAttached();
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
  await option(page, "Dark").evaluate((item) => (item as HTMLElement).click());
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
  await option(page, "Light").evaluate((item) => (item as HTMLElement).click());
  await expect(html(page)).not.toHaveAttribute("data-theme");
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
});
