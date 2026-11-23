// The app shell: the top bar's sections and "Add deal" (spec 3.9 Layout), a page for unknown addresses,
// and the offline banner that clears itself once the backend answers again (REL-7).
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient, setOffline } from "./api/queries";
import { App } from "./App";
import { fakeApi, renderPage } from "./test/app";

const DEAL = {
  id: 42,
  organization_id: 1,
  organization_name: "Acme Ltd",
  contact_id: 10,
  contact_name: "Ada Shah",
  name: "Fleet renewal",
  stage: "new",
  value: 5000,
  probability: 5,
  expected_revenue: 250,
  close_date: "2026-12-31",
  is_late: false,
  position: 1,
  closed_at: null,
  created_at: "2026-11-01T09:00:00",
  updated_at: "2026-11-01T09:00:00",
};

describe("the top bar", () => {
  it("links the five sections and marks the current one", async () => {
    fakeApi();
    renderPage(<App />, { at: "/deals" });
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Dashboard", "Pipeline", "Deals", "Contacts", "Organizations"]);
    expect(within(nav).getByRole("link", { name: "Deals" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(nav).getByRole("link", { name: "Pipeline" }));
    expect(await screen.findByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
  });

  it("opens Add deal in a side panel, and closes it again", async () => {
    fakeApi();
    renderPage(<App />, { at: "/pipeline" });
    fireEvent.click(screen.getAllByRole("button", { name: "Add deal" })[0] as HTMLElement);
    const panel = await screen.findByRole("dialog", { name: "Add deal" });
    expect(within(panel).getByRole("form", { name: "Deal" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("goes to the new deal's page once it's saved", async () => {
    fakeApi({
      "GET /api/organizations": [
        {
          id: 1,
          name: "Acme Ltd",
          website: null,
          industry: null,
          notes: null,
          contact_count: 1,
          open_deal_count: 0,
          open_value: 0,
          created_at: "2026-11-01T09:00:00",
          updated_at: "2026-11-01T09:00:00",
        },
      ],
      "GET /api/contacts": [
        {
          id: 10,
          name: "Ada Shah",
          organization_id: 1,
          organization_name: "Acme Ltd",
          email: null,
          phone: null,
          job_title: null,
          status: "lead",
          created_at: "2026-11-01T09:00:00",
          updated_at: "2026-11-01T09:00:00",
        },
      ],
      "POST /api/deals": DEAL,
      "GET /api/deals/42": DEAL,
    });
    renderPage(<App />, { at: "/nowhere" });
    fireEvent.click(screen.getByRole("button", { name: "Add deal" }));
    const panel = await screen.findByRole("dialog", { name: "Add deal" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Fleet renewal" } });
    await waitFor(() => expect(within(panel).getAllByRole("option", { name: "Acme Ltd" })).toHaveLength(1));
    fireEvent.change(within(panel).getByLabelText("Organization"), { target: { value: "1" } });
    fireEvent.change(within(panel).getByLabelText("Main contact"), { target: { value: "10" } });
    fireEvent.change(within(panel).getByLabelText("Value (USD)"), { target: { value: "5000" } });
    fireEvent.change(within(panel).getByLabelText("Close date"), { target: { value: "2026-12-31" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Add deal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: /^Fleet renewal/ })).toBeInTheDocument();
  });
});

describe("unknown addresses", () => {
  it("says there's nothing at the address", () => {
    fakeApi();
    renderPage(<App />, { at: "/no/such/page" });
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("There's nothing at this address.")).toBeInTheDocument();
  });
});

describe("offline (REL-7)", () => {
  it("shows the banner while the backend can't be reached, and clears it when health answers", async () => {
    let backendUp = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!backendUp) throw new TypeError("Failed to fetch");
        return new Response(JSON.stringify(url === "/api/health" ? { status: "ok", database: "ok" } : []), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={["/organizations"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      (await screen.findAllByText(/Can't reach Accountable/, {}, { timeout: 4000 }))[0]?.closest(".offline-banner"),
    ).toBeInTheDocument();
    backendUp = true;
    await waitFor(() => expect(document.querySelector(".offline-banner")).not.toBeInTheDocument(), {
      timeout: 5000,
    });
    setOffline(false);
  }, 10_000);
});
