import { beforeEach, describe, expect, it, vi } from "vitest";

// Stands in for Supabase's createClient, so no test makes a real client.
const createClient = vi.fn();

import { type AuthClient, createSession, supabaseSession, TEST_SESSION_KEY, testSession } from "./session";

type Listener = (event: string, session: { access_token: string } | null) => void;

/** Supabase Auth's client, as far as the app uses it (R102, R104). */
function fakeAuth(saved: string | null = null) {
  let listener: Listener = () => undefined;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: saved ? { access_token: saved } : null }, error: null })),
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async () => {
      listener("SIGNED_IN", { access_token: "supabase-token" });
      return { data: {}, error: null };
    }),
    signOut: vi.fn(async () => {
      listener("SIGNED_OUT", null);
      return { error: null };
    }),
  };
  return {
    auth,
    emit: (event: string, token: string | null) => listener(event, token ? { access_token: token } : null),
  };
}

const asAuth = (auth: ReturnType<typeof fakeAuth>["auth"]) => auth as unknown as AuthClient;

describe("real use: Supabase Auth (R102)", () => {
  it("R100 starts loading, then signed out with no saved session", async () => {
    const { auth } = fakeAuth();
    const session = supabaseSession(asAuth(auth));
    expect(session.getState().status).toBe("loading");
    await vi.waitFor(() => expect(session.getState()).toEqual({ status: "signed-out", token: null, ended: false }));
  });

  it("R102 keeps a saved session across reloads", async () => {
    const { auth } = fakeAuth("saved-token");
    const session = supabaseSession(asAuth(auth));
    await vi.waitFor(() =>
      expect(session.getState()).toEqual({ status: "signed-in", token: "saved-token", ended: false }),
    );
  });

  it("R102 signs in with email and password, and takes each renewed token", async () => {
    const { auth, emit } = fakeAuth();
    const session = supabaseSession(asAuth(auth));
    const listener = vi.fn();
    session.subscribe(listener);
    expect(await session.signIn("priya@example.com", "pw")).toBe("ok");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "priya@example.com", password: "pw" });
    expect(session.getState().token).toBe("supabase-token");
    emit("TOKEN_REFRESHED", "renewed-token");
    expect(session.getState()).toEqual({ status: "signed-in", token: "renewed-token", ended: false });
    expect(listener).toHaveBeenCalled();
  });

  it("R103 a wrong email or password is 'wrong', anything else 'unreachable'", async () => {
    const { auth } = fakeAuth();
    const session = supabaseSession(asAuth(auth));
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { status: 400 } } as never);
    expect(await session.signIn("a@b.example", "x")).toBe("wrong");
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { status: 0 } } as never);
    expect(await session.signIn("a@b.example", "x")).toBe("unreachable");
    auth.signInWithPassword.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await session.signIn("a@b.example", "x")).toBe("unreachable");
    expect(session.getState().status).not.toBe("signed-in");
  });

  it("R107 signing out ends the session in this browser only", async () => {
    const { auth } = fakeAuth("saved-token");
    const session = supabaseSession(asAuth(auth));
    await vi.waitFor(() => expect(session.getState().status).toBe("signed-in"));
    await session.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(session.getState()).toEqual({ status: "signed-out", token: null, ended: false });
  });

  it("R108 a session the API refused ends with 'ended', even after Supabase's own sign-out event", async () => {
    const { auth } = fakeAuth("saved-token");
    const session = supabaseSession(asAuth(auth));
    await vi.waitFor(() => expect(session.getState().status).toBe("signed-in"));
    session.end();
    expect(session.getState()).toEqual({ status: "signed-out", token: null, ended: true });
    await vi.waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    expect(session.getState().ended).toBe(true);
    await session.signIn("priya@example.com", "pw");
    expect(session.getState().ended).toBe(false);
  });

  it("R108 a renewal Supabase couldn't make ends the session too", async () => {
    const { auth, emit } = fakeAuth("saved-token");
    const session = supabaseSession(asAuth(auth));
    await vi.waitFor(() => expect(session.getState().status).toBe("signed-in"));
    emit("SIGNED_OUT", null);
    expect(session.getState().status).toBe("signed-out");
  });
});

