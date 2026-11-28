// First-run check for `npm run dev` (R1, R2, DEP-3).
// Node built-ins only, and no shell syntax, so it works the same on Windows, macOS and Linux.
// It checks Node 24+ and uv, then runs `npm install` and `uv sync` only when the lockfiles
// changed since the last successful install, then that .env has the Supabase settings (DEP-3). When
// everything is in place it makes no network call.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_PORT = process.env.ACCOUNTABLE_WEB_PORT || "5173";

export const REQUIRED_SETTINGS = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];

/** The names set in a .env file's text, with their values. Comments and blank lines are skipped. */
export function readEnvText(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2").trim();
  }
  return values;
}

/** Which of REQUIRED_SETTINGS have no value in either .env or the environment (the environment wins). */
export function missingSettings(fromFile, environment) {
  return REQUIRED_SETTINGS.filter((name) => !(environment[name] ?? fromFile[name] ?? "").trim());
}

/** The message naming what's missing. It never holds a value. */
export function missingMessage(missing) {
  return (
    `Accountable needs ${missing.join(", ")} in .env, and ${missing.length === 1 ? "it isn't" : "they aren't"} there.\n` +
    "Add them from the Supabase dashboard (Connect, Session pooler for DATABASE_URL; Project Settings, API for the\n" +
    'other two), then run "npm run dev" again. The runbook in docs/STATUS.md says where each one comes from.'
  );
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function fingerprint(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    const path = join(root, file);
    hash.update(file);
    hash.update(existsSync(path) ? readFileSync(path) : "missing");
  }
  return hash.digest("hex");
}

function isCurrent(marker, print) {
  return existsSync(marker) && readFileSync(marker, "utf8").trim() === print;
}

function run(command, args, what, shell = false) {
  console.log(`Accountable: ${what}...`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : `exit code ${result.status}`;
    fail(`Accountable: ${what} failed (${reason}). Check your internet connection and run "npm run dev" again.`);
  }
}

function main() {
  // 1. Node 24 or later
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 24) {
    fail(
      `Accountable needs Node.js 24 or later, and this is Node ${process.versions.node}.\n` +
        'Install the current LTS from https://nodejs.org, then run "npm run dev" again.',
    );
  }

  // 2. uv
  const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
  if (uv.error || uv.status !== 0) {
    fail(
      'Accountable needs uv to run its Python backend, and "uv" wasn\'t found.\n' +
        'Install it from https://docs.astral.sh/uv/getting-started/installation/, open a new terminal, then run "npm run dev" again.',
    );
  }

  // 3. npm packages, only when package files changed since the last install
  const npmFiles = ["package.json", "package-lock.json", "frontend/package.json"];
  const npmMarker = join(root, "node_modules", ".accountable-installed");
  const npmPrint = fingerprint(npmFiles);
  if (!isCurrent(npmMarker, npmPrint)) {
    const npmCli = process.env.npm_execpath;
    if (npmCli) {
      run(process.execPath, [npmCli, "install"], "installing the frontend packages");
    } else {
      // Started with node rather than through npm: use npm from the PATH (a shell finds npm.cmd on Windows).
      run("npm", ["install"], "installing the frontend packages", true);
    }
    writeFileSync(npmMarker, fingerprint(npmFiles));
  }

  // 4. Python packages, only when the project or lock changed since the last sync
  const uvFiles = ["pyproject.toml", "uv.lock", ".python-version"];
  const uvMarker = join(root, ".venv", ".accountable-synced");
  const uvPrint = fingerprint(uvFiles);
  if (!isCurrent(uvMarker, uvPrint)) {
    run("uv", ["sync"], "installing the backend packages (and Python 3.12 if needed)");
    writeFileSync(uvMarker, fingerprint(uvFiles));
  }

  // 5. The Supabase settings a real start needs (DEP-2, DEP-3, ADR-027), from .env or the environment. Only
  //    whether each has a value is checked, and no value is printed. Test runs never come here (npm test).
  const envFile = join(root, ".env");
  const fromFile = existsSync(envFile) ? readEnvText(readFileSync(envFile, "utf8")) : {};
  const missing = missingSettings(fromFile, process.env);
  if (missing.length > 0) fail(missingMessage(missing));

  console.log(`Accountable: ready. Open http://127.0.0.1:${WEB_PORT} once both servers have started.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
