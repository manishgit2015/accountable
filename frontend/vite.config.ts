// Vite dev server: 127.0.0.1 only (SEC-1), port from ACCOUNTABLE_WEB_PORT (DEP-2), and /api proxied
// to the backend by address, not by "localhost" (RK-2). The proxy keeps the browser's Host and
// Origin, which the backend's checks accept (SEC-2, SEC-3). Vite's own allowed-hosts check stays
// at its local-only default.
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";

const webPort = Number(process.env.ACCOUNTABLE_WEB_PORT || 5173);
const apiPort = Number(process.env.ACCOUNTABLE_API_PORT || 8000);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * What the browser is given from the settings (SEC-15): SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, and nothing
 * else from the root .env. In test mode (ACCOUNTABLE_TEST_AUTH_KEYS, set only by the test runs, SEC-17) it gets
 * neither, and signs in through the backend's test sign-in instead, so the tests never reach Supabase.
 */
function browserSettings(mode: string): Record<string, string> {
  const testSignIn = Boolean(process.env.ACCOUNTABLE_TEST_AUTH_KEYS);
  const env = testSignIn ? {} : loadEnv(mode, repoRoot, ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]);
  return {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.SUPABASE_URL ?? ""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY ?? ""),
    "import.meta.env.VITE_TEST_SIGN_IN": JSON.stringify(testSignIn ? "1" : ""),
  };
}

export default defineConfig(({ mode }) => ({
  define: browserSettings(mode),
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}` },
    },
  },
  preview: { host: "127.0.0.1" },
  // Pre-bundle the runtime packages on start-up. Otherwise Vite finds them on the first page load and
  // answers 504 "Outdated Optimize Dep" while it re-bundles, which shows as a console error (R7, V-E00).
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom/client",
      "react-router",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "react-hook-form",
      "zod",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "lucide-react",
      "@supabase/supabase-js",
    ],
  },
}));
