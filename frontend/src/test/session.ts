// A session for component and page tests: signed in by default, with every call recorded.
import { vi } from "vitest";

import type { Session, SessionState, SignInResult } from "../lib/session";

export const TEST_TOKEN = "test-token";

export interface FakeSession extends Session {
  set: (state: SessionState) => void;
  signIn: ReturnType<typeof vi.fn<(email: string, password: string) => Promise<SignInResult>>>;
  signOut: ReturnType<typeof vi.fn<() => Promise<void>>>;
  end: ReturnType<typeof vi.fn<() => void>>;
}

export function fakeSession(initial: Partial<SessionState> = {}): FakeSession {
  let state: SessionState = { status: "signed-in", token: TEST_TOKEN, ended: false, ...initial };
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set,
    signIn: vi.fn(async () => {
      set({ status: "signed-in", token: TEST_TOKEN, ended: false });
      return "ok" as SignInResult;
    }),
    signOut: vi.fn(async () => set({ status: "signed-out", token: null, ended: false })),
    end: vi.fn(() => set({ status: "signed-out", token: null, ended: true })),
  };
}
