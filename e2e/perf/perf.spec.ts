// V-P01 (T4.2): page, API, search and sort timings at 2 x the intent's volume (R6, NFR-1–NFR-3, NFR-13).
// Run by `npm run test:perf` only: it fills the temporary database with app.perfdata first, so this file
// doesn't use fixtures.ts (whose reset would replace that data with the small sample). It keeps V-E00's
// guards itself: any console error or request outside localhost fails the run.
//
// What's measured, at the 95th percentile of 20 runs (E-3):
// - NFR-1 (≤500 ms): in-app navigation, from the click on a tab or row to the page's data shown, with an
//   empty query cache (each run starts from a fresh load of another page). The cold first load of the app
//   is recorded without a threshold.
// - NFR-2 (≤300 ms lists and dashboard, ≤100 ms other calls): API round trips to the backend.
// - NFR-3 (≤100 ms): a key press in a table's search, and a click on a heading, to the table updated.
// Times are taken in the browser with performance.now() and requestAnimationFrame, so they include
// React's render and one frame.
import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API = `http://127.0.0.1:${process.env.ACCOUNTABLE_API_PORT || 8001}`;
const ORIGIN = `http://127.0.0.1:${process.env.ACCOUNTABLE_WEB_PORT || 5174}`;
const RUNS = 20;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

type Row = { measure: string; threshold: number | null; runs: number; p50: number; p95: number; max: number };
const report: Row[] = [];

function p(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

function record(measure: string, threshold: number | null, values: number[]): Row {
  const row = {
    measure,
    threshold,
    runs: values.length,
    p50: Math.round(p(values, 0.5)),
    p95: Math.round(p(values, 0.95)),
    max: Math.round(Math.max(...values)),
  };
  report.push(row);
  console.log(
    `${measure.padEnd(52)} p50 ${String(row.p50).padStart(4)} ms  p95 ${String(row.p95).padStart(4)} ms  ` +
      `max ${String(row.max).padStart(4)} ms  ${threshold === null ? "(no threshold)" : `threshold ${threshold} ms`}`,
  );
  return row;
}

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  mkdirSync("test-results/perf", { recursive: true });
  writeFileSync("test-results/perf/report.json", JSON.stringify(report, null, 2));
  console.log("\nV-P01 timing report written to test-results/perf/report.json");
});

