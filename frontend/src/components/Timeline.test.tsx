// V-F06: timeline entries (R50–R55): activities and stage changes, where each came from, follow-ups and actions.
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { Activity } from "../api/types";
import { Timeline, type TimelineItem } from "./Timeline";

const activity: Activity = {
  id: 1,
  type: "call",
  contactId: null,
  dealId: 7,
  description: "Called about pricing",
  occurredAt: "2026-11-21T10:00:00",
  followUpDate: "2026-11-25",
  done: false,
};

const call: TimelineItem = {
  kind: "activity",
  id: 1,
  type: "call",
  fromStage: null,
  toStage: null,
  description: "Called about pricing",
  at: "2026-11-21T10:00:00",
  source: { kind: "deal", id: 7, name: "Acme renewal" },
  activity,
};
const created: TimelineItem = {
  kind: "stage_change",
  id: 2,
  type: null,
  fromStage: null,
  toStage: "new",
  description: null,
  at: "2026-11-20T09:00:00",
  source: { kind: "deal", id: 7, name: "Acme renewal" },
};
const moved: TimelineItem = { ...created, id: 3, fromStage: "new", toStage: "qualified" };
const note: TimelineItem = {
  ...call,
  id: 4,
  type: "note",
  description: "Met at the fair",
  source: { kind: "contact", id: 10, name: "Ada Shah" },
  activity: undefined,
};

function show(props: Partial<Parameters<typeof Timeline>[0]> = {}) {
  return render(
    <MemoryRouter>
      <Timeline items={[call, moved, created, note]} {...props} />
    </MemoryRouter>,
  );
}

describe("Timeline", () => {
  it("R55 says when there's nothing yet", () => {
    render(<Timeline items={[]} emptyMessage="No activity yet" />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("R52 titles activities by their description and stage changes by the move", () => {
    show();
    expect(screen.getByText("Called about pricing")).toBeInTheDocument();
    expect(screen.getByText("Moved from New to Qualified")).toBeInTheDocument();
    expect(screen.getByText("Created at New")).toBeInTheDocument();
    expect(screen.getByLabelText("call")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Stage change")).toHaveLength(2);
    expect(screen.getAllByText("Today, 10:00")).toHaveLength(2);
    expect(screen.getAllByText("Yesterday, 09:00")).toHaveLength(2);
  });

  it("R54 links each entry to the deal or contact it came from when asked", () => {
    show({ showSource: true });
    expect(screen.getAllByRole("link", { name: "Acme renewal" })[0]).toHaveAttribute("href", "/deals/7");
    expect(screen.getByRole("link", { name: "Ada Shah" })).toHaveAttribute("href", "/contacts/10");
  });

  it("R54 leaves the source out by default", () => {
    show();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("R55 shows a follow-up that can be ticked only when the page allows it", () => {
    show();
    const box = screen.getByRole("checkbox", { name: /Follow up 25 Nov/ });
    expect(box).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("R55 ticks a follow-up and offers edit and delete on activities only", () => {
    const onToggleDone = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    show({ onToggleDone, onEdit, onDelete });
    fireEvent.click(screen.getByRole("checkbox", { name: /Follow up/ }));
    expect(onToggleDone).toHaveBeenCalledWith(activity, true);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(activity);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(activity);
  });

  it("R55 marks a done follow-up, and can offer delete alone", () => {
    render(
      <Timeline
        items={[{ ...call, activity: { ...activity, done: true } }]}
        onDelete={() => {}}
        onToggleDone={() => {}}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Follow up 25 Nov · Done/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
