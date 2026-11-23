// V-F06: logging and editing activities (R13, R21, R53, R48) and the timeline's actions: tick a
// follow-up, edit, and delete after asking (R55).
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Activity } from "../api/types";
import { fakeApi, json, renderPage } from "../test/app";
import { ActivityForm, ActivityTimeline } from "./ActivityForm";
import type { TimelineItem } from "./Timeline";

const activity: Activity = {
  id: 5,
  type: "email",
  contactId: null,
  dealId: 7,
  description: "Sent the proposal",
  occurredAt: "2026-11-20T09:15:00",
  followUpDate: "2026-11-24",
  done: false,
};
const savedActivity = {
  id: 5,
  type: "email",
  contact_id: null,
  deal_id: 7,
  description: "Sent the proposal",
  occurred_at: "2026-11-20T09:15:00",
  follow_up_date: "2026-11-24",
  done: false,
};
const entry: TimelineItem = {
  kind: "activity",
  id: 5,
  type: "email",
  fromStage: null,
  toStage: null,
  description: "Sent the proposal",
  at: "2026-11-20T09:15:00",
  source: { kind: "deal", id: 7, name: "Acme renewal" },
  activity,
};

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("ActivityForm", () => {
  it("R53 logs a note now by default against its deal, then clears for the next one", async () => {
    const sent = fakeApi({ "POST /api/activities": () => json(201, { ...savedActivity, id: 9 }) });
    const onSaved = vi.fn();
    renderPage(<ActivityForm target={{ dealId: 7 }} onSaved={onSaved} />);
    expect(field("When it happened").value).toBe("2026-11-21T14:30");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    fireEvent.change(field("Type"), { target: { value: "call" } });
    fireEvent.change(field("Description"), { target: { value: "  Called Ada  " } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent.find((r) => r.method === "POST")?.body).toEqual({
      type: "call",
      description: "Called Ada",
      occurred_at: "2026-11-21T14:30:00",
      follow_up_date: null,
      deal_id: 7,
    });
    await waitFor(() => expect(field("Description").value).toBe(""));
  });

  it("R21 asks for a description before sending", async () => {
    const sent = fakeApi();
    renderPage(<ActivityForm target={{ contactId: 3 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(await screen.findByText("Enter a description.")).toBeInTheDocument();
    expect(sent.some((r) => r.method === "POST")).toBe(false);
  });

  it("R48 shows the server's message and keeps what was typed", async () => {
    fakeApi({
      "POST /api/activities": () =>
        json(422, {
          error: { code: "validation_failed", message: "Check it.", fields: { description: "Too vague." } },
        }),
    });
    renderPage(<ActivityForm target={{ dealId: 7 }} />);
    fireEvent.change(field("Description"), { target: { value: "Stuff" } });
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }));
    expect(await screen.findByText("Too vague.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(field("Description").value).toBe("Stuff");
  });

  it("R55 edits an activity with what it already says, and can be cancelled", async () => {
    const sent = fakeApi({ "PATCH /api/activities/5": () => json(200, savedActivity) });
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    renderPage(<ActivityForm activity={activity} onSaved={onSaved} onCancel={onCancel} />);
    expect(field("Description").value).toBe("Sent the proposal");
    expect(field("When it happened").value).toBe("2026-11-20T09:15");
    expect(field("Follow-up date (optional)").value).toBe("2026-11-24");

    fireEvent.change(field("Follow-up date (optional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent.find((r) => r.method === "PATCH")?.body).toMatchObject({ follow_up_date: null });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("R53 keeps an activity without a follow-up date blank when editing", () => {
    fakeApi();
    renderPage(<ActivityForm activity={{ ...activity, followUpDate: null }} />);
    expect(field("Follow-up date (optional)").value).toBe("");
  });
});

describe("ActivityTimeline", () => {
  it("R55 ticks a follow-up straight away and saves it", async () => {
    const sent = fakeApi({ "PATCH /api/activities/5": () => json(200, { ...savedActivity, done: true }) });
    renderPage(<ActivityTimeline items={[entry]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Follow up 24 Nov/ }));
    expect(screen.getByRole("checkbox", { name: /Done/ })).toBeChecked();
    await waitFor(() => expect(sent.find((r) => r.method === "PATCH")?.body).toEqual({ done: true }));
  });

  it("R55 puts a follow-up back and says so when saving it fails", async () => {
    fakeApi({ "PATCH /api/activities/5": () => json(500, { error: { code: "internal", message: "Boom" } }) });
    renderPage(<ActivityTimeline items={[entry]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Follow up/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the follow-up.");
    expect(screen.getByRole("checkbox", { name: /Follow up/ })).not.toBeChecked();
  });

  it("R55 edits an activity in a side panel", async () => {
    fakeApi({ "PATCH /api/activities/5": () => json(200, savedActivity) });
    renderPage(<ActivityTimeline items={[entry]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const panel = screen.getByRole("dialog", { name: "Edit activity" });
    fireEvent.click(within(panel).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("R55 deletes an activity only after asking", async () => {
    const sent = fakeApi({ "DELETE /api/activities/5": () => json(204) });
    renderPage(<ActivityTimeline items={[entry]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete this activity?" });
    expect(dialog).toHaveTextContent(`"Sent the proposal" will be deleted. This can't be undone.`);
    expect(sent.some((r) => r.method === "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent.some((r) => r.method === "DELETE" && r.url === "/api/activities/5")).toBe(true);
  });

  it("R55 says when a delete fails, and Cancel closes without deleting", async () => {
    fakeApi({ "DELETE /api/activities/5": () => json(500, { error: { code: "internal", message: "Boom" } }) });
    renderPage(<ActivityTimeline items={[entry]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Couldn't delete the activity/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
