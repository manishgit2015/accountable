// V-F10 (part): the API client's timeout, error format, request ID and case translation (REL-4, OBS-3, ENG-6).
// The rest of client.test.ts (one test per endpoint hook) arrives with T3.2.
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, MESSAGES, REQUEST_TIMEOUT_MS, apiRequest, convertKeys, toCamel, toSnake } from "./client";

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
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
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
