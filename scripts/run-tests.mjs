// The single verification entry point: `npm test` (ENG-7, spec 13.2).
// Runs pytest, then Vitest, then Playwright, stopping at the first failure with a nonzero exit.
// Every run gets a temporary database and the test ports (DEP-1). The real database,
// backend/data/accountable.db, is refused (RK-23).
//
// Usage: npm test [-- backend|frontend|e2e ...] [-- extra args for that one suite]
//   npm test                     all three suites
//   npm test -- backend          pytest only
//   npm test -- e2e smoke        Playwright, with "smoke" passed on as a filter
//   npm test -- unit             pytest and Vitest, without Playwright
//   npm test -- --coverage       also measure unit test coverage, failing under 80% (pytest-cov and
//                                Vitest's v8 coverage; thresholds in pyproject.toml and vitest.config.ts)
//   npm run test:perf            (= run-tests.mjs perf) V-P01 only: fills the temporary database with
//                                2 x the intent's volume (app.perfdata), then runs e2e/perf/ (T4.2).
//                                Not part of `npm test`.
//   node scripts/run-tests.mjs visual   V-M04 screenshots only: e2e/visual/ at 1440px, saved to
//                                docs/evidence/2026-11-22-visual/ for comparing by eye (T5.2). Not part of `npm test`.
// Node built-ins only, and no shell, so it behaves the same on Windows, macOS and Linux.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB = resolve(root, "backend", "data", "accountable.db");
const SUITES = ["backend", "frontend", "e2e"];
const GROUPS = { unit: ["backend", "frontend"] };

const allArgs = process.argv.slice(2);
const coverage = allArgs.includes("--coverage");
const args = allArgs.filter((arg) => arg !== "--coverage");
const perf = args[0] === "perf";
const visual = args[0] === "visual";
const named = SUITES.includes(args[0]) ? [args[0]] : GROUPS[args[0]];
const chosen = perf ? ["perfdata", "perf"] : visual ? ["visual"] : (named ?? SUITES);
const extra = perf || visual || named ? args.slice(1) : args;
const backendCoverage = coverage ? ["--cov"] : [];
const frontendCoverage = coverage ? ["--coverage"] : [];

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
  ACCOUNTABLE_PERF: perf ? "1" : "",
  ACCOUNTABLE_VISUAL: visual ? "1" : "",
};

// The end-to-end and performance runs fix the backend's clock at the browser's fixed time
// (FIXED_NOW in e2e/fixtures.ts), so "today" and "this month" agree on any day (engineer's decision,
// Phase 4). pytest fixes its own clock, and `npm run dev` never sets this.
const E2E_FIXED_NOW = "2026-11-21T14:30:00";
const browserSuites = new Set(["e2e", "perfdata", "perf", "visual"]);

const node = process.execPath;
const commands = {
  backend: ["uv", ["run", "pytest", ...backendCoverage, ...extra], root],
  frontend: [
    node,
    [join(root, "node_modules", "vitest", "vitest.mjs"), "run", ...frontendCoverage, ...extra],
    join(root, "frontend"),
  ],
  e2e: [node, [join(root, "node_modules", "@playwright", "test", "cli.js"), "test", ...extra], root],
  perfdata: ["uv", ["run", "--no-sync", "--directory", "backend", "python", "-m", "app.perfdata"], root],
  perf: [node, [join(root, "node_modules", "@playwright", "test", "cli.js"), "test", ...extra], root],
  visual: [node, [join(root, "node_modules", "@playwright", "test", "cli.js"), "test", ...extra], root],
};

let status = 0;
try {
  for (const suite of chosen) {
    const [command, commandArgs, cwd] = commands[suite];
    console.log(`\n=== ${suite} tests (database ${testDb}) ===\n`);
    const suiteEnv = browserSuites.has(suite) ? { ...env, ACCOUNTABLE_FIXED_NOW: E2E_FIXED_NOW } : env;
    const result = spawnSync(command, commandArgs, { cwd, env: suiteEnv, stdio: "inherit" });
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
