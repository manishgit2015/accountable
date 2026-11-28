// `npm run dev:test`: the app in test mode, for the ui-check agent and for looking around without Supabase
// (DEP-1, SEC-17, ADR-027). Like the test runs: a temporary SQLite database that starts with the sample data,
// the test ports (API 8001, page 5174), an ES256 key pair made for this session, and no Supabase setting, so
// sign-in is the test sign-in (priya@test.example, sam@test.example or noname@test.example, password "test").
// It refuses to start with DATABASE_URL set. Stop it with Ctrl+C; the temporary database is then removed.
// Node built-ins only, plus concurrently, which npm run dev uses too.
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if ((process.env.DATABASE_URL ?? "").trim()) {
  console.error("Refusing to start the test app with DATABASE_URL set. It only uses a temporary local SQLite file.");
  process.exit(2);
}

function testAuthKeys() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  return JSON.stringify({
    keys: [{ ...jwk, kid: `test-${randomBytes(6).toString("hex")}`, alg: "ES256", use: "sig" }],
  });
}

const tempDir = mkdtempSync(join(tmpdir(), "accountable-dev-test-"));
const { DATABASE_URL: _url, SUPABASE_URL: _supabase, SUPABASE_PUBLISHABLE_KEY: _key, ...inherited } = process.env;
const env = {
  ...inherited,
  ACCOUNTABLE_TEST_AUTH_KEYS: testAuthKeys(),
  ACCOUNTABLE_DB: join(tempDir, "test.db"),
  ACCOUNTABLE_API_PORT: "8001",
  ACCOUNTABLE_WEB_PORT: "5174",
  ACCOUNTABLE_RELOAD: "",
};

console.log("Accountable in test mode: open http://127.0.0.1:5174 and sign in as priya@test.example, password test.");
const servers = spawn(
  process.execPath,
  [
    join(root, "node_modules", "concurrently", "dist", "bin", "index.js"),
    "--kill-others",
    "--names",
    "api,web",
    "--prefix-colors",
    "cyan,green",
    "uv run --no-sync --directory backend python -m app.main",
    "npm run dev --workspace frontend",
  ],
  { cwd: root, env, stdio: "inherit" },
);

function cleanUp() {
  rmSync(tempDir, { recursive: true, force: true });
}
servers.on("exit", (code) => {
  cleanUp();
  process.exit(code ?? 0);
});
process.on("SIGINT", () => servers.kill("SIGINT"));
