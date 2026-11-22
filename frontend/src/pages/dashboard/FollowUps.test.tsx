// V-F09: follow-ups grouped into Overdue, Today and Next 7 days, the count due later, and ticking one
// removes it straight away (R76).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { Dashboard, FollowUp } from "../../api/types";
import { FollowUps } from "./FollowUps";

function item(id: number, description: string, followUpDate: string): FollowUp {
  return {
    id,
    type: "call",
    contactId: null,
    dealId: 3,
    description,
    occurredAt: "2026-11-10T10:00:00",
    followUpDate,
    done: false,
    source: { kind: "deal", id: 3, name: "ERP migration" },
  };
}

const followUps: Dashboard["followUps"] = {
  overdue: [item(1, "Send revised ERP quote", "2026-11-17"), item(2, "Chase decision", "2026-11-18")],
  today: [item(3, "Confirm pilot start date", "2026-11-21")],
  next7Days: [item(4, "Demo grid analytics", "2026-11-23")],
  laterCount: 9,
};

function renderFollowUps(onMarkDone = vi.fn().mockResolvedValue(undefined), data = followUps) {
  render(
    <MemoryRouter>
      <FollowUps followUps={data} onMarkDone={onMarkDone} />
    </MemoryRouter>,
  );
  return onMarkDone;
}

describe("FollowUps", () => {
  it("R76 groups open follow-ups into Overdue, Today and Next 7 days, with counts", () => {
    renderFollowUps();
    const overdue = screen.getByRole("region", { name: "Overdue" });
    expect(within(overdue).getByText("Overdue · 2")).toBeInTheDocument();
    expect(within(overdue).getByText("Send revised ERP quote")).toBeInTheDocument();
    expect(within(overdue).getByText("17 Nov")).toHaveClass("late-text");
    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("Today · 1")).toBeInTheDocument();
    expect(within(today).getByText("Today", { selector: ".due" })).toBeInTheDocument();
    const week = screen.getByRole("region", { name: "Next 7 days" });
    expect(within(week).getByText("23 Nov")).toBeInTheDocument();
    expect(within(week).getByRole("link", { name: "ERP migration" })).toHaveAttribute("href", "/deals/3");
  });

  it("R76 counts those due later", () => {
    renderFollowUps();
    expect(screen.getByText("9 more due later")).toBeInTheDocument();
  });

  it("R76 ticking one marks it done and removes it from the list straight away", () => {
    const onMarkDone = renderFollowUps(vi.fn(() => new Promise(() => {})));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark done: Chase decision" }));
    expect(onMarkDone).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(screen.queryByText("Chase decision")).toBeNull();
    expect(screen.getByText("Overdue · 1")).toBeInTheDocument();
  });

  it("R76 puts it back with a message if the save fails", async () => {
    renderFollowUps(vi.fn().mockRejectedValue(new Error("down")));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark done: Demo grid analytics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't mark it done.");
    await waitFor(() => expect(screen.getByText("Demo grid analytics")).toBeInTheDocument());
  });

  it("R78 says so when nothing is due", () => {
    renderFollowUps(undefined, { overdue: [], today: [], next7Days: [], laterCount: 0 });
    expect(screen.getByText("No follow-ups due")).toBeInTheDocument();
  });
});
