// Runs before every frontend test file (spec 13.2).
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { setSession } from "../lib/session";
import { fakeSession } from "./session";

/** Saturday 21 November 2026, 14:30 local time: the same moment as the backend and e2e tests. */
export const FIXED_NOW = new Date(2026, 10, 21, 14, 30, 0);

// jsdom has no ResizeObserver; charts and drag-and-drop measure with it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// NFR-15, V-U01: every unit test runs in under 1 second on this computer, because CI is much slower.
// vitest.config.ts's testTimeout stops a slow async test; this also fails a slow synchronous one. It reads
// Node's own clock, which fake timers never replace.
const UNIT_TEST_LIMIT_MS = 1000;
let startedAt = 0n;

beforeEach(() => {
  startedAt = process.hrtime.bigint();
  // Every test starts signed in (R100). A test about signing in replaces this with its own session.
  setSession(fakeSession());
  // Fix "now" without faking timers, so promises and React Query still run normally.
  // A test that needs to move time forward calls vi.useFakeTimers() itself.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
  if (ms > UNIT_TEST_LIMIT_MS) {
    throw new Error(`NFR-15: this unit test took ${Math.round(ms)} ms, over the ${UNIT_TEST_LIMIT_MS} ms limit.`);
  }
});
