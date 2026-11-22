// V-F06: an organization is required on create, and "Add organization" in the picker adds one
// without leaving the form, then comes back with it chosen (R11, R45, WF-3).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Contact } from "../api/types";
import { ContactForm } from "./ContactForm";

const org = (id: number, name: string) => ({
  id,
  name,
  website: null,
  industry: null,
  notes: null,
  contact_count: 0,
  open_deal_count: 0,
  open_value: 0,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(contact?: Contact) {
  const organizations = [org(1, "Acme Ltd")];
  const calls: { method: string; url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        calls.push({ method, url, body });
        if (url === "/api/organizations") {
          const created = org(2, String(body.name));
          organizations.push(created);
          return json(201, created);
        }
        return json(method === "POST" ? 201 : 200, { id: 5, organization_id: 2, organization_name: "x", ...body });
      }
      if (url === "/api/organizations") return json(200, organizations);
      return json(200, []);
    }),
  );
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ContactForm contact={contact} onSaved={onSaved} onCancel={() => {}} />
    </QueryClientProvider>,
  );
  return { calls, onSaved };
}

const picker = () => screen.getByLabelText("Organization") as HTMLSelectElement;

afterEach(() => vi.unstubAllGlobals());

describe("ContactForm", () => {
  it("R11 needs an organization on create, for a lead too", async () => {
    const { calls } = setup();
    await screen.findByRole("option", { name: "Acme Ltd" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Shah" } });
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("lead");
    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    expect(await screen.findByText("Choose an organization.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("R21 checks the email and phone shapes", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "call me" } });
    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    expect(await screen.findByText("Enter an email like name@example.com.")).toBeInTheDocument();
    expect(screen.getByText("Use only digits, spaces and + ( ) - . in a phone number.")).toBeInTheDocument();
  });

  it("R45 adds an organization from the picker and comes back with it chosen", async () => {
    const { calls, onSaved } = setup();
    await screen.findByRole("option", { name: "Acme Ltd" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Shah" } });
    fireEvent.change(picker(), { target: { value: "__add__" } });

    const dialog = await screen.findByRole("dialog", { name: "Add organization" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Fernhill Foods" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add organization" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add organization" })).toBeNull());
    await waitFor(() => expect(picker().value).toBe("2"));
    expect(within(picker()).getByRole("option", { name: "Fernhill Foods" })).toBeInTheDocument();
    // What was typed in the contact form is still there.
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada Shah");

    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", "/api/organizations"],
      ["POST", "/api/contacts"],
    ]);
    expect(calls[1]?.body).toMatchObject({ name: "Ada Shah", organization_id: 2, status: "lead" });
  });

  it("R34 an edit keeps a link a delete cleared, without sending it", async () => {
    const contact: Contact = {
      id: 5,
      organizationId: null,
      organizationName: null,
      name: "Ada Shah",
      email: null,
      phone: null,
      jobTitle: null,
      status: "qualified",
      createdAt: "2026-11-01T09:00:00",
      updatedAt: "2026-11-01T09:00:00",
    };
    const { calls, onSaved } = setup(contact);
    await screen.findByRole("option", { name: "Acme Ltd" });
    expect(picker().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[0]?.body).not.toHaveProperty("organization_id");
  });
});
