// Runs before every frontend test file (spec 13.2).
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/** Saturday 21 November 2026, 14:30 local time: the same moment as the backend and e2e tests. */
export const FIXED_NOW = new Date(2026, 10, 21, 14, 30, 0);

// jsdom has no ResizeObserver; charts and drag-and-drop measure with it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(() => {
  // Fix "now" without faking timers, so promises and React Query still run normally.
  // A test that needs to move time forward calls vi.useFakeTimers() itself.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
