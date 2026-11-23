// Claude Code PreToolUse hook: the agent may not change .env, the local secrets file. It blocks the file
// tools (Edit, Write, MultiEdit, NotebookEdit) on any file named .env, and shell commands that redirect
// into .env or start with a command that writes, moves or deletes it (best effort: a script that opens
// .env itself isn't seen). Exit code 2 blocks the call and shows the message to the agent.
// Node built-ins only. Configured in .claude/settings.json.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
// .env as a whole path segment: not .env.example, not my.env.
const NAMES_ENV = /(?:^|[\s"'=/\\:])\.env(?![\w.-])/i;
// Output redirected into .env (or some/dir/.env), anywhere in a command segment.
const REDIRECT_INTO_ENV = />{1,2}\s*["']?(?:[^\s"';&|>]*[/\\])?\.env(?![\w.-])/i;
// A segment that starts with a command that writes, moves or deletes the files it names.
const WRITE_COMMAND =
  /^\s*(?:sudo\s+)?(?:tee|sed\s+(?:\S+\s+)*-i|cp|mv|rm|ln|touch|truncate|dd|install|(?:Set|Add|Clear)-Content|Out-File|(?:New|Remove|Move|Copy|Rename)-Item)\b/i;

/** True when one of the command's segments (split on ; && || | and new lines) writes to .env. */
function writesEnv(command) {
  return command
    .split(/;|&&|\|\||\||\n/)
    .some((segment) => REDIRECT_INTO_ENV.test(segment) || (WRITE_COMMAND.test(segment) && NAMES_ENV.test(segment)));
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8").replace(/^﻿/, "") || "{}");
  } catch (error) {
    // Fail closed: a crash (exit 1) would let the tool call through.
    return block(`Blocked: the .env guard couldn't read the hook input (${error.message}).`);
  }
}

const input = readInput();
const tool = input.tool_name ?? "";
const args = input.tool_input ?? {};

if (FILE_TOOLS.has(tool)) {
  const path = String(args.file_path ?? args.notebook_path ?? "");
  if (basename(path.replace(/\\/g, "/")).toLowerCase() === ".env") {
    block(`Blocked: ${tool} on ${path}. The agent doesn't change .env; ask the engineer to edit it.`);
  }
}

if (SHELL_TOOLS.has(tool)) {
  const command = String(args.command ?? "");
  if (writesEnv(command)) {
    block("Blocked: this command names .env and could change it. The agent doesn't change .env; ask the engineer.");
  }
}
