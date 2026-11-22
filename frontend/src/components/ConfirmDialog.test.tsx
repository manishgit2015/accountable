// V-F04: the delete dialog names the record, says what happens to its links with the server's counts,
// and deletes nothing until it's confirmed (R30–R33).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog, DeleteRecordDialog, impactText } from "./ConfirmDialog";

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("impactText", () => {
  it("R30 R31 says an organization's contacts and deals are kept, with counts", () => {
    expect(impactText("organization", { contactsKept: 4, dealsKept: 3 })).toBe(
      "Its 4 contacts and 3 deals will be kept, with no organization. This can't be undone.",
    );
    expect(impactText("organization", { contactsKept: 1, dealsKept: 0 })).toContain("1 contact and 0 deals");
  });

  it("R32 says a contact's deals are kept and their activities deleted", () => {
    expect(impactText("contact", { dealsKept: 2, activitiesDeleted: 1 })).toBe(
      "Their 2 deals will be kept, with no main contact. Their 1 activity will be deleted. This can't be undone.",
    );
  });

  it("R33 says a deal's activities and stage changes are deleted", () => {
    expect(impactText("deal", { activitiesDeleted: 3, stageChangesDeleted: 4 })).toBe(
      "Its 3 activities and 4 stage changes will be deleted. This can't be undone.",
    );
  });
});

describe("ConfirmDialog", () => {
  it("R30 names the record and deletes nothing until confirmed", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete Acme Ltd?"
        description="Its 4 contacts and 3 deals will be kept, with no organization."
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "Delete Acme Ltd?" })).toBeInTheDocument();
    expect(screen.getByText(/Its 4 contacts and 3 deals will be kept/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("R30 can't be confirmed while the counts are still loading", () => {
    render(<ConfirmDialog open onOpenChange={() => {}} title="Delete X?" description={null} onConfirm={() => {}} />);
    expect(screen.getByText("Checking linked records...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

describe("DeleteRecordDialog", () => {
  it("R30 reads the counts from the server when it opens, and deletes only on confirm", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/organizations/7/delete-impact") return json(200, { contacts_kept: 4, deals_kept: 3 });
      if (init?.method === "DELETE") return json(204);
      return json(200, []);
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <DeleteRecordDialog kind="organization" record={{ id: 7, name: "Acme Ltd" }} onClose={onClose} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("alertdialog", { name: "Delete Acme Ltd?" })).toBeInTheDocument();
    expect(
      await screen.findByText(/Its 4 contacts and 3 deals will be kept, with no organization/),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/organizations/7", expect.objectContaining({ method: "DELETE" }));
  });
});
