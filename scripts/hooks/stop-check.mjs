// Claude Code Stop hook: when the agent finishes a turn, run `npm run check:quick`. If it fails, block the
// stop once and send the failing checks' output back to the agent to fix. When the agent is already
// continuing because of this hook (stop_hook_active), it lets the stop through, so it can't loop.
// Node built-ins only. Configured in .claude/settings.json.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINES_PER_FAILURE = 60;

const input = JSON.parse(readFileSync(0, "utf8").replace(/^﻿/, "") || "{}");
if (input.stop_hook_active) process.exit(0);

// 2>&1 keeps each check's errors next to its heading (sh and cmd.exe both understand it).
const command = `"${process.execPath}" "${join(root, "scripts", "check.mjs")}" quick 2>&1`;
const result = spawnSync(command, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.status === 0) process.exit(0);

// Colour codes would only be noise for the agent.
const output = (result.stdout ?? "").replace(/\x1b\[[0-9;]*m/g, "");
const summary = output.slice(output.lastIndexOf("=== Summary"));
const failed = [...summary.matchAll(/^\s*FAIL\s+(.+?)\s+[\d.]+s$/gm)].map((match) => match[1]);

function sectionOf(name) {
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

const details = failed.length > 0 ? failed.map(sectionOf).join("\n\n") : output.slice(-4000);
const reason = [
  "`npm run check:quick` failed. Fix what it found (without weakening a rule), then finish.",
  "This hook blocks once; it won't block again on the next stop.",
  "",
  summary.trim() || `check.mjs exited with ${result.status ?? result.error?.message}`,
  "",
  details,
].join("\n");
console.log(JSON.stringify({ decision: "block", reason }));
