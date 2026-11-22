// V-E10 (T4.3): saved changes survive a reload and a backend restart (AC2, R3, REL-1–REL-3).
// Also T4.3's failure handling with a mocked API: the 10 s timeout (REL-4), 503 busy (REL-6) and the offline
// banner with saving blocked until the backend is back (REL-7).
//
// The restart test runs its own backend, on a free port and on the same test database, and sends the
// browser's /api requests to it. It kills that backend outright (as a crash would), starts a new one, and
// checks the data. Playwright's own servers are never touched, so the other tests are unaffected.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const WEB_PORT = process.env.ACCOUNTABLE_WEB_PORT || "5174";

test("AC2 R3 saved changes survive a reload", async ({ page }) => {
  await page.goto("/organizations");
  const main = page.getByRole("main");

  // A new organization.
  await main.getByRole("button", { name: "Add organization" }).click();
  const add = page.getByRole("dialog", { name: "Add organization" });
  await add.getByLabel("Name").fill("Persistence Test Ltd");
  await add.getByLabel("Industry").fill("Durability");
  await add.getByRole("button", { name: "Add organization" }).click();
  await expect(add).toBeHidden();

  // An edit to an existing organization.
  await main
    .getByRole("row", { name: /Lumen Studio/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await edit.getByLabel("Industry").fill("Film and photography");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();

  // A delete.
  await main
    .getByRole("row", { name: /Juniper Lane Interiors/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Juniper Lane Interiors?" });
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(confirm).toBeHidden();

  await page.reload();
  await expect(main.getByRole("row", { name: /Persistence Test Ltd/ })).toContainText("Durability");
  await expect(main.getByRole("row", { name: /Lumen Studio/ })).toContainText("Film and photography");
  await expect(main.getByRole("row", { name: /Juniper Lane Interiors/ })).toHaveCount(0);
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();

  // And in a new tab, which shares nothing with this one but the database.
  const other = await page.context().newPage();
  await other.goto("/organizations");
  await expect(other.getByRole("main").getByRole("row", { name: /Persistence Test Ltd/ })).toBeVisible();
  await other.close();
});

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port")),
      );
    });
  });
}

/** Start a backend on `port`, on the test database, and wait until it answers. */
async function startBackend(port: number): Promise<ChildProcess> {
  const child = spawn("uv", ["run", "--no-sync", "--directory", "backend", "python", "-m", "app.main"], {
    env: { ...process.env, ACCOUNTABLE_API_PORT: String(port), ACCOUNTABLE_WEB_PORT: WEB_PORT, ACCOUNTABLE_RELOAD: "" },
    stdio: "ignore",
    detached: process.platform !== "win32", // its own process group, so the whole group can be killed
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return child;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  kill(child);
  throw new Error(`The backend on port ${port} didn't start within 30 s`);
}

/** Kill a backend and its children outright, as a crash would: no clean shutdown. */
function kill(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(-child.pid, "SIGKILL");
  }
}

/** Send the page's /api requests to the backend on `port`, and fail them while it's down. */
async function useBackend(page: Page, port: () => number): Promise<void> {
  await page.route(
    (url) => url.port === WEB_PORT && url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      url.port = String(port());
      try {
        await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
      } catch {
        await route.abort("connectionrefused");
      }
    },
  );
}

test("AC2 R3 REL-1 saved changes survive a backend restart, even after it's killed", async ({ page, guards }) => {
  test.setTimeout(120_000);
  const port = await freePort();
  let backend = await startBackend(port);
  try {
    await useBackend(page, () => port);
    await page.goto("/deals");
    const main = page.getByRole("main");
    await main.getByRole("searchbox", { name: "Search deals" }).fill("Website rebuild");

    // Save a change: a deal's value and stage, through the edit form.
    await main
      .getByRole("row", { name: /Website rebuild/ })
      .getByRole("button", { name: "Row actions" })
      .click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit deal" });
    await edit.getByLabel("Value (USD)").fill("12345");
    await edit.getByLabel("Stage").selectOption("proposal");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden();
    await expect(main.getByRole("row", { name: /Website rebuild/ })).toContainText("12,345");

    // Kill the backend straight after the save: no clean shutdown, no checkpoint.
    kill(backend);
    guards.allowConsoleError(/Failed to load resource: net::ERR_CONNECTION_REFUSED/);

    // REL-7: the next request fails, the banner shows, and what's on screen stays.
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Contacts" }).click();
    const banner = page.locator(".offline-banner[role='alert']");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toHaveText("Can't reach Accountable. Check it's still running in the terminal.");

    // Restart: a new process on the same database. The banner goes when it answers again.
    backend = await startBackend(port);
    await expect(banner).toBeHidden({ timeout: 15_000 });

    await page.goto("/deals");
    await main.getByRole("searchbox", { name: "Search deals" }).fill("Website rebuild");
    await expect(main.getByRole("row", { name: /Website rebuild/ })).toContainText("12,345");
    await expect(main.getByRole("row", { name: /Website rebuild/ })).toContainText("Proposal");
  } finally {
    kill(backend);
  }
});

