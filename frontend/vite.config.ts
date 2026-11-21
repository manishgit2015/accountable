// Vite dev server: 127.0.0.1 only (SEC-1), port from ACCOUNTABLE_WEB_PORT (DEP-2), and /api proxied
// to the backend by address, not by "localhost" (RK-2). The proxy keeps the browser's Host and
// Origin, which the backend's checks accept (SEC-2, SEC-3). Vite's own allowed-hosts check stays
// at its local-only default.
import { defineConfig } from "vite";

const webPort = Number(process.env.ACCOUNTABLE_WEB_PORT || 5173);
const apiPort = Number(process.env.ACCOUNTABLE_API_PORT || 8000);

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}` },
    },
  },
  preview: { host: "127.0.0.1" },
});
