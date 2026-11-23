// V-F07: a deal's page (R52, R53, R56): details and links, the late warning, the stage picker,
// edit, delete, logging an activity and the timeline.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { DealPage } from "./DealPage";

const deal = {
  id: 7,
  organization_id: 1,
  organization_name: "Acme Ltd",
  contact_id: 10,
  contact_name: "Ada Shah",
  name: "Acme renewal",
  stage: "proposal",
  value: 12000,
  probability: 40,
  expected_revenue: 4800,
  close_date: "2026-11-10",
  is_late: true,
  position: 1,
  closed_at: null,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
};
const timeline = [
  {
    kind: "stage_change",
    id: 3,
    type: null,
    from_stage: "new",
    to_stage: "proposal",
    description: null,
    at: "2026-11-15T09:00:00",
    source: { kind: "deal", id: 7, name: "Acme renewal" },
  },
];

const open = (routes: Record<string, unknown> = {}, at = "/deals/7") => {
  const sent = fakeApi({ "GET /api/deals/7": deal, "GET /api/deals/7/timeline": timeline, ...routes });
  renderPage(<DealPage />, { at, path: "/deals/:id" });
  return sent;
};

describe("DealPage", () => {
  it("R52 shows the deal's details, links and timeline, and warns when it's late", async () => {
    open();
    expect(await screen.findByRole("heading", { name: /Acme renewal/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This deal is running late: its close date was 10 Nov 2026.");
    expect(screen.getByRole("link", { name: "Acme Ltd" })).toHaveAttribute("href", "/organizations/1");
    expect(screen.getByRole("link", { name: "Ada Shah" })).toHaveAttribute("href", "/contacts/10");
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect((screen.getByLabelText("Stage") as HTMLSelectElement).value).toBe("proposal");
    expect(await screen.findByText("Moved from New to Proposal")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Log activity" })).toBeInTheDocument();
  });

  it("R52 shows None for cleared links, and when a closed deal closed", async () => {
    open({
      "GET /api/deals/7": {
        ...deal,
        organization_id: null,
        contact_id: null,
        stage: "won",
        is_late: false,
        closed_at: "2026-11-20T16:00:00",
      },
    });
    expect(await screen.findByText("Closed")).toBeInTheDocument();
    expect(screen.getAllByText("None")).toHaveLength(2);
    expect(screen.getByText("Yesterday, 16:00")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("R56 says a deal that doesn't exist, or a bad address, no longer exists", async () => {
    open({ "GET /api/deals/7": () => json(404, { error: { code: "not_found", message: "Not found." } }) });
    expect(await screen.findByRole("heading", { name: "This deal no longer exists" })).toBeInTheDocument();
  });

  it("R56 treats an address that isn't a deal number as missing", () => {
    open({}, "/deals/abc");
    expect(screen.getByRole("heading", { name: "This deal no longer exists" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals");
  });

  it("R52 changes the stage on the server", async () => {
    const sent = open({ "PATCH /api/deals/7": () => json(200, { ...deal, stage: "negotiation" }) });
    fireEvent.change(await screen.findByLabelText("Stage"), { target: { value: "negotiation" } });
    await waitFor(() => expect(sent.find((r) => r.method === "PATCH")?.body).toEqual({ stage: "negotiation" }));
  });

  it("R52 says when the stage couldn't be changed", async () => {
    open({ "PATCH /api/deals/7": () => json(500, { error: { code: "internal", message: "Boom" } }) });
    fireEvent.change(await screen.findByLabelText("Stage"), { target: { value: "won" } });
    expect(await screen.findByText(/Couldn't change the stage/)).toBeInTheDocument();
  });

  it("R52 edits the deal in a side panel", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const panel = screen.getByRole("dialog", { name: "Edit deal" });
    expect(within(panel).getByLabelText("Name")).toHaveValue("Acme renewal");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("R30 R33 deletes the deal after asking, then goes back to the deals", async () => {
    const sent = open({
      "GET /api/deals/7/delete-impact": { activities_deleted: 2, stage_changes_deleted: 1 },
      "DELETE /api/deals/7": () => json(204),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete Acme renewal?" });
    expect(await within(dialog).findByText(/Its 2 activities and 1 stage change will be deleted/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
    expect(sent.some((r) => r.method === "DELETE" && r.url === "/api/deals/7")).toBe(true);
  });
});
