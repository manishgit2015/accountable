// The one request the test-mode session makes itself: POST /api/test/sign-in (SEC-17). It lives in src/api/,
// where every fetch is (ENG-1), and goes around client.ts, which needs the session it creates.
export const testSignInFetch: typeof fetch = (input, init) => fetch(input, init);
