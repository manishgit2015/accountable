// The settings vite.config.ts gives the browser, and nothing else (SEC-15).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** "1" in test mode only: sign in through the backend's test sign-in, never Supabase (SEC-17). */
  readonly VITE_TEST_SIGN_IN?: string;
}
