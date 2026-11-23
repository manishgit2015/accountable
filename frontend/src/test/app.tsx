// Shared helpers for component and page tests: a fake backend keyed by "METHOD /api/path", and
// rendering inside React Query and the router, the way main.tsx does.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface SentRequest {
  method: string;
  url: string;
  body: unknown;
}

/** A response, or a function of the request body that returns one. */
export type FakeHandler = (body: unknown) => Response | Promise<Response>;
export type FakeRoute = FakeHandler | object | string | number | boolean | null;

/**
 * Stubs fetch with the given routes, for example `{ "GET /api/deals": [...], "DELETE /api/deals/1": () => json(204) }`.
 * A plain value is answered as 200 JSON. Unknown GETs answer [] and anything else 404, so a test only lists what it uses.
 * Returns every request sent, to check what the page asked for.
 */
export function fakeApi(routes: Record<string, FakeRoute> = {}): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
      sent.push({ method, url, body });
      const route = routes[`${method} ${url}`];
      if (typeof route === "function") return (route as FakeHandler)(body);
      if (route !== undefined) return json(200, route);
      return method === "GET" ? json(200, []) : json(404, { code: "not_found", message: "Not found." });
    }),
  );
  return sent;
}

export function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

interface RenderOptions {
  /** The address the page opens at. */
  at?: string;
  /** The route pattern the element is mounted under, for pages that read URL parameters. */
  path?: string;
}

/** Renders `ui` with a fresh query client and a memory router, at `at` (default "/"). */
export function renderPage(ui: ReactElement, { at = "/", path = "*" }: RenderOptions = {}) {
  const client = testQueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path={path} element={ui} />
          {path !== "*" && <Route path="*" element={<p>Left the page</p>} />}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
