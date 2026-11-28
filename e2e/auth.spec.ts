// V-E14: signing in and out (AC10, R100–R103, R107, R108). Every test starts signed out (signedInAs: null) and
// signs in as a test person through the screen, never with a real password or Supabase (SEC-17).
import { expect, test } from "./fixtures";
import { PRIYA, TEST_PASSWORD } from "./signIn";

test.use({ signedInAs: null });

const SECTIONS = ["/", "/pipeline", "/deals", "/contacts", "/organizations", "/organizations/1"];

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("R100 R101 signed out, every section and a record page show the sign-in screen", async ({ page }) => {
  for (const path of SECTIONS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Sign in" }), path).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" }), path).toHaveCount(0);
    await expect(page.getByText("Ask whoever runs Accountable for your team to add you.")).toBeVisible();
  }
});

test("R101 SEC-13 signed out, the API answers 401 to every route but health", async ({ request }) => {
  for (const path of [
    "/api/organizations",
    "/api/contacts",
    "/api/deals",
    "/api/activities",
    "/api/dashboard",
    "/api/me",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
  }
  expect((await request.get("/api/health")).status()).toBe(200);
});

test("R103 wrong details say so, keep the email and clear the password", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 401/); // the test sign-in answering 401, as Supabase answers 400
  await page.goto("/deals");
  await signIn(page, PRIYA, "not-the-password");
  await expect(page.getByRole("alert")).toHaveText("Email or password is wrong. Check them and try again.");
  await expect(page.getByLabel("Email")).toHaveValue(PRIYA);
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("AC10 R100 signing in lands on the page asked for, and a reload keeps the session", async ({ page }) => {
  await page.goto("/pipeline");
  await signIn(page, PRIYA, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/pipeline$/);
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
});

test("AC10 R100 opening the app's address lands on the dashboard", async ({ page }) => {
  await page.goto("/");
  await signIn(page, PRIYA, TEST_PASSWORD);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good afternoon");
});

test("R108 a session the API refuses ends, says so, and signing in returns to the page", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 401/);
  await page.goto("/contacts");
  await signIn(page, PRIYA, TEST_PASSWORD);
  await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible();
  // The token stops being accepted, as when it runs out while the computer sleeps.
  await page.evaluate(() => {
    const key = "accountable.test-session";
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { expiresAt: number };
    window.localStorage.setItem(key, JSON.stringify({ ...saved, token: "no.longer.valid" }));
  });
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Your session has ended. Sign in again.");
  await expect(page).toHaveURL(/\/contacts$/);
  await signIn(page, PRIYA, TEST_PASSWORD);
  await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible();
});

test("R107 R92 signing out shows the sign-in screen, stays signed out after a reload, and keeps the theme", async ({
  page,
}) => {
  await page.goto("/deals");
  await signIn(page, PRIYA, TEST_PASSWORD);
  await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible();
  const menuButton = page.getByRole("button", { name: "Account menu, Priya Shah" });
  await menuButton.click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveValue("");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // per browser, not per person (R92)
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
