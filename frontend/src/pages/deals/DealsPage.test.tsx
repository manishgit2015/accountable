// V-F03 for deals: the R44 columns, late close dates (R19), soonest first (R47), opening a deal, and
// add, edit and delete from the table (R40–R42).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { DealsPage } from "./DealsPage";

const deal = (id: number, name: string, closeDate: string, extra: Record<string, unknown> = {}) => ({
  id,
  organization_id: 1,
  organization_name: "Acme Ltd",
  contact_id: 10,
  contact_name: "Ada Shah",
  name,
  stage: "qualified",
  value: 5000,
  probability: 20,
  expected_revenue: 1000,
  close_date: closeDate,
  is_late: false,
  position: id,
  closed_at: null,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
  ...extra,
});
const DEALS = [
  deal(1, "Later deal", "2026-12-20"),
  deal(2, "Late deal", "2026-11-02", { is_late: true, stage: "negotiation" }),
  deal(3, "Orphan deal", "2026-12-01", { organization_id: null, contact_id: null }),
];

function open(routes: Record<string, unknown> = {}) {
  const sent = fakeApi({ "GET /api/deals": DEALS, ...routes });
  renderPage(<DealsPage />, { at: "/deals", path: "/deals" });
  return sent;
}

const bodyRows = () => screen.getAllByRole("row").slice(1);

/** Radix opens its menu on a pointer press. */
function chooseRowAction(row: HTMLElement, action: string) {
  const trigger = within(row).getByRole("button", { name: "Row actions" });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(screen.getByRole("menuitem", { name: action }));
}

describe("DealsPage", () => {
  it("R44 R47 lists deals with their links, soonest close date first, and flags late ones", async () => {
    open();
    expect(await screen.findByText("Late deal")).toBeInTheDocument();
    const rows = bodyRows();
    expect(rows.map((r) => within(r).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Late deal",
      "Orphan deal",
      "Later deal",
    ]);
    expect(within(rows[0] as HTMLElement).getByText("Late")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Negotiation")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: "Acme Ltd" })).toHaveAttribute(
      "href",
      "/organizations/1",
    );
    expect(within(rows[1] as HTMLElement).getAllByText("None")).toHaveLength(2);
  });

  it("R47 sorts by stage in pipeline order and by close date", async () => {
    open();
    await screen.findByText("Late deal");
    fireEvent.click(screen.getByRole("button", { name: /Stage/ }));
    expect(within(bodyRows()[0] as HTMLElement).getByText("Qualified")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close date/ }));
    expect(within(bodyRows()[0] as HTMLElement).getByText("Late deal")).toBeInTheDocument();
  });

  it("R43 opens a deal from its row", async () => {
    open();
    fireEvent.click(await screen.findByText("Later deal"));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });

  it("R40 adds a deal in a side panel", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Add deal" }));
    const panel = screen.getByRole("dialog", { name: "Add deal" });
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("R42 edits a deal from its row's menu, and closes with Escape", async () => {
    open();
    await screen.findByText("Later deal");
    chooseRowAction(bodyRows()[2] as HTMLElement, "Edit");
    const panel = await screen.findByRole("dialog", { name: "Edit deal" });
    expect(within(panel).getByLabelText("Name")).toHaveValue("Later deal");
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("R42 deletes a deal from its row's menu after asking", async () => {
    const sent = open({
      "GET /api/deals/1/delete-impact": { activities_deleted: 1, stage_changes_deleted: 2 },
      "DELETE /api/deals/1": () => json(204),
    });
    await screen.findByText("Later deal");
    chooseRowAction(bodyRows()[2] as HTMLElement, "Delete");
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Later deal?" });
    await within(dialog).findByText(/Its 1 activity and 2 stage changes will be deleted/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent.some((r) => r.method === "DELETE" && r.url === "/api/deals/1")).toBe(true);
  });

  it("R30 closes the delete dialog on Cancel and deletes nothing", async () => {
    const sent = open({ "GET /api/deals/1/delete-impact": { activities_deleted: 0, stage_changes_deleted: 1 } });
    await screen.findByText("Later deal");
    chooseRowAction(bodyRows()[2] as HTMLElement, "Delete");
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Later deal?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent.some((r) => r.method === "DELETE")).toBe(false);
  });
});
