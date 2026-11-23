// R40–R47 for contacts: the list, the status filter with counts, opening a contact, add, edit and delete (R44).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi, json, renderPage } from "../../test/app";
import { ContactsPage } from "./ContactsPage";

const contact = (id: number, name: string, status: string, organization: [number, string] | null) => ({
  id,
  name,
  organization_id: organization?.[0] ?? null,
  organization_name: organization?.[1] ?? null,
  email: id === 1 ? "ada@acme.example" : null,
  phone: id === 1 ? "+44 20 7946 0000" : null,
  job_title: id === 1 ? "Buyer" : null,
  status,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

const CONTACTS = [
  contact(1, "Ada Shah", "lead", [5, "Acme Ltd"]),
  contact(2, "Ben Cole", "customer", [5, "Acme Ltd"]),
  contact(3, "Cara Lin", "lead", null),
];

function openRowMenu(name: string) {
  const row = screen.getByText(name).closest("tr") as HTMLElement;
  fireEvent.keyDown(within(row).getByRole("button", { name: "Row actions" }), { key: "Enter" });
}

describe("ContactsPage", () => {
  it("lists every contact with its organization link, details and status", async () => {
    fakeApi({ "GET /api/contacts": CONTACTS });
    renderPage(<ContactsPage />);

    expect(await screen.findByText("Ada Shah")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Acme Ltd" })[0]).toHaveAttribute("href", "/organizations/5");
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.example")).toBeInTheDocument();
    const cara = screen.getByText("Cara Lin").closest("tr") as HTMLElement;
    expect(within(cara).getByText("None")).toBeInTheDocument();
  });

  it("shows a loading line, then the error with its reference when the list can't be read", async () => {
    fakeApi({
      "GET /api/contacts": () => json(500, { error: { code: "internal", message: "Boom", request_id: "9f2c1a7b00" } }),
    });
    renderPage(<ContactsPage />);

    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the contacts. Check the app is still running and try again. Reference: 9f2c1a7b",
    );
  });

  it("filters by status, with a count on each segment and its own empty message", async () => {
    fakeApi({ "GET /api/contacts": CONTACTS });
    renderPage(<ContactsPage />);
    await screen.findByText("Ada Shah");
    const filter = screen.getByRole("group", { name: "Status" });

    expect(within(filter).getByRole("button", { name: "All 3" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(filter).getByRole("button", { name: "Lead 2" }));
    expect(screen.queryByText("Ben Cole")).not.toBeInTheDocument();
    expect(screen.getByText("Cara Lin")).toBeInTheDocument();

    fireEvent.click(within(filter).getByRole("button", { name: "Qualified 0" }));
    expect(screen.getByText("No qualified contacts yet")).toBeInTheDocument();
  });

  it("says there are no contacts yet when the list is empty", async () => {
    fakeApi({ "GET /api/contacts": [] });
    renderPage(<ContactsPage />);
    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
  });

  it("opens a contact's page when its row is clicked", async () => {
    fakeApi({ "GET /api/contacts": CONTACTS });
    renderPage(<ContactsPage />, { at: "/contacts", path: "/contacts" });
    fireEvent.click(await screen.findByText("Ben Cole"));
    expect(await screen.findByText("Left the page")).toBeInTheDocument();
  });

  it("adds a contact in the side panel", async () => {
    fakeApi({ "GET /api/contacts": CONTACTS });
    renderPage(<ContactsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add contact" }));

    const panel = await screen.findByRole("dialog", { name: "Add contact" });
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edits a contact from its row menu and closes the panel once saved", async () => {
    const sent = fakeApi({
      "GET /api/contacts": CONTACTS,
      "PATCH /api/contacts/1": (body: unknown) => json(200, { ...CONTACTS[0], ...(body as object) }),
    });
    renderPage(<ContactsPage />);
    await screen.findByText("Ada Shah");
    openRowMenu("Ada Shah");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));

    const panel = await screen.findByRole("dialog", { name: "Edit contact" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Ada Shah-Cole" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent.find((r) => r.method === "PATCH")?.body).toMatchObject({ name: "Ada Shah-Cole" });
  });

  it("deletes a contact from its row menu after saying what happens to their records", async () => {
    const sent = fakeApi({
      "GET /api/contacts": CONTACTS,
      "GET /api/contacts/2/delete-impact": { deals_kept: 1, activities_deleted: 3 },
      "DELETE /api/contacts/2": () => json(204),
    });
    renderPage(<ContactsPage />);
    await screen.findByText("Ben Cole");
    openRowMenu("Ben Cole");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete Ben Cole?" });
    expect(await within(dialog).findByText(/Their 1 deal will be kept/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent.some((r) => r.method === "DELETE" && r.url === "/api/contacts/2")).toBe(true);
  });
});
