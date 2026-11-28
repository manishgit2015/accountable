// V-F10 (part): the API client's timeout, error format, request ID and case translation (REL-4, OBS-3, ENG-6).
// T3.2: one test per endpoint hook, refetching after a save (spec 7.2), and the pipeline's optimistic
// move with rollback and a reload on 409 (R64, REL-8, REL-11).
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, MESSAGES, REQUEST_TIMEOUT_MS, apiRequest, convertKeys, toCamel, toSnake } from "./client";
import { setSession } from "../lib/session";
import { fakeSession } from "../test/session";
import * as q from "./queries";
import type { Deal } from "./types";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("case translation", () => {
  it("ENG-6 turns snake_case into camelCase and back", () => {
    expect(toCamel("open_deal_count")).toBe("openDealCount");
    expect(toCamel("next_7_days")).toBe("next7Days");
    expect(toSnake("openDealCount")).toBe("open_deal_count");
    expect(convertKeys({ won_this_month: { value: 1 }, months: [{ revenue_won: 2 }] }, toCamel)).toEqual({
      wonThisMonth: { value: 1 },
      months: [{ revenueWon: 2 }],
    });
  });
});

describe("apiRequest", () => {
  it("ENG-6 sends snake_case JSON and returns camelCase", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { contact_count: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await apiRequest("POST", "/api/organizations", { body: { name: "Acme", jobTitle: "x" } });
    expect(result).toEqual({ contactCount: 0 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"name":"Acme","job_title":"x"}');
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer test-token" });
  });

  it("R102 sends the signed-in person's token with every request, reads and changes alike", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("GET", "/api/deals");
    await apiRequest("PATCH", "/api/deals/1", { body: { value: 5 } });
    await apiRequest("DELETE", "/api/deals/1");
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    }
  });

  it("R101 sends no token once signed out", async () => {
    setSession(fakeSession({ status: "signed-out", token: null }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("GET", "/api/deals");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("R108 a 401 ends the session, and is an error like any other", async () => {
    const current = fakeSession();
    setSession(current);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse(401, { error: { code: "unauthorized", message: "Sign in to continue." } })),
    );
    await expect(apiRequest("GET", "/api/deals")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(current.end).toHaveBeenCalledTimes(1);
    expect(current.getState()).toEqual({ status: "signed-out", token: null, ended: true });
  });

  it("R101 other errors keep the session", async () => {
    const current = fakeSession();
    setSession(current);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { code: "forbidden_origin" } })));
    await expect(apiRequest("POST", "/api/deals", { body: {} })).rejects.toMatchObject({ status: 403 });
    expect(current.end).not.toHaveBeenCalled();
  });

  it("REL-13 a lost database shows the backend's message", async () => {
    const message = "Accountable can't reach its database. Try again in a minute.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { error: { code: "database_unavailable", message } })),
    );
    await expect(apiRequest("GET", "/api/deals")).rejects.toMatchObject({ code: "database_unavailable", message });
  });

  it("spec 5.2 reads the error format, with camelCase field names and the request ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          error: {
            code: "validation_failed",
            message: "Check the highlighted fields.",
            fields: { organization_id: "Choose an organization." },
            request_id: "abc123def456",
          },
        }),
      ),
    );
    const error = await apiRequest("POST", "/api/contacts", { body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect([apiError.status, apiError.code, apiError.message]).toEqual([
      422,
      "validation_failed",
      "Check the highlighted fields.",
    ]);
    expect(apiError.fields).toEqual({ organizationId: "Choose an organization." });
    expect(apiError.reference).toBe("Reference: abc123de");
  });

  it.each([
    [404, "not_found", MESSAGES.notFound],
    [409, "stale_position", MESSAGES.stalePosition],
    [503, "busy", MESSAGES.busy],
  ])("REL-6 a %i without a body still gets its code and message", async (status, code, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status, headers: { "X-Request-ID": "r1" } })),
    );
    const error = (await apiRequest("GET", "/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error.requestId).toBe("r1");
    if (status === 404) expect(error.code).toBe(code);
  });

  it("REL-7 a network failure or a proxy 502 means the backend can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const offline = (await apiRequest("GET", "/api/health").catch((e: unknown) => e)) as ApiError;
    expect([offline.code, offline.message]).toEqual(["unreachable", MESSAGES.unreachable]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    const proxy = (await apiRequest("GET", "/api/health").catch((e: unknown) => e)) as ApiError;
    expect(proxy.code).toBe("unreachable");
  });

  it("REL-4 gives up after 10 seconds with the timeout message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );
    const pending = apiRequest("GET", "/api/dashboard").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = (await pending) as ApiError;
    expect([error.code, error.message]).toEqual(["timeout", MESSAGES.timeout]);
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest("DELETE", "/api/deals/1")).resolves.toBeUndefined();
  });
});