describe("test mode: the backend's test sign-in (SEC-17)", () => {
  function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
      removeItem: (key) => void items.delete(key),
      clear: () => items.clear(),
      key: () => null,
      get length() {
        return items.size;
      },
    };
  }
  const ok = () =>
    new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("SEC-17 signs in through /api/test/sign-in and keeps the token for this browser", async () => {
    const fetcher = vi.fn(async () => ok());
    const storage = memoryStorage();
    const session = testSession(fetcher, storage, () => 1000);
    expect(session.getState().status).toBe("signed-out");
    expect(await session.signIn("priya@test.example", "test")).toBe("ok");
    expect(fetcher).toHaveBeenCalledWith("/api/test/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "priya@test.example", password: "test" }),
    });
    expect(session.getState()).toEqual({ status: "signed-in", token: "test-token", ended: false });
    // A reload finds it again, until it runs out.
    expect(testSession(fetcher, storage, () => 2000).getState().token).toBe("test-token");
    expect(testSession(fetcher, storage, () => 1000 + 3600 * 1000 + 1).getState().status).toBe("signed-out");
  });

  it("R103 a 401 is 'wrong'; no answer or a server error is 'unreachable'", async () => {
    const session = testSession(
      vi.fn(async () => new Response(null, { status: 401 })),
      memoryStorage(),
    );
    expect(await session.signIn("x@test.example", "nope")).toBe("wrong");
    const down = testSession(
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
      memoryStorage(),
    );
    expect(await down.signIn("x@test.example", "test")).toBe("unreachable");
    const broken = testSession(
      vi.fn(async () => new Response(null, { status: 500 })),
      memoryStorage(),
    );
    expect(await broken.signIn("x@test.example", "test")).toBe("unreachable");
  });

  it("R107 R108 signing out and an ended session both forget the token", async () => {
    const storage = memoryStorage();
    const session = testSession(
      vi.fn(async () => ok()),
      storage,
    );
    await session.signIn("priya@test.example", "test");
    await session.signOut();
    expect(storage.getItem(TEST_SESSION_KEY)).toBeNull();
    expect(session.getState()).toEqual({ status: "signed-out", token: null, ended: false });
    await session.signIn("priya@test.example", "test");
    session.end();
    expect(storage.getItem(TEST_SESSION_KEY)).toBeNull();
    expect(session.getState().ended).toBe(true);
  });

  it("still signs in when storage is blocked or holds something unreadable", async () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;
    const session = testSession(
      vi.fn(async () => ok()),
      blocked,
    );
    expect(await session.signIn("priya@test.example", "test")).toBe("ok");
    await session.signOut();
    const garbled = memoryStorage();
    garbled.setItem(TEST_SESSION_KEY, "{not json");
    expect(testSession(vi.fn(), garbled).getState().status).toBe("signed-out");
    expect(testSession(vi.fn(), null).getState().status).toBe("signed-out");
  });
});

describe("which session the app makes (SEC-15, SEC-17)", () => {
  beforeEach(() => createClient.mockReset());

  it("SEC-17 test mode never creates a Supabase client", () => {
    const session = createSession(
      {
        VITE_TEST_SIGN_IN: "1",
        VITE_SUPABASE_URL: "https://x.supabase.co",
      } as ImportMetaEnv,
      createClient,
    );
    expect(session.getState().status).toBe("signed-out");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("SEC-15 real use creates Supabase's client with the URL and the publishable key only", () => {
    createClient.mockReturnValue({ auth: fakeAuth().auth });
    createSession(
      {
        VITE_SUPABASE_URL: "https://x.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_k",
      } as ImportMetaEnv,
      createClient,
    );
    expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "sb_publishable_k", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "accountable.session",
      },
    });
  });

  it("DEP-2 without the Supabase settings, nobody can sign in and nothing is called", async () => {
    const session = createSession({} as ImportMetaEnv, createClient);
    expect(await session.signIn("a@b.example", "x")).toBe("unreachable");
    session.end();
    expect(session.getState().ended).toBe(true);
    await session.signOut();
    expect(session.getState().status).toBe("signed-out");
    expect(createClient).not.toHaveBeenCalled();
  });
});
