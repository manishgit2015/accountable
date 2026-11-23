// R40–R47 for organizations: the list with its figures, safe website links (SEC-6), open, add, edit and delete (R44).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { OrganizationsPage } from "./OrganizationsPage";

const organization = (id: number, name: string, website: string | null) => ({
  id,
  name,
  website,
  industry: id === 1 ? "Manufacturing" : null,
  notes: null,
  contact_count: id,
  open_deal_count: 1,
  open_value: 25000,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

const ORGANIZATIONS = [
  organization(1, "Acme Ltd", "https://acme.example/"),
  organization(2, "Bramble & Oak", "javascript:alert(1)"),
  organization(3, "Cobalt", null),
];

function openRowMenu(name: string) {
  const row = screen.getByText(name).closest("tr") as HTMLElement;
  fireEvent.keyDown(within(row).getByRole("button", { name: "Row actions" }), { key: "Enter" });
}

describe("OrganizationsPage", () => {
  it("lists organizations with their industry, website and open figures", async () => {
    fakeApi({ "GET /api/organizations": ORGANIZATIONS });
    renderPage(<OrganizationsPage />);

    const acme = (await screen.findByText("Acme Ltd")).closest("tr") as HTMLElement;
    expect(within(acme).getByText("Manufacturing")).toBeInTheDocument();
    const link = within(acme).getByRole("link", { name: "acme.example" });
    expect(link).toHaveAttribute("href", "https://acme.example/");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(acme).getByText("$25,000")).toBeInTheDocument();
  });

  it("shows a website that isn't http or https as plain text, never a link", async () => {
    fakeApi({ "GET /api/organizations": ORGANIZATIONS });
    renderPage(<OrganizationsPage />);
    const bramble = (await screen.findByText("Bramble & Oak")).closest("tr") as HTMLElement;
    expect(within(bramble).getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(within(bramble).queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens an organization's page when its row is clicked", async () => {
    fakeApi({ "GET /api/organizations": ORGANIZATIONS });
    renderPage(<OrganizationsPage />, { at: "/organizations", path: "/organizations" });
    fireEvent.click(await screen.findByText("Cobalt"));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });

  it("adds an organization in the side panel and closes it once saved", async () => {
    const sent = fakeApi({
      "GET /api/organizations": ORGANIZATIONS,
      "POST /api/organizations": (body: unknown) => json(201, { ...organization(4, "", null), ...(body as object) }),
    });
    renderPage(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add organization" }));

    const panel = await screen.findByRole("dialog", { name: "Add organization" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Delta Co" } });
    fireEvent.change(within(panel).getByLabelText("Website"), { target: { value: "  " } });
    fireEvent.click(within(panel).getByRole("button", { name: "Add organization" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent.find((r) => r.method === "POST")?.body).toEqual({
      name: "Delta Co",
      website: null,
      industry: null,
      notes: null,
    });
  });

  it("edits an organization from its row menu", async () => {
    fakeApi({ "GET /api/organizations": ORGANIZATIONS });
    renderPage(<OrganizationsPage />);
    await screen.findByText("Acme Ltd");
    openRowMenu("Acme Ltd");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));

    const panel = await screen.findByRole("dialog", { name: "Edit organization" });
    expect(within(panel).getByLabelText("Industry")).toHaveValue("Manufacturing");
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("deletes an organization from its row menu", async () => {
    const sent = fakeApi({
      "GET /api/organizations": ORGANIZATIONS,
      "GET /api/organizations/3/delete-impact": { contacts_kept: 3, deals_kept: 1 },
      "DELETE /api/organizations/3": () => json(204),
    });
    renderPage(<OrganizationsPage />);
    await screen.findByText("Cobalt");
    openRowMenu("Cobalt");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete Cobalt?" });
    expect(await within(dialog).findByText(/Its 3 contacts and 1 deal will be kept/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent.some((r) => r.method === "DELETE" && r.url === "/api/organizations/3")).toBe(true);
  });
});