/** V-E00's guards, for this file: no console errors, no requests leaving this computer. */
function guard(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`Console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`Page error: ${e.message}`));
  void page.route(
    (url) => !LOCAL_HOSTS.has(url.hostname) && url.protocol !== "data:" && url.protocol !== "blob:",
    async (route) => {
      problems.push(`Request outside this computer: ${route.request().url()}`);
      await route.abort();
    },
  );
  return problems;
}

/** Which page's data counts as "shown". Evaluated in the browser. */
type Ready = "dashboard" | "pipeline" | "table" | "record";

async function waitReady(page: Page, ready: Ready, path: RegExp): Promise<void> {
  await page.waitForFunction(isReadyInPage, { ready, path: path.source });
}

function isReadyInPage({ ready, path }: { ready: Ready; path: string }): boolean {
  if (!new RegExp(path).test(location.pathname)) return false;
  const main = document.querySelector("main");
  if (!main || main.querySelector("[aria-busy='true']")) return false;
  if (ready === "dashboard") return !!main.querySelector(".grid .greeting");
  if (ready === "pipeline") {
    return (
      !!main.querySelector("[data-testid='open-pipeline']") &&
      !!main.querySelector("[data-stage] [aria-label*='Press Space']")
    );
  }
  if (ready === "table") return /Showing 1–25 of \d+/.test(main.textContent ?? "") && !!main.querySelector("tbody tr");
  return !!main.querySelector(".record-head .page-title") && !!main.querySelector(".timeline, .record-main");
}

/**
 * Click `selector` in the page and time until `ready` holds on a path matching `path`.
 * Returns the milliseconds, and how many /api requests were made (to prove the data wasn't cached).
 */
async function timeClick(page: Page, selector: string, ready: Ready, path: RegExp): Promise<[number, number]> {
  let apiCalls = 0;
  const count = (r: { url: () => string }) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls += 1;
  };
  page.on("request", count);
  const ms = await page.evaluate(
    ({ selector, ready, path, check }) =>
      new Promise<number>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const isReady = new Function(`return (${check})`)() as (a: { ready: string; path: string }) => boolean;
        const target = document.querySelector<HTMLElement>(selector);
        if (!target) return reject(new Error(`nothing matches ${selector}`));
        const start = performance.now();
        target.click();
        const tick = () => {
          if (isReady({ ready, path })) resolve(performance.now() - start);
          else if (performance.now() - start > 10_000) reject(new Error(`not ready after 10 s: ${path}`));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { selector, ready, path: path.source, check: isReadyInPage.toString() },
  );
  page.off("request", count);
  return [ms, apiCalls];
}

const NAVIGATIONS: { name: string; from: string; fromReady: Ready; click: string; ready: Ready; path: RegExp }[] = [
  {
    name: "Dashboard",
    from: "/organizations",
    fromReady: "table",
    click: "nav.tabs a[href='/']",
    ready: "dashboard",
    path: /^\/$/,
  },
  {
    name: "Pipeline",
    from: "/",
    fromReady: "dashboard",
    click: "nav.tabs a[href='/pipeline']",
    ready: "pipeline",
    path: /^\/pipeline$/,
  },
  {
    name: "Deals",
    from: "/",
    fromReady: "dashboard",
    click: "nav.tabs a[href='/deals']",
    ready: "table",
    path: /^\/deals$/,
  },
  {
    name: "Contacts",
    from: "/",
    fromReady: "dashboard",
    click: "nav.tabs a[href='/contacts']",
    ready: "table",
    path: /^\/contacts$/,
  },
  {
    name: "Organizations",
    from: "/",
    fromReady: "dashboard",
    click: "nav.tabs a[href='/organizations']",
    ready: "table",
    path: /^\/organizations$/,
  },
  {
    name: "Organization page",
    from: "/organizations",
    fromReady: "table",
    click: "main tbody tr td",
    ready: "record",
    path: /^\/organizations\/\d+$/,
  },
  {
    name: "Contact page",
    from: "/contacts",
    fromReady: "table",
    click: "main tbody tr td",
    ready: "record",
    path: /^\/contacts\/\d+$/,
  },
  {
    name: "Deal page",
    from: "/deals",
    fromReady: "table",
    click: "main tbody tr td",
    ready: "record",
    path: /^\/deals\/\d+$/,
  },
];

test("R6 NFR-1 V-P01 in-app navigation shows each page's data within 500 ms (p95 of 20)", async ({ page }) => {
  const problems = guard(page);

  // The cold first load, recorded without a threshold (E-3).
  const coldStart = Date.now();
  await page.goto("/");
  await waitReady(page, "dashboard", /^\/$/);
  record("Cold first load of the app (dev servers, E-3)", null, [Date.now() - coldStart]);

  const failures: string[] = [];
  for (const nav of NAVIGATIONS) {
    const times: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      await page.goto(nav.from); // a fresh load: the query cache starts empty
      await waitReady(page, nav.fromReady, new RegExp(`^${nav.from.replace("/", "\\/")}$`));
      const [ms, apiCalls] = await timeClick(page, nav.click, nav.ready, nav.path);
      expect(apiCalls, `${nav.name}: the data was fetched, not cached`).toBeGreaterThan(0);
      times.push(ms);
    }
    const row = record(`NFR-1 navigate to ${nav.name}`, 500, times);
    if (row.p95 > 500) failures.push(`${nav.name} p95 ${row.p95} ms`);
  }
  expect(failures, "NFR-1 thresholds").toEqual([]);
  expect(problems, "V-E00").toEqual([]);
});

async function timeApi(
  request: APIRequestContext,
  call: () => Promise<{ status: () => number }>,
  okStatus: number,
): Promise<number[]> {
  await call(); // warm-up, not counted
  const times: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const start = performance.now();
    const response = await call();
    times.push(performance.now() - start);
    expect(response.status()).toBe(okStatus);
  }
  void request;
  return times;
}

test("NFR-2 V-P01 the API answers lists within 300 ms and other calls within 100 ms (p95 of 20)", async ({
  request,
}) => {
  const headers = { Origin: ORIGIN };
  const get = (path: string) => () => request.get(`${API}${path}`);
  const orgs: { id: number; contact_count: number; open_deal_count: number }[] = await (
    await request.get(`${API}/api/organizations`)
  ).json();
  expect(orgs.length).toBe(200);
  // The busiest organization, so its combined timeline is the largest.
  const org = [...orgs].sort((a, b) => b.contact_count + b.open_deal_count - (a.contact_count + a.open_deal_count))[0];
  const deals: { id: number; stage: string; position: number }[] = await (await request.get(`${API}/api/deals`)).json();
  const contacts: { id: number }[] = await (await request.get(`${API}/api/contacts`)).json();
  const activities: { id: number }[] = await (await request.get(`${API}/api/activities`)).json();
  expect([contacts.length, deals.length, activities.length]).toEqual([2000, 1000, 10000]);
  // The second card in Proposal, moved repeatedly to the top of the column, above the first (spec 5.4).
  const proposal = deals.filter((d) => d.stage === "proposal").sort((a, b) => a.position - b.position);
  const [top, deal] = proposal;
  const contact = contacts[0];

  const lists: [string, () => Promise<{ status: () => number }>][] = [
    ["GET /api/organizations (200)", get("/api/organizations")],
    ["GET /api/contacts (2,000)", get("/api/contacts")],
    ["GET /api/deals (1,000)", get("/api/deals")],
    ["GET /api/activities (10,000)", get("/api/activities")],
    ["GET /api/dashboard", get("/api/dashboard")],
  ];
  let flip = 0;
  const others: [string, () => Promise<{ status: () => number }>, number][] = [
    ["GET /api/health", get("/api/health"), 200],
    ["GET /api/organizations/{id}", get(`/api/organizations/${org.id}`), 200],
    ["GET /api/contacts/{id}", get(`/api/contacts/${contact.id}`), 200],
    ["GET /api/deals/{id}", get(`/api/deals/${deal.id}`), 200],
    ["GET /api/organizations/{id}/timeline (busiest)", get(`/api/organizations/${org.id}/timeline`), 200],
    ["GET /api/contacts/{id}/timeline", get(`/api/contacts/${contact.id}/timeline`), 200],
    ["GET /api/deals/{id}/timeline", get(`/api/deals/${deal.id}/timeline`), 200],
    ["GET /api/organizations/{id}/delete-impact", get(`/api/organizations/${org.id}/delete-impact`), 200],
    [
      "PATCH /api/deals/{id}",
      () => request.patch(`${API}/api/deals/${deal.id}`, { headers, data: { value: 10_000 + (flip += 1) } }),
      200,
    ],
    [
      "POST /api/deals/{id}/move (to the top of its column)",
      () =>
        request.post(`${API}/api/deals/${deal.id}/move`, {
          headers,
          data: { stage: "proposal", before_id: null, after_id: top.id },
        }),
      200,
    ],
    [
      "POST /api/activities",
      () =>
        request.post(`${API}/api/activities`, {
          headers,
          data: { type: "note", description: "Perf", deal_id: deal.id },
        }),
      201,
    ],
    [
      "PATCH /api/activities/{id}",
      () =>
        request.patch(`${API}/api/activities/${activities[0].id}`, { headers, data: { done: (flip += 1) % 2 === 0 } }),
      200,
    ],
  ];

  const failures: string[] = [];
  for (const [name, call] of lists) {
    const row = record(`NFR-2 ${name}`, 300, await timeApi(request, call, 200));
    if (row.p95 > 300) failures.push(`${name} p95 ${row.p95} ms`);
  }
  for (const [name, call, status] of others) {
    const row = record(`NFR-2 ${name}`, 100, await timeApi(request, call, status));
    if (row.p95 > 100) failures.push(`${name} p95 ${row.p95} ms`);
  }
  expect(failures, "NFR-2 thresholds").toEqual([]);
});

/** The table's "Showing … of N" line, read in the browser. */
const SUMMARY = `(() => (document.querySelector("main .table-footer .label[aria-live]")?.textContent ?? ""))()`;

async function timeSearchKey(page: Page, key: string): Promise<number | null> {
  await page.evaluate((summary) => {
    const w = window as unknown as { __perf: { before: string; start: number | null } };
    // eslint-disable-next-line no-eval
    w.__perf = { before: eval(summary) as string, start: null };
    window.addEventListener("keydown", () => (w.__perf.start = performance.now()), { once: true, capture: true });
  }, SUMMARY);
  await page.keyboard.press(key);
  return page.evaluate(
    (summary) =>
      new Promise<number | null>((resolve) => {
        const w = window as unknown as { __perf: { before: string; start: number | null } };
        const begun = performance.now();
        const tick = () => {
          // eslint-disable-next-line no-eval
          if (w.__perf.start !== null && eval(summary) !== w.__perf.before) resolve(performance.now() - w.__perf.start);
          else if (performance.now() - begun > 2000)
            resolve(null); // this letter didn't change the table
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    SUMMARY,
  );
}

async function timeSortClick(page: Page, heading: string): Promise<number> {
  return page.evaluate(
    (heading) =>
      new Promise<number>((resolve, reject) => {
        const th = [...document.querySelectorAll<HTMLElement>("main thead th")].find(
          (h) => h.textContent?.trim() === heading,
        );
        const button = th?.querySelector<HTMLButtonElement>("button");
        if (!th || !button) return reject(new Error(`no heading ${heading}`));
        const sortBefore = th.getAttribute("aria-sort");
        const firstRow = () => document.querySelector("main tbody tr")?.textContent ?? "";
        const rowBefore = firstRow();
        const start = performance.now();
        button.click();
        const tick = () => {
          if (th.getAttribute("aria-sort") !== sortBefore && firstRow() !== rowBefore)
            resolve(performance.now() - start);
          else if (performance.now() - start > 5000) reject(new Error(`sorting by ${heading} didn't change the table`));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    heading,
  );
}

