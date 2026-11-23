// The quality gate: `npm run check` runs every check and fails if any of them fails (ENG-7).
// Each check runs even when an earlier one failed, so one run shows everything to fix.
//
// Usage:
//   npm run check          formatting, lint, complexity, types, secrets, and every test with coverage
//   npm run check:quick    the same without the end-to-end tests
//   npm run lint           the same without any tests
//   npm run format         fixes what the formatting checks find (Prettier and ruff format)
// Node built-ins only, and no shell, so it behaves the same on Windows, macOS and Linux.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = join(root, "frontend");
const node = process.execPath;
const bin = (...path) => join(root, "node_modules", ...path);
const prettier = bin("prettier", "bin", "prettier.cjs");
const tsc = bin("typescript", "bin", "tsc");

const mode = process.argv[2] ?? "full";
if (!["full", "quick", "static"].includes(mode)) {
  console.error(`Unknown mode "${mode}": use full, quick or static.`);
  process.exit(2);
}

// [name, command, args, cwd]. The complexity limit (15) is in ESLint's and ruff's own configs.
const staticChecks = [
  ["Prettier (frontend)", node, [prettier, "--check", "."], frontend],
  [
    "Prettier (e2e, scripts)",
    node,
    [prettier, "--config", "frontend/.prettierrc", "--check", "e2e", "playwright.config.ts", "scripts"],
    root,
  ],
  ["ESLint (frontend)", node, [bin("eslint", "bin", "eslint.js"), "--max-warnings=0", "."], frontend],
  ["tsc (frontend app)", node, [tsc, "-p", "tsconfig.json"], frontend],
  ["tsc (frontend config)", node, [tsc, "-p", "tsconfig.node.json"], frontend],
  ["ruff format (backend)", "uv", ["run", "ruff", "format", "--check", "backend"], root],
  ["ruff check (backend)", "uv", ["run", "ruff", "check", "backend"], root],
  ["ty (backend)", "uv", ["run", "ty", "check"], root],
  // .gitleaks.toml allows the .env file only while git ignores it, which this checks first.
  [".env is git-ignored", "git", ["check-ignore", "--quiet", ".env"], root],
  ["gitleaks (git history)", "gitleaks", ["git", "--no-banner", "--redact", "."], root],
  ["gitleaks (working tree)", "gitleaks", ["dir", "--no-banner", "--redact", "."], root],
];
const runTests = join(root, "scripts", "run-tests.mjs");
const testChecks = {
  static: [],
  quick: [["Unit tests, coverage gates", node, [runTests, "unit", "--coverage"], root]],
  full: [["All tests, coverage gates", node, [runTests, "--coverage"], root]],
};
const INSTALL_HINTS = {
  uv: "Install uv (see docs/STATUS.md), then run `uv sync`.",
  gitleaks: "Install gitleaks: `winget install Gitleaks.Gitleaks` on Windows, `brew install gitleaks` on macOS.",
};

function run([name, command, args, cwd]) {
  console.log(`\n=== ${name} ===\n`);
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error)
    console.error(`Couldn't start ${command}: ${result.error.message}. ${INSTALL_HINTS[command] ?? ""}`);
  return { name, passed: !result.error && result.status === 0, seconds };
}

const results = [...staticChecks, ...testChecks[mode]].map(run);

console.log(`\n=== Summary (npm run check, ${mode}) ===\n`);
for (const { name, passed, seconds } of results) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name.padEnd(30)} ${seconds.padStart(6)}s`);
}
const failed = results.filter((r) => !r.passed);
if (failed.length > 0) {
  console.error(
    `\n${failed.length} of ${results.length} checks failed. Formatting can be fixed with \`npm run format\`.`,
  );
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed.`);
