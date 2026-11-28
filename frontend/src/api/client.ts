// The only place the app calls fetch (ENG-1, lint-enforced).
// - Gives up after 10 seconds (REL-4).
// - Reads the error format of spec 5.2, with its request ID (OBS-3).
// - Translates snake_case from the API to camelCase, and back for request bodies (ENG-6).
// - Sends the signed-in person's token with every request, and ends the session on a 401 (R102, R108).

import { session } from "../lib/session";

export const REQUEST_TIMEOUT_MS = 10_000;

export const MESSAGES = {
  unreachable: "Can't reach Accountable. Check it's still running in the terminal.",
  timeout: "Accountable didn't answer in time. Check it's still running and try again.",
  busy: "Accountable is busy. Try again.",
  notFound: "That record no longer exists.",
  stalePosition: "The board changed. Try again.",
  unexpected: "Something went wrong. Try again, and check the terminal if it keeps happening.",
} as const;

export type ApiErrorCode =
  | "bad_request"
  | "forbidden_origin"
  | "not_found"
  | "stale_position"
  | "too_large"
  | "unsupported_media_type"
  | "validation_failed"
  | "busy"
  | "database_unavailable"
  | "unauthorized"
  | "internal"
  | "unreachable"
  | "timeout";

/** An error from the API, or from failing to reach it. `fields` uses the frontend's camelCase names. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly fields: Record<string, string>;
  readonly requestId: string | null;

  constructor(options: {
    status: number;
    code: ApiErrorCode | string;
    message: string;
    fields?: Record<string, string>;
    requestId?: string | null;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields ?? {};
    this.requestId = options.requestId ?? null;
  }

  /** "Reference: 9f2c1a7b", so the log line can be found (OBS-3). */
  get reference(): string | null {
    return this.requestId ? `Reference: ${this.requestId.slice(0, 8)}` : null;
  }
}

export function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [convert(k), convertKeys(v, convert)]));
  }
  return value;
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string>; request_id?: string | null };
}

async function readError(response: Response): Promise<ApiError> {
  const headerId = response.headers.get("X-Request-ID");
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Not JSON (for example a proxy error page): fall back to the status.
  }
  const error = body.error ?? {};
  const fields = Object.fromEntries(Object.entries(error.fields ?? {}).map(([k, v]) => [toCamel(k), v]));
  const fallback =
    response.status === 404
      ? MESSAGES.notFound
      : response.status === 409
        ? MESSAGES.stalePosition
        : response.status === 503
          ? MESSAGES.busy
          : MESSAGES.unexpected;
  // A 502 or 504 from the dev server's proxy means the backend isn't running.
  if ((response.status === 502 || response.status === 504) && !body.error) {
    return new ApiError({ status: 0, code: "unreachable", message: MESSAGES.unreachable, requestId: headerId });
  }
  return new ApiError({
    status: response.status,
    code: error.code ?? (response.status === 404 ? "not_found" : "internal"),
    message: error.message ?? fallback,
    fields,
    requestId: error.request_id ?? headerId,
  });
}

export interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Call the API. Resolves with the camelCased JSON body (or undefined for 204), or rejects with ApiError. */
export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);

  let response: Response;
  try {
    const token = session().getState().token;
    const headers: Record<string, string> =
      options.body === undefined ? { Accept: "application/json" } : { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(convertKeys(options.body, toSnake)),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError({ status: 0, code: "timeout", message: MESSAGES.timeout });
    if (options.signal?.aborted) throw error;
    throw new ApiError({ status: 0, code: "unreachable", message: MESSAGES.unreachable });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }

  // The token was refused: it ran out, or the person was removed. The app shows the sign-in screen (R108).
  if (response.status === 401) session().end();
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return convertKeys(await response.json(), toCamel) as T;
}

export interface Health {
  status: "ok" | "error";
  database: "ok" | "error";
  schemaVersion: string | null;
  appVersion: string;
}

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return apiRequest<Health>("GET", "/api/health", { signal });
}
