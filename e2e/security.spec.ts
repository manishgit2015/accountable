// V-S08–V-S10 (T4.1): rendered injection, the website scheme check, and local-only listening.
// V-S01–V-S07 are in backend/tests/test_security.py, test_logging.py and test_errors.py.
import { execFileSync } from "node:child_process";

import { expect, test } from "./fixtures";

const API_PORT = Number(process.env.ACCOUNTABLE_API_PORT || 8001);
const WEB_PORT = Number(process.env.ACCOUNTABLE_WEB_PORT || 5174);

declare global {
  interface Window {
    __injected?: number;
  }
}

const NAMES = ["<script>window.__injected = 1</script>", '<img src=x onerror="window.__injected = 2">'];

test("SEC-6 V-S08 script text in a name is shown as text and never runs", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto("/organizations");
  const main = page.getByRole("main");
  for (const name of NAMES) {
    await main.getByRole("button", { name: "Add organization" }).click();
    const panel = page.getByRole("dialog", { name: "Add organization" });
    await panel.getByLabel("Name").fill(name);
    await panel.getByLabel("Notes").fill(name);
    await panel.getByRole("button", { name: "Add organization" }).click();
    await expect(panel).toBeHidden();
  }

  // The table shows the exact text, and no element was made from it.
  for (const name of NAMES) {
    await expect(main.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  }
  expect(await page.locator("main script, main img[src='x']").count()).toBe(0);

  // The record page shows it as the heading and in the notes, still as text.
  await main.getByRole("row").filter({ hasText: NAMES[1] }).getByRole("cell").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAMES[1]);
  await expect(page.getByText(NAMES[1]).nth(1)).toBeVisible();
  expect(await page.locator("main img[src='x']").count()).toBe(0);

  // And on the pages that list it elsewhere: the contact form's organization picker.
  await page.goto("/contacts");
  await page.getByRole("main").getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByRole("dialog", { name: "Add contact" })).toBeVisible();

  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test("SEC-6 V-S09 a javascript: website is refused by the form and by the API", async ({ page, request }) => {
  await page.goto("/organizations");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Add organization" }).click();
  const panel = page.getByRole("dialog", { name: "Add organization" });
  await panel.getByLabel("Name").fill("Scheme Test Ltd");
  await panel.getByLabel("Website").fill("javascript:alert(1)");
  await panel.getByRole("button", { name: "Add organization" }).click();
  await expect(panel.getByText("Enter a website like example.com or https://example.com.")).toBeVisible();
  await expect(panel).toBeVisible(); // not saved
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(main.getByRole("row").filter({ hasText: "Scheme Test Ltd" })).toHaveCount(0);

  // The API refuses it too, whatever the client does (R21, SEC-6).
  const origin = `http://127.0.0.1:${WEB_PORT}`;
  for (const website of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,hi", "vbscript:x"]) {
    const response = await request.post(`${origin}/api/organizations`, {
      data: { name: "Scheme Test Ltd", website },
      headers: { Origin: origin },
    });
    expect(response.status(), website).toBe(422);
    expect((await response.json()).error.fields.website).toBeTruthy();
  }
  const listed = await (await request.get(`${origin}/api/organizations`)).json();
  expect(listed.some((o: { name: string }) => o.name === "Scheme Test Ltd")).toBe(false);

  // A good website becomes a safe link that opens in a new tab.
  await page.reload();
  await main.getByRole("button", { name: "Add organization" }).click();
  await panel.getByLabel("Name").fill("Scheme Test Ltd");
  await panel.getByLabel("Website").fill("scheme.example");
  await panel.getByRole("button", { name: "Add organization" }).click();
  await expect(panel).toBeHidden();
  const link = main.getByRole("link", { name: "scheme.example" });
  await expect(link).toHaveAttribute("href", "https://scheme.example");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

/** Local addresses of every listening TCP socket on `port`, from the operating system (E-4). */
function listeningAddresses(port: number): string[] {
  let output: string;
  let lines: string[];
  if (process.platform === "linux") {
    // ss is part of iproute2 on every current Linux; netstat (net-tools) often isn't installed.
    output = execFileSync("ss", ["-Hltn"], { encoding: "utf8" });
    lines = output.split(/\r?\n/);
  } else {
    // Windows: "TCP 127.0.0.1:8001 0.0.0.0:0 LISTENING"; macOS: "tcp4 0 0 127.0.0.1.8001 *.* LISTEN".
    output = execFileSync("netstat", ["-an"], { encoding: "utf8" });
    lines = output.split(/\r?\n/).filter((line) => /\bLISTEN(ING)?\b/.test(line));
  }
  const addresses: string[] = [];
  for (const line of lines) {
    for (const token of line.trim().split(/\s+/)) {
      const match = token.match(/^(.*)[:.](\d+)$/);
      if (match && Number(match[2]) === port) {
        addresses.push(match[1]);
        break; // the first address:port on a line is the local one
      }
    }
  }
  return addresses;
}

test("SEC-1 V-S10 the API and the web server listen on 127.0.0.1 only", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  for (const port of [API_PORT, WEB_PORT]) {
    const addresses = listeningAddresses(port);
    expect(addresses.length, `something listens on port ${port}`).toBeGreaterThan(0);
    expect(new Set(addresses), `port ${port} listens only on the loopback address`).toEqual(new Set(["127.0.0.1"]));
  }
});
