// V-F05: field messages, probability filled in from the stage with override, contacts filtered by
// organization, the server's messages shown, and Save disabled while saving (R15, R23, R45, R48, REL-5).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DealForm } from "./DealForm";

const ORGANIZATIONS = [
  {
    id: 1,
    name: "Acme Ltd",
    website: null,
    industry: null,
    notes: null,
    contact_count: 2,
    open_deal_count: 0,
    open_value: 0,
    created_at: "2026-11-01T09:00:00",
    updated_at: "2026-11-01T09:00:00",
  },
  {
    id: 2,
    name: "Bramble & Oak",
    website: null,
    industry: null,
    notes: null,
    contact_count: 1,
    open_deal_count: 0,
    open_value: 0,
    created_at: "2026-11-01T09:00:00",
    updated_at: "2026-11-01T09:00:00",
  },
];
const contact = (id: number, name: string, organization_id: number) => ({
  id,
  name,
  organization_id,
  organization_name: organization_id === 1 ? "Acme Ltd" : "Bramble & Oak",
  email: null,
  phone: null,
  job_title: null,
  status: "lead",
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
});
const CONTACTS = [contact(10, "Ada Shah", 1), contact(11, "Ben Cole", 1), contact(12, "Tom Ashworth", 2)];

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type PostHandler = (body: Record<string, unknown>) => Response | Promise<Response>;

function setup(onPost: PostHandler = (body) => json(201, { id: 99, ...body })) {
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        posts.push(body);
        return onPost(body);
      }
      if (url === "/api/organizations") return json(200, ORGANIZATIONS);
      if (url === "/api/contacts") return json(200, CONTACTS);
      return json(200, []);
    }),
  );
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DealForm onSaved={onSaved} onCancel={() => {}} />
    </QueryClientProvider>,
  );
  return { posts, onSaved };
}

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const optionLabels = (el: HTMLSelectElement) =>
  within(el)
    .getAllByRole("option")
    .map((o) => o.textContent);

async function fillValid() {
  await screen.findByRole("option", { name: "Acme Ltd" });
  fireEvent.change(input("Name"), { target: { value: "Fleet pilot" } });
  fireEvent.change(select("Organization"), { target: { value: "1" } });
  fireEvent.change(select("Main contact"), { target: { value: "10" } });
  fireEvent.change(input("Value (USD)"), { target: { value: "18000" } });
  fireEvent.change(input("Close date"), { target: { value: "2026-12-18" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("DealForm", () => {
  it("R45 R12 says what's wrong next to each field and sends nothing", async () => {
    const { posts } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Choose an organization.")).toBeInTheDocument();
    expect(screen.getByText("Choose a contact.")).toBeInTheDocument();
    expect(screen.getByText("Enter a value.")).toBeInTheDocument();
    expect(screen.getByText("Enter a close date.")).toBeInTheDocument();
    expect(input("Name")).toHaveAttribute("aria-invalid", "true");
    expect(posts).toEqual([]);
  });

  it("R21 checks the value and probability bounds", async () => {
    setup();
    await fillValid();
    fireEvent.change(input("Value (USD)"), { target: { value: "1000000001" } });
    fireEvent.change(input("Probability (%)"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByText("Enter a whole number of dollars from 0 to 1,000,000,000.")).toBeInTheDocument();
    expect(screen.getByText("Enter a whole-number percentage from 0 to 100.")).toBeInTheDocument();
  });

  it("R15 fills in the stage's usual probability, which can be overwritten before saving", async () => {
    const { posts } = setup();
    expect(input("Probability (%)").value).toBe("5");
    fireEvent.change(select("Stage"), { target: { value: "proposal" } });
    expect(input("Probability (%)").value).toBe("40");
    fireEvent.change(select("Stage"), { target: { value: "negotiation" } });
    expect(input("Probability (%)").value).toBe("70");
    await fillValid();
    fireEvent.change(input("Probability (%)"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ stage: "negotiation", probability: 55, value: 18000, contact_id: 10 });
  });

  it("R23 lists only the chosen organization's contacts", async () => {
    setup();
    await screen.findByRole("option", { name: "Acme Ltd" });
    expect(optionLabels(select("Main contact"))).toEqual(["Choose an organization first", "+ Add contact"]);
    fireEvent.change(select("Organization"), { target: { value: "1" } });
    expect(optionLabels(select("Main contact"))).toEqual(["Choose a contact", "Ada Shah", "Ben Cole", "+ Add contact"]);
    fireEvent.change(select("Main contact"), { target: { value: "11" } });
    fireEvent.change(select("Organization"), { target: { value: "2" } });
    expect(optionLabels(select("Main contact"))).toEqual(["Choose a contact", "Tom Ashworth", "+ Add contact"]);
    // The old contact no longer matches, so it's cleared rather than sent.
    expect(select("Main contact").value).toBe("");
  });

  it("R45 offers Add organization and Add contact in the pickers", async () => {
    setup();
    await screen.findByRole("option", { name: "Acme Ltd" });
    expect(optionLabels(select("Organization"))).toContain("+ Add organization");
    fireEvent.change(select("Organization"), { target: { value: "__add__" } });
    expect(await screen.findByRole("dialog", { name: "Add organization" })).toBeInTheDocument();
  });

  it("R48 keeps what was typed and shows the server's messages next to the fields", async () => {
    const { onSaved } = setup(() =>
      json(422, {
        error: {
          code: "validation_failed",
          message: "Check the highlighted fields.",
          fields: { contact_id: "Choose a contact from Acme Ltd." },
          request_id: "abc",
        },
      }),
    );
    await fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByText("Choose a contact from Acme Ltd.")).toBeInTheDocument();
    expect(screen.getByText("Check the highlighted fields.")).toBeInTheDocument();
    expect(input("Name").value).toBe("Fleet pilot");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("REL-5 disables Save while saving, so a double-click creates one deal", async () => {
    let finish: (r: Response) => void = () => {};
    const { posts, onSaved } = setup(() => new Promise<Response>((resolve) => (finish = resolve)));
    await fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    const saving = await screen.findByRole("button", { name: "Saving..." });
    expect(saving).toBeDisabled();
    fireEvent.click(saving);
    finish(json(201, { id: 99, name: "Fleet pilot" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(posts).toHaveLength(1);
  });
});
