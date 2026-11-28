// Who's signed in, in this browser (R100–R102, R107, R108, SEC-15, SEC-17, SEC-18).
// - Real use: Supabase Auth with an email and password, through its client with the publishable key only.
//   It keeps the session in localStorage and renews the access token before it runs out.
// - Test mode (VITE_TEST_SIGN_IN, set only by the test runs): the backend's POST /api/test/sign-in, and no
//   Supabase client is ever created, so the tests make no request outside localhost (V-E00).
// The API client asks here for the token to send, and calls end() when the API answers 401.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { testSignInFetch } from "../api/testSignIn";

export type SignInResult = "ok" | "wrong" | "unreachable";

export interface SessionState {
  /** "loading" until a saved session has been looked for. */
  status: "loading" | "signed-in" | "signed-out";
  token: string | null;
  /** True when the session ended without the person signing out: show "Your session has ended" (R108). */
  ended: boolean;
}

export interface Session {
  getState: () => SessionState;
  subscribe: (listener: () => void) => () => void;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** The API refused the token (401): the session is over, and the sign-in screen says so (R108). */
  end: () => void;
}

const SIGNED_OUT: SessionState = { status: "signed-out", token: null, ended: false };

/** The state, and the listeners to tell when it changes. */
function store(initial: SessionState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: SessionState) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// --- Real use: Supabase Auth ---------------------------------------------------------------------------

/** The part of Supabase's client this app uses (R104: no sign-up, reset or magic link). */
export type AuthClient = Pick<
  SupabaseClient["auth"],
  "getSession" | "onAuthStateChange" | "signInWithPassword" | "signOut"
>;

export function supabaseSession(auth: AuthClient): Session {
  const state = store({ status: "loading", token: null, ended: false });
  let endedByApi = false;

  void auth.getSession().then(({ data }) => {
    if (state.get().status === "loading") {
      const token = data.session?.access_token ?? null;
      state.set({ status: token ? "signed-in" : "signed-out", token, ended: false });
    }
  });
  // Sign-ins, sign-outs and every token renewal come through here.
  auth.onAuthStateChange((_event, session) => {
    const token = session?.access_token ?? null;
    state.set({ status: token ? "signed-in" : "signed-out", token, ended: !token && endedByApi });
    if (token) endedByApi = false;
  });

  return {
    getState: state.get,
    subscribe: state.subscribe,
    signIn: async (email, password) => {
      try {
        const { error } = await auth.signInWithPassword({ email, password });
        if (!error) return "ok";
        // Supabase answers 400 for a wrong email or password; anything else means it couldn't be used.
        return error.status === 400 ? "wrong" : "unreachable";
      } catch {
        return "unreachable";
      }
    },
    signOut: async () => {
      endedByApi = false;
      state.set(SIGNED_OUT);
      await auth.signOut({ scope: "local" }).catch(() => undefined);
    },
    end: () => {
      endedByApi = true;
      state.set({ status: "signed-out", token: null, ended: true });
      void auth.signOut({ scope: "local" }).catch(() => undefined);
    },
  };
}

// --- Test mode: the backend's test sign-in (SEC-17) ---------------------------------------------------

export const TEST_SESSION_KEY = "accountable.test-session";

interface SavedTestSession {
  token: string;
  expiresAt: number;
}

function readSaved(storage: Storage | null, now: () => number): string | null {
  try {
    const saved = JSON.parse(storage?.getItem(TEST_SESSION_KEY) ?? "null") as SavedTestSession | null;
    return saved && saved.expiresAt > now() ? saved.token : null;
  } catch {
    return null;
  }
}

function writeSaved(storage: Storage | null, saved: SavedTestSession | null): void {
  try {
    if (saved) storage?.setItem(TEST_SESSION_KEY, JSON.stringify(saved));
    else storage?.removeItem(TEST_SESSION_KEY);
  } catch {
    // Storage blocked: the session lasts until the page reloads.
  }
}

export function testSession(
  fetcher: typeof fetch,
  storage: Storage | null,
  now: () => number = () => Date.now(),
): Session {
  const token = readSaved(storage, now);
  const state = store({ status: token ? "signed-in" : "signed-out", token, ended: false });

  return {
    getState: state.get,
    subscribe: state.subscribe,
    signIn: async (email, password) => {
      let response: Response;
      try {
        response = await fetcher("/api/test/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        return "unreachable";
      }
      if (response.status === 401) return "wrong";
      if (!response.ok) return "unreachable";
      const body = (await response.json()) as { access_token: string; expires_in: number };
      writeSaved(storage, { token: body.access_token, expiresAt: now() + body.expires_in * 1000 });
      state.set({ status: "signed-in", token: body.access_token, ended: false });
      return "ok";
    },
    signOut: async () => {
      writeSaved(storage, null);
      state.set(SIGNED_OUT);
    },
    end: () => {
      writeSaved(storage, null);
      state.set({ status: "signed-out", token: null, ended: true });
    },
  };
}

// --- The app's session ------------------------------------------------------------------------------

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A session that can't sign anyone in: the Supabase settings are missing (DEP-3 names them at start). */
function unconfiguredSession(): Session {
  const state = store(SIGNED_OUT);
  return {
    getState: state.get,
    subscribe: state.subscribe,
    signIn: async () => "unreachable",
    signOut: async () => state.set(SIGNED_OUT),
    end: () => state.set({ ...SIGNED_OUT, ended: true }),
  };
}

export function createSession(
  env: ImportMetaEnv = import.meta.env,
  create: (
    url: string,
    key: string,
    options: Parameters<typeof createClient>[2],
  ) => { auth: AuthClient } = createClient,
): Session {
  if (env.VITE_TEST_SIGN_IN === "1") return testSession(testSignInFetch, browserStorage());
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) return unconfiguredSession();
  const client = create(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "accountable.session",
    },
  });
  return supabaseSession(client.auth);
}

let appSession: Session | null = null;

/** The one session the app uses, made on first use. Tests replace it with setSession. */
export function session(): Session {
  appSession ??= createSession();
  return appSession;
}

export function setSession(next: Session | null): void {
  appSession = next;
}
