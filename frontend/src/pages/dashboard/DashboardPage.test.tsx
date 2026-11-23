// V-F: the dashboard's panels from GET /api/dashboard: the greeting and figures (R70, R79), revenue (R71),
// won and lost (R72), open by stage (R73), the funnel (R74), recent activity (R75), marking a follow-up done (R76)
// and the empty states (R78).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { DashboardPage } from "./DashboardPage";

// Recharts measures its container, which jsdom can't; give the charts a fixed size so they draw.
vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <recharts.ResponsiveContainer width={800} height={270} initialDimension={{ width: 800, height: 270 }}>
        {children}
      </recharts.ResponsiveContainer>
    ),
  };
});

const months = (revenue: number[], won: number[] = [], lost: number[] = []) =>
  revenue.map((r, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    revenue_won: r,
    won: won[i] ?? 0,
    lost: lost[i] ?? 0,
  }));

const followUp = (id: number, description: string, follow_up_date: string) => ({
  id,
  type: "call",
  contact_id: 5,
  deal_id: null,
  description,
  occurred_at: "2026-11-10T09:00:00",
  follow_up_date,
  done: false,
  source: { kind: "contact", id: 5, name: "Ada Shah" },
});

const FULL = {
  today: "2026-11-21",
  summary: {
    open_value: 412_000,
    expected_revenue: 98_500,
    won_this_month: { value: 36_000, count: 1 },
    win_rate: { won: 6, lost: 2, percent: 75 },
  },
  months: months([0, 0, 0, 0, 0, 0, 0, 0, 0, 12_000, 0, 36_000], [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1], [1]),
  funnel: [
    { stage: "new", value: 400_000 },
    { stage: "qualified", value: 200_000 },
    { stage: "proposal", value: 0 },
    { stage: "negotiation", value: 0 },
    { stage: "won", value: 0 },
  ],
  open_by_stage: [
    { stage: "new", count: 1, value: 300_000, expected: 15_000 },
    { stage: "qualified", count: 1, value: 112_000, expected: 22_400 },
    { stage: "proposal", count: 0, value: 0, expected: 0 },
    { stage: "negotiation", count: 0, value: 0, expected: 0 },
  ],
  follow_ups: { overdue: [followUp(40, "Call Ada back", "2026-11-19")], today: [], next_7_days: [], later_count: 0 },
  recent: [
    {
      kind: "activity",
      id: 40,
      type: "call",
      from_stage: null,
      to_stage: null,
      description: "Called about the renewal",
      at: "2026-11-21T10:00:00",
      source: { kind: "contact", id: 5, name: "Ada Shah" },
    },
    {
      kind: "stage_change",
      id: 7,
      type: null,
      from_stage: "new",
      to_stage: "qualified",
      description: null,
      at: "2026-11-20T09:00:00",
      source: { kind: "deal", id: 3, name: "Fleet renewal" },
    },
    {
      kind: "stage_change",
      id: 8,
      type: null,
      from_stage: null,
      to_stage: "new",
      description: null,
      at: "2026-11-19T09:00:00",
      source: { kind: "deal", id: 4, name: "Depot lease" },
    },
  ],
  counts: { overdue_follow_ups: 1, late_deals: 2 },
};

const EMPTY = {
  ...FULL,
  summary: {
    open_value: 0,
    expected_revenue: 0,
    won_this_month: { value: 0, count: 0 },
    win_rate: { won: 0, lost: 0, percent: null },
  },
  months: months(Array(12).fill(0)),
  funnel: FULL.funnel.map((f) => ({ ...f, value: 0 })),
  open_by_stage: FULL.open_by_stage.map((s) => ({ ...s, count: 0, value: 0, expected: 0 })),
  follow_ups: { overdue: [], today: [], next_7_days: [], later_count: 0 },
  recent: [],
  counts: { overdue_follow_ups: 0, late_deals: 0 },
};