for (const table of [
  { name: "Contacts", path: "/contacts", search: "Search contacts", sortBy: "Name" },
  { name: "Deals", path: "/deals", search: "Search deals", sortBy: "Value (USD)" },
]) {
  test(`NFR-3 V-P01 ${table.name}: a search key press and a heading click update the table within 100 ms (p95 of 20)`, async ({
    page,
  }) => {
    const problems = guard(page);
    await page.goto(table.path);
    await waitReady(page, "table", new RegExp(`^\\${table.path}$`));
    const searchbox = page.getByRole("searchbox", { name: table.search });
    const summary = page.locator("main .table-footer .label[aria-live]");
    const full = (await summary.textContent()) ?? "";
    expect(full).toMatch(table.name === "Contacts" ? / of 2000$/ : / of 1000$/);

    // Search: from an empty box, one key press. Letters that every row contains don't change the table
    // and are skipped (not counted).
    const searches: number[] = [];
    const letters = "zqvjwykfbuhcdtigmrlnsoaep0123456789".split("");
    for (let i = 0; searches.length < RUNS && i < letters.length * 2; i += 1) {
      await searchbox.fill("");
      await expect(summary).toHaveText(full);
      await searchbox.focus();
      const ms = await timeSearchKey(page, letters[i % letters.length]);
      if (ms !== null) searches.push(ms);
    }
    await searchbox.fill("");
    expect(searches.length).toBe(RUNS);
    const searchRow = record(`NFR-3 ${table.name} search key press`, 100, searches);

    const sorts: number[] = [];
    for (let run = 0; run < RUNS; run += 1) sorts.push(await timeSortClick(page, table.sortBy));
    const sortRow = record(`NFR-3 ${table.name} sort by ${table.sortBy}`, 100, sorts);

    expect(searchRow.p95, "NFR-3 search").toBeLessThanOrEqual(100);
    expect(sortRow.p95, "NFR-3 sort").toBeLessThanOrEqual(100);
    expect(problems, "V-E00").toEqual([]);
  });
}
