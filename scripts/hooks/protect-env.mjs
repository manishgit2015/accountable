// Claude Code PreToolUse hook: the agent may not change .env, the local secrets file. Reading is not
// blocked here (the permission rules in .claude/settings.json decide that). Exit code 2 blocks the call
// before it runs and shows the reason to the agent. Node built-ins only.
//
// File tools (Edit, Write, MultiEdit, NotebookEdit): the target is resolved against the agent's working
// directory and through symlinks and junctions, then blocked if it is named .env, or is the same file as
// the project's .env (a hard link).
// Shell tools (Bash, PowerShell), best effort: blocked if a command segment redirects into .env, or starts
// with a command that writes, moves, links or deletes and names .env. Not seen: a program or script that
// opens .env itself (python, node, sh -c, a variable holding the path), and MCP tools.

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJECT_ENV = resolve(root, ".env");
const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
// .env as a whole path segment: not .env.example, not my.env.
const NAMES_ENV = /(?:^|[\s"'=/\\:])\.env(?![\w.-])/i;
// Output redirected into .env (or some/dir/.env), anywhere in a command segment.
const REDIRECT_INTO_ENV = />{1,2}\s*["']?(?:[^\s"';&|>]*[/\\])?\.env(?![\w.-])/i;
// A segment that starts with a command that writes, moves, links or deletes the files it names.
const WRITE_COMMAND =
  /^\s*(?:sudo\s+)?(?:tee|sed\s+(?:\S+\s+)*-i|cp|mv|rm|ln|touch|truncate|dd|install|(?:Set|Add|Clear)-Content|Out-File|(?:New|Remove|Move|Copy|Rename)-Item)\b/i;

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

/** The file a write would really land in: the target itself if it exists, else its folder, links followed. */
function realTarget(path) {
  if (existsSync(path)) return realpathSync.native(path);
  const folder = dirname(path);
  return existsSync(folder) ? resolve(realpathSync.native(folder), basename(path)) : path;
}

function isSameFile(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const [first, second] = [statSync(a), statSync(b)];
  return first.ino !== 0 && first.dev === second.dev && first.ino === second.ino;
}

function isEnvFile(path, cwd) {
  const given = resolve(cwd, path);
  const real = realTarget(given);
  return [given, real].some((p) => basename(p).toLowerCase() === ".env") || isSameFile(real, PROJECT_ENV);
}

/** True when one of the command's segments (split on ; && || | and new lines) writes to .env. */
function writesEnv(command) {
  return command
    .split(/;|&&|\|\||\||\n/)
    .some((segment) => REDIRECT_INTO_ENV.test(segment) || (WRITE_COMMAND.test(segment) && NAMES_ENV.test(segment)));
}

const input = readInput();
const tool = input.tool_name ?? "";
const args = input.tool_input ?? {};
const cwd = input.cwd ?? process.cwd();

if (FILE_TOOLS.has(tool)) {
  const path = String(args.file_path ?? args.notebook_path ?? "");
  if (path && isEnvFile(path, cwd)) {
    block(`Blocked: ${tool} on ${path} would change a .env file. The agent doesn't change .env; ask the engineer.`);
  }
}

if (SHELL_TOOLS.has(tool) && writesEnv(String(args.command ?? ""))) {
  block("Blocked: this command could change a .env file. The agent doesn't change .env; ask the engineer.");
}
