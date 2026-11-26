// Two repository conventions that `npm run check` enforces mechanically (docs/IMPROVE.md, from the mvp-darkmode
// change's reviews). Node built-ins only.
//
//   node scripts/check-conventions.mjs change-folder [branch]
//     The current branch has its change folder, docs/changes/<branch>/intent.md (AGENTS.md). Passes on main and
//     on a detached HEAD. The optional branch argument stands in for the current one, to test the check.
//   node scripts/check-conventions.mjs no-skipped-tests [path ...]
//     No test is skipped, focused or left as a to-do: a skipped test passes while checking nothing. Scans
//     frontend/src, e2e and backend/tests, or the paths given.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);

function changeFolder(branchArg) {
  const branch = branchArg ?? execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  if (branch === "" || branch === "main") {
    console.log(`On ${branch || "a detached HEAD"}: no change folder needed.`);
    return true;
  }
  const intent = join("docs", "changes", branch, "intent.md");
  if (existsSync(join(root, intent))) {
    console.log(`Branch "${branch}" has its change folder (${intent}).`);
    return true;
  }
  console.error(
    `Branch "${branch}" has no ${intent}. AGENTS.md names each change's folder after its branch: ` +
      `rename the folder or the branch (the engineer decides which).`,
  );
  return false;
}

// Vitest and Playwright: it/test/describe with skip, only, todo, fixme, skipIf or runIf. pytest: skip markers.
const SKIPS = [
  /\b(?:it|test|describe)\.(?:skip|only|todo|fixme|skipIf|runIf)\b/,
  /\bpytest\.mark\.(?:skip|skipif|xfail)\b/,
  /\bpytest\.skip\(/,
];
const TEST_FILE = /(\.test\.tsx?|\.spec\.ts|fixtures\.ts|(^|[\\/])test_[^\\/]*\.py|conftest\.py)$/;

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) =>
    name === "node_modules" || name === "__pycache__" ? [] : files(join(path, name)),
  );
}

function noSkippedTests(paths) {
  const scan =
    paths.length > 0
      ? paths.map((p) => resolve(p))
      : ["frontend/src", "e2e", "backend/tests"].map((p) => join(root, p));
  const found = [];
  for (const file of scan.flatMap(files).filter((f) => TEST_FILE.test(f))) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (SKIPS.some((pattern) => pattern.test(line))) found.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
      });
  }
  if (found.length === 0) {
    console.log("No skipped, focused or to-do tests.");
    return true;
  }
  console.error("Skipped, focused or to-do tests (a skipped test passes while checking nothing):");
  for (const line of found) console.error(`  ${line}`);
  return false;
}

const checks = { "change-folder": () => changeFolder(args[0]), "no-skipped-tests": () => noSkippedTests(args) };
if (!(command in checks)) {
  console.error(`Usage: node scripts/check-conventions.mjs ${Object.keys(checks).join(" | ")} [args]`);
  process.exit(2);
}
process.exit(checks[command]() ? 0 : 1);