// Hooks ---------------------------------------------------------------------------------------------

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function stubApi(respond: (call: Call) => Response | Promise<Response> = () => jsonResponse(200, [])) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      return respond(call);
    }),
  );
  return calls;
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

describe("read hooks", () => {
  const reads: [string, () => { isSuccess: boolean }, string][] = [
    ["useOrganizations", () => q.useOrganizations(), "/api/organizations"],
    ["useOrganization", () => q.useOrganization(3), "/api/organizations/3"],
    ["useContacts", () => q.useContacts(), "/api/contacts"],
    ["useContact", () => q.useContact(4), "/api/contacts/4"],
    ["useDeals", () => q.useDeals(), "/api/deals"],
    ["useDeal", () => q.useDeal(5), "/api/deals/5"],
    ["useActivities", () => q.useActivities(), "/api/activities"],
    ["useTimeline", () => q.useTimeline("contact", 6), "/api/contacts/6/timeline"],
    ["useDeleteImpact", () => q.useDeleteImpact("deal", 7), "/api/deals/7/delete-impact"],
    ["useDashboard", () => q.useDashboard(), "/api/dashboard"],
  ];
  it.each(reads)("spec 5 %s reads its endpoint", async (_name, hook, url) => {
    const calls = stubApi();
    const { result } = renderHook(hook, { wrapper: wrapperFor(q.createQueryClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toEqual([{ method: "GET", url, body: undefined }]);
  });

  it("REL-5 retries a failed read once, but not a 404", async () => {
    // Fake timers move React Query's 1-second retry delay forward at once (NFR-15).
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const calls = stubApi(() => jsonResponse(500, { error: { code: "internal", message: "x" } }));
    const { result } = renderHook(() => q.useDeals(), { wrapper: wrapperFor(q.createQueryClient()) });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.isError).toBe(true);
    expect(calls).toHaveLength(2);

    const missing = stubApi(() => jsonResponse(404, { error: { code: "not_found", message: "x" } }));
    const second = renderHook(() => q.useDeal(9), { wrapper: wrapperFor(q.createQueryClient()) });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(second.result.current.isError).toBe(true);
    expect(missing).toHaveLength(1);
  });

  it("R55 the activities in a timeline carry their follow-up and done flag", async () => {
    stubApi(({ url }) =>
      url === "/api/activities"
        ? jsonResponse(200, [
            {
              id: 1,
              type: "call",
              contact_id: 2,
              deal_id: null,
              description: "x",
              occurred_at: "2026-11-20T10:00:00",
              follow_up_date: "2026-11-25",
              done: false,
            },
          ])
        : jsonResponse(200, [
            {
              kind: "activity",
              id: 1,
              type: "call",
              from_stage: null,
              to_stage: null,
              description: "x",
              at: "2026-11-20T10:00:00",
              source: { kind: "contact", id: 2, name: "Ada" },
            },
            {
              kind: "stage_change",
              id: 1,
              type: null,
              from_stage: "new",
              to_stage: "qualified",
              description: null,
              at: "2026-11-19T10:00:00",
              source: { kind: "deal", id: 3, name: "D" },
            },
          ]),
    );
    const { result } = renderHook(() => q.useTimelineItems("contact", 2), {
      wrapper: wrapperFor(q.createQueryClient()),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0]).toMatchObject({
      kind: "activity",
      activity: { followUpDate: "2026-11-25", done: false },
    });
    expect(result.current.data?.[1]).not.toHaveProperty("activity");
  });
});

describe("change hooks", () => {
  const changes: [string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, string, string][] = [
    ["useCreateOrganization", () => q.useCreateOrganization(), { name: "Acme" }, "POST", "/api/organizations"],
    [
      "useUpdateOrganization",
      () => q.useUpdateOrganization(),
      { id: 1, input: { name: "Acme" } },
      "PATCH",
      "/api/organizations/1",
    ],
    ["useCreateContact", () => q.useCreateContact(), { name: "Ada", organizationId: 1 }, "POST", "/api/contacts"],
    [
      "useUpdateContact",
      () => q.useUpdateContact(),
      { id: 2, input: { status: "customer" } },
      "PATCH",
      "/api/contacts/2",
    ],
    ["useCreateDeal", () => q.useCreateDeal(), { name: "D", stage: "new" }, "POST", "/api/deals"],
    ["useUpdateDeal", () => q.useUpdateDeal(), { id: 3, input: { stage: "won" } }, "PATCH", "/api/deals/3"],
    [
      "useCreateActivity",
      () => q.useCreateActivity(),
      { type: "call", description: "x", dealId: 3 },
      "POST",
      "/api/activities",
    ],
    ["useUpdateActivity", () => q.useUpdateActivity(), { id: 4, input: { done: true } }, "PATCH", "/api/activities/4"],
    ["useDeleteRecord", () => q.useDeleteRecord(), { kind: "contact", id: 5 }, "DELETE", "/api/contacts/5"],
    ["useDeleteActivity", () => q.useDeleteActivity(), 6, "DELETE", "/api/activities/6"],
  ];
  it.each(changes)("spec 5 %s sends its request", async (_name, hook, variables, method, url) => {
    const calls = stubApi(({ method: m }) =>
      m === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse(200, {}),
    );
    const { result } = renderHook(hook, { wrapper: wrapperFor(q.createQueryClient()) });
    await act(() => result.current.mutateAsync(variables as never));
    expect(calls[0]).toMatchObject({ method, url });
  });

  it("ENG-6 sends snake_case bodies", async () => {
    const calls = stubApi(() => jsonResponse(201, {}));
    const { result } = renderHook(() => q.useCreateActivity(), { wrapper: wrapperFor(q.createQueryClient()) });
    await act(() =>
      result.current.mutateAsync({ type: "call", description: "x", dealId: 3, followUpDate: "2026-11-25" }),
    );
    expect(calls[0]?.body).toEqual({ type: "call", description: "x", deal_id: 3, follow_up_date: "2026-11-25" });
  });

  it("spec 7.2 a save refetches the lists, records, timelines and the dashboard", async () => {
    stubApi(() => jsonResponse(200, {}));
    const client = q.createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => q.useUpdateContact(), { wrapper: wrapperFor(client) });
    await act(() => result.current.mutateAsync({ id: 1, input: { name: "A" } }));
    const roots = invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
    expect(roots).toEqual(["organizations", "contacts", "deals", "activities", "timeline", "dashboard"]);
  });

  it("REL-5 a delete of something already gone counts as done", async () => {
    stubApi(() => jsonResponse(404, { error: { code: "not_found", message: "x" } }));
    const { result } = renderHook(() => q.useDeleteRecord(), { wrapper: wrapperFor(q.createQueryClient()) });
    await act(() => result.current.mutateAsync({ kind: "deal", id: 1 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// The optimistic move -----------------------------------------------------------------------------------

function deal(id: number, stage: Deal["stage"], position: number): Deal {
  return {
    id,
    organizationId: 1,
    organizationName: "A",
    contactId: 1,
    contactName: "B",
    name: `D${id}`,
    stage,
    value: 10_000,
    probability: 20,
    expectedRevenue: 2_000,
    closeDate: "2026-12-01",
    isLate: false,
    position,
    closedAt: null,
    createdAt: "2026-10-01T09:00:00",
    updatedAt: "2026-10-01T09:00:00",
  };
}

describe("optimisticMove", () => {
  const deals = [deal(1, "qualified", 1), deal(2, "proposal", 1), deal(3, "proposal", 2)];

  it("R63 puts a dropped card at the midpoint of its neighbours, with the new stage's probability", () => {
    const moved = q.optimisticMove(deals, 1, { stage: "proposal", beforeId: 2, afterId: 3 });
    expect(moved.find((d) => d.id === 1)).toMatchObject({
      stage: "proposal",
      position: 1.5,
      probability: 40,
      expectedRevenue: 4_000,
    });
  });

  it("R16 a drop on Won shows 100% and closes it now", () => {
    const now = new Date(2026, 10, 21, 14, 30);
    const moved = q.optimisticMove(deals, 1, { stage: "won", beforeId: null, afterId: null }, now);
    expect(moved.find((d) => d.id === 1)).toMatchObject({
      stage: "won",
      probability: 100,
      closedAt: "2026-11-21T14:30:00",
    });
  });

  it("R63 a move within a column changes only the position", () => {
    const moved = q.optimisticMove(deals, 3, { stage: "proposal", beforeId: null, afterId: 2 });
    expect(moved.find((d) => d.id === 3)).toMatchObject({ stage: "proposal", position: 0, probability: 20 });
  });
});

describe("useMoveDeal", () => {
  function setupMove(respond: (call: Call) => Response | Promise<Response>) {
    stubApi(respond);
    const client = q.createQueryClient();
    const before = [deal(1, "qualified", 1), deal(2, "proposal", 1)];
    client.setQueryData(q.keys.deals, before);
    const onFailure = vi.fn();
    const { result } = renderHook(() => q.useMoveDeal(onFailure), { wrapper: wrapperFor(client) });
    return { client, before, onFailure, result };
  }

  it("R64 updates the board at once, then keeps the server's answer", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { client, result } = setupMove(async ({ method }) => {
      if (method !== "POST") return jsonResponse(200, []);
      await gate;
      const saved = { ...deal(1, "proposal", 0), probability: 40, expectedRevenue: 4000 };
      return jsonResponse(200, { deal: convertKeys(saved, toSnake), renumbered: [] });
    });
    act(() => result.current.mutate({ id: 1, move: { stage: "proposal", beforeId: null, afterId: 2 } }));
    // Before the server answers, the card is already in Proposal (R64).
    await waitFor(() => expect(client.getQueryData<Deal[]>(q.keys.deals)?.[0]?.stage).toBe("proposal"));
    expect(client.getQueryData<Deal[]>(q.keys.deals)?.[0]?.position).toBe(0);
    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Deal[]>(q.keys.deals)?.[0]).toMatchObject({ stage: "proposal", probability: 40 });
  });

  it("R64 REL-8 puts the board back and says so when the save fails", async () => {
    const { client, before, onFailure, result } = setupMove(() =>
      jsonResponse(500, { error: { code: "internal", message: "x" } }),
    );
    act(() => result.current.mutate({ id: 1, move: { stage: "proposal", beforeId: null, afterId: 2 } }));
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith(q.MOVE_FAILED));
    expect(client.getQueryData(q.keys.deals)).toEqual(before);
  });

  it("REL-11 reloads the board on 409 stale_position", async () => {
    const { client, onFailure, result } = setupMove(() =>
      jsonResponse(409, { error: { code: "stale_position", message: "The board changed. Try again." } }),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    act(() => result.current.mutate({ id: 1, move: { stage: "proposal", beforeId: 9, afterId: 2 } }));
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith("The board changed. Try again."));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: q.keys.deals });
  });
});
