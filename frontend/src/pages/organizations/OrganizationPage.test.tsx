// R50, R56: an organization's details, its contacts and deals, the combined timeline, edit, add contact or deal,
// delete, and not found. Websites are links only for http and https (SEC-6).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { OrganizationPage } from "./OrganizationPage";

const ACME = {
  id: 5,
  name: "Acme Ltd",
  website: "https://acme.example",
  industry: "Manufacturing",
  notes: "Prefers email.",
  contact_count: 2,
  open_deal_count: 1,
  open_value: 12000,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
};

const contact = (id: number, name: string, organizationId: number, jobTitle: string | null) => ({
  id,
  name,
  organization_id: organizationId,
  organization_name: "Acme Ltd",
  email: null,
  phone: null,
  job_title: jobTitle,
  status: "customer",
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

const deal = (id: number, name: string, stage: string, organizationId: number, isLate: boolean) => ({
  id,
  organization_id: organizationId,
  organization_name: "Acme Ltd",
  contact_id: 1,
  contact_name: "Ada Shah",
  name,
  stage,
  value: 12000,
  probability: 50,
  expected_revenue: 6000,
  close_date: "2026-11-15",
  is_late: isLate,
  position: id,
  closed_at: null,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

const CONTACTS = [
  contact(1, "Ada Shah", 5, "Buyer"),
  contact(2, "Ben Cole", 5, null),
  contact(3, "Elsewhere", 6, null),
];
const DEALS = [deal(7, "Acme renewal", "negotiation", 5, true), deal(8, "Acme lost", "lost", 5, false)];

function openAcme(organization: object = ACME, routes: Record<string, unknown> = {}) {
  const sent = fakeApi({
    "GET /api/organizations/5": organization,
    "GET /api/contacts": CONTACTS,
    "GET /api/deals": DEALS,
    ...routes,
  });
  renderPage(<OrganizationPage />, { at: "/organizations/5", path: "/organizations/:id" });
  return sent;
}

describe("OrganizationPage", () => {
  it("shows the details, with the website as a safe link", async () => {
    openAcme();

    expect(await screen.findByRole("heading", { name: "Acme Ltd" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "https://acme.example" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Manufacturing")).toBeInTheDocument();
    expect(screen.getByText("Prefers email.")).toBeInTheDocument();
    expect(screen.getByText("1 · $12,000")).toBeInTheDocument();
  });

  it("lists only this organization's contacts and deals", async () => {
    openAcme();

    expect(await screen.findByText("Contacts · 2")).toBeInTheDocument();
    const people = screen.getByRole("list", { name: "Contacts" });
    expect(within(people).getByRole("link", { name: "Ada Shah" })).toHaveAttribute("href", "/contacts/1");
    expect(within(people).getByText("Buyer")).toBeInTheDocument();
    expect(within(people).queryByText("Elsewhere")).not.toBeInTheDocument();

    const deals = screen.getByRole("list", { name: "Deals" });
    expect(within(deals).getByRole("link", { name: "Acme renewal" })).toHaveAttribute("href", "/deals/7");
    expect(
      within(deals)
        .getByText(/closes/)
        .closest(".meta"),
    ).toHaveClass("late-text");
    expect(
      within(deals)
        .getByText(/closed/)
        .closest(".meta"),
    ).not.toHaveClass("late-text");
  });

  it("shows None for missing details, and the empty lines and timeline", async () => {
    fakeApi({
      "GET /api/organizations/5": { ...ACME, website: null, industry: null, notes: null },
      "GET /api/contacts": [],
      "GET /api/deals": [],
    });
    renderPage(<OrganizationPage />, { at: "/organizations/5", path: "/organizations/:id" });

    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
    expect(screen.getByText("No deals yet")).toBeInTheDocument();
    expect(screen.getAllByText("None")).toHaveLength(3);
    expect(await screen.findByText("Nothing logged yet")).toBeInTheDocument();
  });

  it("shows a website that isn't http or https as text", async () => {
    openAcme({ ...ACME, website: "ftp://acme.example" });
    expect(await screen.findByText("ftp://acme.example")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ftp://acme.example" })).not.toBeInTheDocument();
  });

  it("says the organization doesn't exist for an unknown id", async () => {
    fakeApi({ "GET /api/organizations/99": () => json(404, { error: { code: "not_found", message: "Gone" } }) });
    renderPage(<OrganizationPage />, { at: "/organizations/99", path: "/organizations/:id" });
    expect(await screen.findByRole("heading", { name: "This organization no longer exists" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to organizations" })).toHaveAttribute("href", "/organizations");
  });

  it("says the organization doesn't exist when the address isn't an id", () => {
    fakeApi();
    renderPage(<OrganizationPage />, { at: "/organizations/0", path: "/organizations/:id" });
    expect(screen.getByRole("heading", { name: "This organization no longer exists" })).toBeInTheDocument();
  });

  it("shows the error when the organization can't be read", async () => {
    fakeApi({ "GET /api/organizations/5": () => json(500, { error: { code: "internal", message: "Boom" } }) });
    renderPage(<OrganizationPage />, { at: "/organizations/5", path: "/organizations/:id" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the organization.");
  });

  it("edits the organization, and adds a contact or a deal for it, in the side panel", async () => {
    openAcme(ACME, { "GET /api/organizations": [ACME] });

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    let panel = await screen.findByRole("dialog", { name: "Edit organization" });
    expect(within(panel).getByLabelText("Name")).toHaveValue("Acme Ltd");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    panel = await screen.findByRole("dialog", { name: "Add contact" });
    await waitFor(() => expect(within(panel).getByLabelText("Organization")).toHaveDisplayValue("Acme Ltd"));
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    panel = await screen.findByRole("dialog", { name: "Add deal" });
    await waitFor(() => expect(within(panel).getByLabelText("Organization")).toHaveDisplayValue("Acme Ltd"));
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("deletes the organization and goes back to the list", async () => {
    openAcme(ACME, {
      "GET /api/organizations/5/delete-impact": { contacts_kept: 2, deals_kept: 2 },
      "DELETE /api/organizations/5": () => json(204),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Acme Ltd?" });
    expect(await within(dialog).findByText(/Its 2 contacts and 2 deals will be kept/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });
});
