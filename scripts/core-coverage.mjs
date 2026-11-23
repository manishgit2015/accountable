// Spec 13.2's stricter gate: at least 90% of the lines in backend/app/rules.py and services/ are covered
// (REV-003). Reads the coverage data the backend run just wrote. Lines only: `coverage report
// --fail-under` would mix in branches, which can hide uncovered lines. Run by `npm test -- --coverage`.
// `python -m coverage`, because Windows Application Control can block coverage.exe.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = "backend/app/rules.py,backend/app/services/*";
const MINIMUM = 90;

const run = spawnSync("uv", ["run", "python", "-m", "coverage", "json", `--include=${INCLUDE}`, "-o", "-"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (run.status !== 0) {
  console.error(`Couldn't read the coverage data: ${run.stderr || run.error?.message}`);
  process.exit(1);
}

const { files, totals } = JSON.parse(run.stdout);
for (const [path, file] of Object.entries(files)) {
  console.log(`  ${file.summary.percent_statements_covered.toFixed(1).padStart(5)}%  ${path}`);
}
const lines = totals.percent_statements_covered;
const verdict = `Lines covered in rules.py and services/: ${lines.toFixed(1)}% (${totals.covered_lines}/${totals.num_statements}), minimum ${MINIMUM}%.`;
if (lines < MINIMUM) {
  console.error(`\n${verdict} Too low.`);
  process.exit(1);
}
console.log(`\n${verdict}`);
