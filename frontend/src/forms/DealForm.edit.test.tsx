// V-F05 for editing: only what changed is sent, never a cleared link (R34), a new stage brings its
// probability (R15), and organizations and contacts can be added from the pickers (R45, WF-3).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Deal } from "../api/types";
import { fakeApi, json, renderPage } from "../test/app";
import { DealForm } from "./DealForm";

const organization = (id: number, name: string) => ({
  id,
  name,
  website: null,
  industry: null,
  notes: null,
  contact_count: 1,
  open_deal_count: 0,
  open_value: 0,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});
const contact = (id: number, name: string, organizationId: number) => ({
  id,
  name,
  organization_id: organizationId,
  organization_name: null,
  email: null,
  phone: null,
  job_title: null,
  status: "lead",
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});
const ORGANIZATIONS = [organization(1, "Acme Ltd"), organization(2, "Bramble & Oak")];
const CONTACTS = [contact(10, "Ada Shah", 1), contact(12, "Tom Ashworth", 2)];

const deal: Deal = {
  id: 7,
  organizationId: 1,
  organizationName: "Acme Ltd",
  contactId: 10,
  contactName: "Ada Shah",
  name: "Acme renewal",
  stage: "proposal",
  value: 12000,
  probability: 40,
  expectedRevenue: 4800,
  closeDate: "2026-12-10",
  isLate: false,
  position: 1,
  closedAt: null,
  createdAt: "2026-11-01T09:00:00",
  updatedAt: "2026-11-01T09:00:00",
};
const savedDeal = { ...deal, organization_id: 1, contact_id: 10, close_date: "2026-12-10" };

function edit(theDeal: Deal | undefined, routes: Record<string, unknown> = {}) {
  const sent = fakeApi({
    "GET /api/organizations": ORGANIZATIONS,
    "GET /api/contacts": CONTACTS,
    "PATCH /api/deals/7": () => json(200, savedDeal),
    ...routes,
  });
  const onSaved = vi.fn();
  renderPage(<DealForm deal={theDeal} onSaved={onSaved} onCancel={() => {}} />);
  return { sent, onSaved };
}

const patchBody = (sent: { method: string; body: unknown }[]) => sent.find((r) => r.method === "PATCH")?.body;
const picker = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

async function loaded() {
  await screen.findByRole("option", { name: "Ada Shah" });
}

describe("DealForm editing", () => {
  it("R34 sends only the fields that always go, when nothing else changed", async () => {
    const { sent, onSaved } = edit(deal);
    await loaded();
    expect(picker("Organization").value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(patchBody(sent)).toEqual({ name: "Acme renewal", value: 12000, close_date: "2026-12-10" });
  });

  it("R15 sends a new stage with its usual probability, and a changed link", async () => {
    const { sent, onSaved } = edit(deal);
    await loaded();
    fireEvent.change(picker("Stage"), { target: { value: "negotiation" } });
    fireEvent.change(picker("Organization"), { target: { value: "2" } });
    fireEvent.change(picker("Main contact"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(patchBody(sent)).toMatchObject({
      stage: "negotiation",
      probability: 70,
      organization_id: 2,
      contact_id: 12,
    });
  });

  it("R15 sends a probability typed by hand, and never a link left empty (R34)", async () => {
    const { sent, onSaved } = edit({ ...deal, organizationId: null, contactId: null });
    await screen.findByRole("option", { name: "Acme Ltd" });
    expect(picker("Organization").value).toBe("");
    expect(within(picker("Organization")).getByRole("option", { name: "None" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Probability (%)"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = patchBody(sent) as Record<string, unknown>;
    expect(body.probability).toBe(55);
    expect(body).not.toHaveProperty("organization_id");
    expect(body).not.toHaveProperty("contact_id");
  });

  it("R23 clears the contact when another organization is chosen", async () => {
    edit(deal);
    await loaded();
    fireEvent.change(picker("Organization"), { target: { value: "2" } });
    expect(picker("Main contact").value).toBe("");
  });
});

describe("DealForm adding from the pickers", () => {
  it("WF-3 adds an organization and comes back with it chosen", async () => {
    const created = organization(3, "Cobalt Co");
    edit(undefined, {
      "POST /api/organizations": () => json(201, created),
      "GET /api/organizations": [...ORGANIZATIONS, created],
    });
    await screen.findByRole("option", { name: "Acme Ltd" });
    fireEvent.change(picker("Organization"), { target: { value: "__add__" } });
    const panel = screen.getByRole("dialog", { name: "Add organization" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Cobalt Co" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Add organization" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(picker("Organization").value).toBe("3"));
  });

  it("WF-3 closes the add-organization panel on Cancel", async () => {
    edit(undefined);
    await screen.findByRole("option", { name: "Acme Ltd" });
    fireEvent.change(picker("Organization"), { target: { value: "__add__" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("WF-3 adds a contact, choosing its organization too", async () => {
    const created = contact(20, "Zoe Park", 2);
    edit(undefined, {
      "POST /api/contacts": () => json(201, created),
      "GET /api/contacts": [...CONTACTS, created],
    });
    await screen.findByRole("option", { name: "Acme Ltd" });
    expect(within(picker("Main contact")).getByRole("option", { name: "Choose an organization first" })).toBeTruthy();
    fireEvent.change(picker("Main contact"), { target: { value: "__add__" } });
    const panel = screen.getByRole("dialog", { name: "Add contact" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Zoe Park" } });
    fireEvent.change(within(panel).getByLabelText("Organization"), { target: { value: "2" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(picker("Main contact").value).toBe("20"));
    expect(picker("Organization").value).toBe("2");
  });

  it("WF-3 closes the add-contact panel with Escape", async () => {
    edit(undefined);
    await screen.findByRole("option", { name: "Acme Ltd" });
    fireEvent.change(picker("Main contact"), { target: { value: "__add__" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