test("REL-6 a 503 busy answer shows Accountable is busy, and the save can be tried again", async ({ page, guards }) => {
  guards.allowConsoleError(/status of 503/);
  await page.goto("/organizations");
  const main = page.getByRole("main");
  let busy = true;
  await page.route("**/api/organizations/*", async (route) => {
    if (route.request().method() !== "PATCH" || !busy) return route.fallback();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: { "X-Request-ID": "9f2c0000000000000000000000000000" },
      json: {
        error: {
          code: "busy",
          message: "Accountable is busy. Try again.",
          request_id: "9f2c0000000000000000000000000000",
        },
      },
    });
  });

  await main
    .getByRole("row", { name: /Lumen Studio/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await edit.getByLabel("Industry").fill("Busy test");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByRole("alert")).toContainText("Accountable is busy. Try again.");
  await expect(edit.getByRole("alert")).toContainText("9f2c"); // OBS-3: the reference
  await expect(edit).toBeVisible(); // nothing lost: the form and its values stay
  await expect(edit.getByLabel("Industry")).toHaveValue("Busy test");

  // REL-5: changes are never retried automatically, so trying again is the user's choice.
  busy = false;
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(main.getByRole("row", { name: /Lumen Studio/ })).toContainText("Busy test");
});

test("REL-4 a save with no answer gives up after 10 seconds with a message", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/organizations");
  const main = page.getByRole("main");
  await page.route("**/api/organizations/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    // Never answer. The client aborts the request itself after 10 s.
  });

  await main
    .getByRole("row", { name: /Lumen Studio/ })
    .getByRole("button", { name: "Row actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await edit.getByLabel("Industry").fill("Timeout test");
  const started = Date.now();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByRole("button", { name: /Sav/ })).toBeDisabled(); // REL-5: no double save
  await expect(edit.getByRole("alert")).toContainText(
    "Accountable didn't answer in time. Check it's still running and try again.",
    { timeout: 15_000 },
  );
  const waited = Date.now() - started;
  expect(waited).toBeGreaterThanOrEqual(9_500);
  expect(waited).toBeLessThan(14_000);
  await expect(edit.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test("REL-7 when the backend can't be reached, a banner shows, data stays and saving waits", async ({
  page,
  guards,
}) => {
  guards.allowConsoleError(/Failed to load resource: net::ERR_CONNECTION_REFUSED/);
  await page.goto("/organizations");
  const main = page.getByRole("main");
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();

  let down = true;
  await page.route("**/api/**", (route) => (down ? route.abort("connectionrefused") : route.fallback()));

  // Any read now fails; the table on screen stays.
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Contacts" }).click();
  const banner = page.locator(".offline-banner[role='alert']");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await page.goBack();
  await expect(main.getByText("Showing 1–12 of 12")).toBeVisible();

  // Saving is blocked while it's down.
  await main.getByRole("button", { name: "Add organization" }).click();
  const add = page.getByRole("dialog", { name: "Add organization" });
  await add.getByLabel("Name").fill("Offline Test Ltd");
  await expect(add.getByRole("button", { name: "Add organization" })).toBeDisabled();

  // Back again: the health check clears the banner and saving works.
  down = false;
  await expect(banner).toBeHidden({ timeout: 15_000 });
  await expect(add.getByRole("button", { name: "Add organization" })).toBeEnabled();
  await add.getByRole("button", { name: "Add organization" }).click();
  await expect(add).toBeHidden();
  await expect(main.getByRole("row", { name: /Offline Test Ltd/ })).toBeVisible();
});
