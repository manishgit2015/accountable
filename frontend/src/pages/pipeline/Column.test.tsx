// V-F07: column totals, Won and Lost showing the 5 most recent with "Show all", and only this month's
// closed deals: a deal closed last month is absent (R60).
import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Deal } from "../../api/types";
import { stageInfo } from "../../lib/deals";
import { Column, columnDeals, columnTotals } from "./Column";
import { dropNeighbours } from "./Board";

const NOW = new Date(2026, 10, 21, 14, 30);

let nextId = 1;
function deal(overrides: Partial<Deal>): Deal {
  const id = nextId++;
  return {
    id,
    organizationId: 1,
    organizationName: "Acme Ltd",
    contactId: 1,
    contactName: "Ada Shah",
    name: `Deal ${id}`,
    stage: "new",
    value: 1000,
    probability: 5,
    expectedRevenue: 50,
    closeDate: "2026-12-31",
    isLate: false,
    position: id,
    closedAt: null,
    createdAt: "2026-10-01T09:00:00",
    updatedAt: "2026-10-01T09:00:00",
    ...overrides,
  };
}

function renderColumn(stage: Parameters<typeof stageInfo>[0], deals: Deal[]) {
  render(
    <DndContext>
      <Column stage={stageInfo(stage)} deals={deals} onOpenDeal={vi.fn()} onAddDeal={vi.fn()} now={NOW} />
    </DndContext>,
  );
  return screen.getByRole("region", { name: `${stageInfo(stage).label} column` });
}

describe("open columns", () => {
  it("R60 shows the stage's count, total value and expected revenue", () => {
    const deals = [
      deal({ stage: "proposal", value: 88_000, probability: 40, expectedRevenue: 35_200 }),
      deal({ stage: "proposal", value: 36_000, probability: 40, expectedRevenue: 14_400 }),
      deal({ stage: "negotiation", value: 50_000 }),
    ];
    const column = renderColumn("proposal", deals);
    expect(within(column).getByLabelText("2 deals")).toHaveTextContent("2");
    expect(within(column).getByTestId("column-value")).toHaveTextContent("$124K");
    expect(within(column).getByTestId("column-expected")).toHaveTextContent("$49.6K");
    expect(within(column).getAllByTestId("deal-card")).toHaveLength(2);
    expect(within(column).getByRole("button", { name: "Add deal" })).toBeInTheDocument();
  });

  it("R63 orders cards by their saved position", () => {
    const deals = [
      deal({ name: "Second", position: 2 }),
      deal({ name: "First", position: -1 }),
      deal({ name: "Third", position: 2.5 }),
    ];
    expect(columnDeals(stageInfo("new"), deals, NOW).map((d) => d.name)).toEqual(["First", "Second", "Third"]);
  });
});

describe("Won and Lost", () => {
  const won = (day: number, value = 1000) =>
    deal({
      stage: "won",
      probability: 100,
      value,
      expectedRevenue: value,
      closedAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00`,
    });

  it("R60 holds only deals closed this calendar month; one closed last month is absent", () => {
    const lastMonth = deal({ stage: "won", name: "October win", value: 99_000, closedAt: "2026-10-31T23:59:59" });
    const deals = [won(1, 10_000), won(15, 5_000), lastMonth];
    const column = renderColumn("won", deals);
    expect(within(column).queryByText("October win")).toBeNull();
    expect(within(column).getAllByTestId("closed-row")).toHaveLength(2);
    // The count and value cover this month only.
    expect(within(column).getByLabelText("2 deals")).toBeInTheDocument();
    expect(within(column).getByTestId("column-value")).toHaveTextContent("$15K");
    expect(within(column).getByText("this month")).toBeInTheDocument();
    expect(within(column).queryByRole("button", { name: "Add deal" })).toBeNull();
  });

  it("R60 lists the 5 most recent, with N more · Show all expanding the column in place", () => {
    const deals = [3, 9, 1, 12, 7, 20, 5, 18].map((day) => won(day));
    const column = renderColumn("won", deals);
    const rows = () => within(column).getAllByTestId("closed-row");
    expect(rows()).toHaveLength(5);
    // Most recent first: 20, 18, 12, 9, 7 November.
    const ordered = columnDeals(stageInfo("won"), deals, NOW);
    expect(ordered.map((d) => d.closedAt?.slice(8, 10))).toEqual(["20", "18", "12", "09", "07", "05", "03", "01"]);
    expect(rows().map((r) => Number(r.dataset.dealId))).toEqual(ordered.slice(0, 5).map((d) => d.id));
    fireEvent.click(within(column).getByRole("button", { name: "3 more · Show all" }));
    expect(rows()).toHaveLength(8);
    // The totals always cover the whole month, shown or not.
    expect(within(column).getByLabelText("8 deals")).toBeInTheDocument();
  });

  it("R60 says when a column is empty this month", () => {
    const column = renderColumn("lost", [deal({ stage: "lost", closedAt: "2026-09-02T10:00:00" })]);
    expect(within(column).queryAllByTestId("closed-row")).toHaveLength(0);
    expect(within(column).getByText("Closed in November")).toBeInTheDocument();
  });
});

describe("totals and drops", () => {
  it("R60 totals add value and expected revenue", () => {
    expect(columnTotals([deal({ value: 10, expectedRevenue: 1 }), deal({ value: 20, expectedRevenue: 2 })])).toEqual({
      count: 2,
      value: 30,
      expected: 3,
    });
  });

  it("R63 a drop between two cards sends them as its neighbours", () => {
    expect(dropNeighbours(stageInfo("proposal"), [4, 2], 1, 9, [], NOW)).toEqual({ beforeId: 4, afterId: 2 });
    expect(dropNeighbours(stageInfo("proposal"), [2], 0, 9, [], NOW)).toEqual({ beforeId: null, afterId: 2 });
    expect(dropNeighbours(stageInfo("proposal"), [4, 2], 2, 9, [], NOW)).toEqual({ beforeId: 2, afterId: null });
    expect(dropNeighbours(stageInfo("proposal"), [], 0, 9, [], NOW)).toEqual({ beforeId: null, afterId: null });
  });

  it("R60 a drop on Won goes to the top, next to the column's first card by position", () => {
    const a = deal({ stage: "won", position: 5, closedAt: "2026-11-20T10:00:00" });
    const b = deal({ stage: "won", position: 1, closedAt: "2026-11-02T10:00:00" });
    const old = deal({ stage: "won", position: -9, closedAt: "2026-10-02T10:00:00" });
    expect(dropNeighbours(stageInfo("won"), [a.id, b.id], 0, 99, [a, b, old], NOW)).toEqual({
      beforeId: null,
      afterId: b.id,
    });
  });
});
