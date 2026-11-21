// The single verification entry point: `npm test` (ENG-7, spec 13.2).
// Runs pytest, then Vitest, then Playwright, stopping at the first failure with a nonzero exit.
// Every run gets a temporary database and the test ports (DEP-1). The real database,
// backend/data/accountable.db, is refused (RK-23).
//
// Usage: npm test [-- backend|frontend|e2e ...] [-- extra args for that one suite]
//   npm test                     all three suites
//   npm test -- backend          pytest only
//   npm test -- e2e smoke        Playwright, with "smoke" passed on as a filter
// Node built-ins only, and no shell, so it behaves the same on Windows, macOS and Linux.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB = resolve(root, "backend", "data", "accountable.db");
const SUITES = ["backend", "frontend", "e2e"];

const args = process.argv.slice(2);
const chosen = SUITES.includes(args[0]) ? [args[0]] : SUITES;
const extra = SUITES.includes(args[0]) ? args.slice(1) : args;

const tempDir = mkdtempSync(join(tmpdir(), "accountable-test-"));
const testDb = resolve(process.env.ACCOUNTABLE_TEST_DB || join(tempDir, "test.db"));
if (testDb.toLowerCase() === DEFAULT_DB.toLowerCase()) {
  console.error(`Refusing to run the tests against the real database (${DEFAULT_DB}).`);
  process.exit(2);
}

const env = {
  ...process.env,
  ACCOUNTABLE_DB: testDb,
  ACCOUNTABLE_API_PORT: "8001",
  ACCOUNTABLE_WEB_PORT: "5174",
  ACCOUNTABLE_RELOAD: "",
};

const node = process.execPath;
const commands = {
  backend: ["uv", ["run", "pytest", ...extra], root],
  frontend: [node, [join(root, "node_modules", "vitest", "vitest.mjs"), "run", ...extra], join(root, "frontend")],
  e2e: [node, [join(root, "node_modules", "@playwright", "test", "cli.js"), "test", ...extra], root],
};

let status = 0;
try {
  for (const suite of chosen) {
    const [command, commandArgs, cwd] = commands[suite];
    console.log(`\n=== ${suite} tests (database ${testDb}) ===\n`);
    const result = spawnSync(command, commandArgs, { cwd, env, stdio: "inherit" });
    if (result.error) {
      console.error(`Couldn't start the ${suite} tests: ${result.error.message}`);
      status = 1;
      break;
    }
    if (result.status !== 0) {
      console.error(`\nThe ${suite} tests failed (exit code ${result.status}). Stopping here.`);
      status = result.status || 1;
      break;
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (status === 0) console.log(`\nAll tests passed: ${chosen.join(", ")}.`);
process.exit(status);
