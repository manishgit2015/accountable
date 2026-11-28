// Signing in as a test person in the end-to-end tests (SEC-17, ADR-025): never a real password, never Supabase.
// The backend's POST /api/test/sign-in signs a token with the test run's key; the browser gets it the way the
// app's test-mode session keeps it (frontend/src/lib/session.ts), and API calls made by a test send it too.
import type { APIRequestContext, BrowserContext } from "@playwright/test";

export const PRIYA = "priya@test.example";
export const SAM = "sam@test.example";
export const TEST_PASSWORD = "test";

/** frontend/src/lib/session.ts's TEST_SESSION_KEY. */
const TEST_SESSION_KEY = "accountable.test-session";

/** A test person's access token, from the backend at `base` (the web port, through Vite's proxy, or the API). */
export async function testToken(request: APIRequestContext, base: string, email: string): Promise<string> {
  const origin = new URL(base).origin;
  const response = await request.post(`${base}/api/test/sign-in`, {
    data: { email, password: TEST_PASSWORD },
    headers: { Origin: origin },
  });
  if (!response.ok()) throw new Error(`Test sign-in as ${email} failed: ${response.status()} ${await response.text()}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/**
 * The browser starts signed in: the token is put where the app looks for it, before the page's own scripts
 * run, once per tab, so a reload keeps the session and signing out sticks. Only the app sends it from the
 * browser, so a test fails if the app stops sending it (R102). A test's own API calls use the `request` fixture.
 */
export async function signInBrowser(context: BrowserContext, token: string, browserNow: Date): Promise<void> {
  const saved = JSON.stringify({ token, expiresAt: browserNow.getTime() + 12 * 3600 * 1000 });
  await context.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem("e2e-signed-in")) return;
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem("e2e-signed-in", "1");
    },
    [TEST_SESSION_KEY, saved] as const,
  );
}
