// R51, R53: a contact's details, organization, deals, "Log activity", timeline, edit, add deal, delete and not found.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { ContactPage } from "./ContactPage";

const ADA = {
  id: 1,
  name: "Ada Shah",
  organization_id: 5,
  organization_name: "Acme Ltd",
  email: "ada@acme.example",
  phone: null,
  job_title: "Buyer",
  status: "qualified",
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
};

const deal = (id: number, name: string, stage: string, contactId: number, isLate = false) => ({
  id,
  organization_id: 5,
  organization_name: "Acme Ltd",
  contact_id: contactId,
  contact_name: "Ada Shah",
  name,
  stage,
  value: 12000,
  probability: 50,
  expected_revenue: 6000,
  close_date: "2026-12-15",
  is_late: isLate,
  position: id,
  closed_at: stage === "won" ? "2026-11-10T10:00:00" : null,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

const DEALS = [
  deal(7, "Acme renewal", "proposal", 1, true),
  deal(8, "Acme pilot", "won", 1),
  deal(9, "Other", "new", 2),
];

function openAda(routes: Record<string, unknown> = {}) {
  const sent = fakeApi({ "GET /api/contacts/1": ADA, "GET /api/deals": DEALS, ...routes });
  renderPage(<ContactPage />, { at: "/contacts/1", path: "/contacts/:id" });
  return sent;
}

describe("ContactPage", () => {
  it("shows the contact's details, organization link and only their deals", async () => {
    openAda();

    expect(await screen.findByRole("heading", { name: /Ada Shah/ })).toHaveTextContent("Qualified");
    expect(screen.getByRole("link", { name: "Acme Ltd" })).toHaveAttribute("href", "/organizations/5");
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.example")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    expect(await screen.findByText("Deals · 2")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Deals" });
    expect(within(list).getByRole("link", { name: "Acme renewal" })).toHaveAttribute("href", "/deals/7");
    expect(within(list).queryByText("Other")).not.toBeInTheDocument();
    expect(
      within(list)
        .getByText(/closes/)
        .closest(".meta"),
    ).toHaveClass("late-text");
    expect(within(list).getByText(/closed/)).toBeInTheDocument();
  });

  it("says when the contact has no organization or deals", async () => {
    fakeApi({
      "GET /api/contacts/1": { ...ADA, organization_id: null, organization_name: null },
      "GET /api/deals": [],
    });
    renderPage(<ContactPage />, { at: "/contacts/1", path: "/contacts/:id" });

    expect(await screen.findByText("No deals yet")).toBeInTheDocument();
    expect(screen.getByText("Organization").nextElementSibling).toHaveTextContent("None");
  });

  it("shows the timeline once the contact has loaded", async () => {
    const sent = openAda({
      "GET /api/contacts/1/timeline": [
        {
          kind: "activity",
          id: 3,
          type: "call",
          from_stage: null,
          to_stage: null,
          description: "Talked pricing",
          at: "2026-11-20T10:00:00",
          source: { kind: "contact", id: 1, name: "Ada Shah" },
        },
      ],
    });
    expect(await screen.findByText("Talked pricing")).toBeInTheDocument();
    expect(sent.some((r) => r.url === "/api/contacts/1/timeline")).toBe(true);
  });

  it("says the contact doesn't exist for an unknown id", async () => {
    fakeApi({ "GET /api/contacts/99": () => json(404, { error: { code: "not_found", message: "Gone" } }) });
    renderPage(<ContactPage />, { at: "/contacts/99", path: "/contacts/:id" });
    expect(await screen.findByRole("heading", { name: "This contact no longer exists" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to contacts" })).toHaveAttribute("href", "/contacts");
  });

  it("says the contact doesn't exist when the address isn't an id", () => {
    fakeApi();
    renderPage(<ContactPage />, { at: "/contacts/abc", path: "/contacts/:id" });
    expect(screen.getByRole("heading", { name: "This contact no longer exists" })).toBeInTheDocument();
  });

  it("edits the contact in the side panel", async () => {
    openAda({ "PATCH /api/contacts/1": (body: unknown) => json(200, { ...ADA, ...(body as object) }) });
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const panel = await screen.findByRole("dialog", { name: "Edit contact" });
    expect(within(panel).getByLabelText("Name")).toHaveValue("Ada Shah");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("adds a deal for the contact, with the contact and their organization chosen", async () => {
    openAda({
      "GET /api/organizations": [
        {
          id: 5,
          name: "Acme Ltd",
          website: null,
          industry: null,
          notes: null,
          contact_count: 1,
          open_deal_count: 1,
          open_value: 12000,
          created_at: "2026-11-01T09:00:00",
          updated_at: "2026-11-01T09:00:00",
        },
      ],
      "GET /api/contacts": [ADA],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Add deal" }));

    const panel = await screen.findByRole("dialog", { name: "Add deal" });
    await waitFor(() => expect(within(panel).getByLabelText("Main contact")).toHaveDisplayValue("Ada Shah"));
    expect(within(panel).getByLabelText("Organization")).toHaveDisplayValue("Acme Ltd");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("deletes the contact and goes back to the contacts list", async () => {
    openAda({
      "GET /api/contacts/1/delete-impact": { deals_kept: 2, activities_deleted: 0 },
      "DELETE /api/contacts/1": () => json(204),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete Ada Shah?" });
    expect(await within(dialog).findByText(/Their 2 deals will be kept/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });
});