describe("dashboard with data", () => {
  it("R70 R79 greets and shows the four figures and the summary line", async () => {
    fakeApi({ "GET /api/dashboard": FULL });
    renderPage(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Good afternoon" })).toBeInTheDocument();
    expect(screen.getByText(/Saturday 21 November 2026 · 1 follow-up overdue, 2 deals running late/)).toBeVisible();
    expect(screen.getByTestId("figure-open")).toHaveTextContent("$412K2 open deals");
    expect(screen.getByTestId("figure-expected")).toHaveTextContent("$98.5K");
    expect(screen.getByTestId("figure-won")).toHaveTextContent("$36K1 deal so far");
    expect(screen.getByTestId("figure-win-rate")).toHaveTextContent("75%6 won · 2 lost");
  });

  it("R71 R72 R73 draws revenue, won and lost, and open value by stage", async () => {
    fakeApi({ "GET /api/dashboard": FULL });
    renderPage(<DashboardPage />);
    expect(await screen.findByRole("img", { name: /Revenue won each month/ })).toBeInTheDocument();
    expect(screen.getByText("$48,000")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Deals won and lost each month/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Open value by stage, $412,000 in all" })).toBeInTheDocument();
    const legend = screen.getByText("$300,000").closest("ul") as HTMLElement;
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["New$300,000", "Qualified$112,000", "Proposal$0", "Negotiation$0"]);
  });

  it("R71 names the month's revenue on hover", async () => {
    fakeApi({ "GET /api/dashboard": FULL });
    renderPage(<DashboardPage />);
    const chart = await screen.findByRole("img", { name: /Revenue won each month/ });
    const surface = chart.querySelector(".recharts-wrapper") as HTMLElement;
    fireEvent.mouseMove(surface, { clientX: 780, clientY: 100 });
    expect(await within(chart).findByText("Revenue won")).toBeInTheDocument();
    expect(within(chart).getByText("$36,000")).toBeInTheDocument();
  });

  it("R74 shows the value reaching each stage and the share carried over", async () => {
    fakeApi({ "GET /api/dashboard": FULL });
    renderPage(<DashboardPage />);
    const funnel = await screen.findByRole("list", { name: "Sales funnel" });
    const rows = within(funnel).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("New$400K");
    expect(rows[1]).toHaveTextContent("Qualified$200K50% carried");
    expect(rows[2]).toHaveTextContent("Proposal$00% carried");
    expect(rows[3]).not.toHaveTextContent("carried");
  });

  it("R75 lists recent activity and stage changes, each linking to its record", async () => {
    fakeApi({ "GET /api/dashboard": FULL });
    renderPage(<DashboardPage />);
    const feed = await screen.findByRole("list", { name: "Recent activity" });
    expect(within(feed).getByRole("link", { name: "Called about the renewal" })).toHaveAttribute("href", "/contacts/5");
    expect(within(feed).getByRole("link", { name: "Fleet renewal moved from New to Qualified" })).toHaveAttribute(
      "href",
      "/deals/3",
    );
    expect(within(feed).getByRole("link", { name: "Depot lease created at New" })).toBeInTheDocument();
  });

  it("R76 marks a follow-up done through the API", async () => {
    const sent = fakeApi({
      "GET /api/dashboard": FULL,
      "PATCH /api/activities/40": () => json(200, { ...followUp(40, "Call Ada back", "2026-11-19"), done: true }),
    });
    renderPage(<DashboardPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Mark done: Call Ada back" }));
    await waitFor(() =>
      expect(sent).toContainEqual({ method: "PATCH", url: "/api/activities/40", body: { done: true } }),
    );
  });
});

describe("an empty dashboard", () => {
  it("R78 shows each panel's empty state", async () => {
    fakeApi({ "GET /api/dashboard": EMPTY });
    renderPage(<DashboardPage />);
    expect(await screen.findByText("No deals won in the last 12 months")).toBeInTheDocument();
    expect(screen.getByText(/Nothing overdue/)).toBeInTheDocument();
    expect(screen.getByTestId("figure-open")).toHaveTextContent("0 open deals");
    expect(screen.getByTestId("figure-win-rate")).toHaveTextContent("None yet");
    expect(screen.getByText("No deals created in the last 12 months")).toBeInTheDocument();
    expect(screen.getByText("No deals closed in the last 12 months")).toBeInTheDocument();
    expect(screen.getByText("No open deals")).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("OBS-3 says when the dashboard can't be loaded", async () => {
    fakeApi({ "GET /api/dashboard": () => json(500, { error: { code: "internal", message: "Boom" } }) });
    renderPage(<DashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the dashboard.");
  });
});
