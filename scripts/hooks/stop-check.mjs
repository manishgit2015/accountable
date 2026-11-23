// Claude Code Stop hook: when the agent finishes a turn, run `npm run check:quick`.
// - First stop, checks fail: block the stop once and send the failing checks' output back to the agent.
// - Stop after that correction attempt (stop_hook_active): run the checks again. If they still fail, let the
//   agent stop (so it can't loop) and show the remaining failures to the engineer as a system message.
// - Checks pass: stop normally, with no output.
// Node built-ins only. Configured in .claude/settings.json.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINES_PER_FAILURE = 60;

/** Runs check:quick; returns null when it passes, or its summary and the failing checks' output. */
function runQuickCheck() {
  // 2>&1 keeps each check's errors next to its heading (sh and cmd.exe both understand it).
  const command = `"${process.execPath}" "${join(root, "scripts", "check.mjs")}" quick 2>&1`;
  const result = spawnSync(command, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status === 0) return null;

  // Colour codes would only be noise for the agent.
  const output = (result.stdout ?? "").replace(/\x1b\[[0-9;]*m/g, "");
  const summaryStart = output.lastIndexOf("=== Summary");
  const summary =
    summaryStart < 0 ? `check.mjs exited with ${result.status ?? result.error?.message}` : output.slice(summaryStart);
  const failed = [...summary.matchAll(/^\s*FAIL\s+(.+?)\s+[\d.]+s$/gm)].map((match) => match[1]);
  const details = failed.length > 0 ? failed.map((name) => sectionOf(output, name)).join("\n\n") : output.slice(-4000);
  return { summary: summary.trim(), details };
}

function sectionOf(output, name) {
  const start = output.indexOf(`=== ${name} ===`);
  if (start < 0) return "";
  const end = output.indexOf("\n=== ", start + 1);
  const lines = output
    .slice(start, end < 0 ? undefined : end)
    .trimEnd()
    .split("\n");
  return lines.length > LINES_PER_FAILURE
    ? [lines[0], "...", ...lines.slice(-LINES_PER_FAILURE)].join("\n")
    : lines.join("\n");
}

const input = JSON.parse(readFileSync(0, "utf8").replace(/^﻿/, "") || "{}");
const failure = runQuickCheck();
if (!failure) process.exit(0);

if (input.stop_hook_active) {
  const message = [
    "`npm run check:quick` still fails after the agent's one correction attempt. The agent was allowed to stop;",
    "these failures are not fixed:",
    "",
    failure.summary,
    "",
    failure.details,
  ].join("\n");
  console.log(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

const reason = [
  "`npm run check:quick` failed. Fix what it found (without weakening a rule), then finish.",
  "This hook blocks once. If the checks still fail on your next stop, you may stop: say plainly what still fails.",
  "",
  failure.summary,
  "",
  failure.details,
].join("\n");
console.log(JSON.stringify({ decision: "block", reason }));
