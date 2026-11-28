# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

Read `docs/spec.md` first: a short summary of the whole product and the index of its area files. Then read only the area files in `docs/specs/` that the current change touches. Together they describe the whole product as it stands today, and they're the authority on how the product behaves.

- `docs/spec.md`: the product's summary, and the index of the area files, with the section and IDs each one holds
- `docs/specs/<area>.md`: the product in detail, one file per area (for example `docs/specs/deals.md`): requirements, contracts, data, architecture, decisions, tests
- `docs/changes/<branch name>/`: one folder per change, named after its git branch, with the change's `intent.md` (why, and what success looks like) and `plan.md` (how it's built and verified)
- `docs/TECH_STACK.md`: the stack
- `docs/STANDARDS.md`: the coding standards; follow them in every change
- `docs/STATUS.md`: what's done so far, how to run the app, and what's next
- `docs/REVIEW.md`: how a change is reviewed before it merges
- `docs/IMPROVE.md`: how the harness is improved from evidence, including the harness notes to log when a check or review catches your mistake

## Working on a change

- Find the current change from the branch name (`git branch --show-current`) and read only its folder, `docs/changes/<branch name>/`. Don't read other changes' folders: they're history, and the spec already includes what they changed.
- A new change starts by creating its folder with an `intent.md`, then a `plan.md`.
- Keep the spec files the change affects up to date in the same change, on its branch: every area file in `docs/specs/` whose behavior, contracts, data, decisions or tests change, and `docs/spec.md` when its summary, index or ID table changes. By the time the change merges, they describe the product with the change in it.
- Update `docs/STATUS.md` when you finish a piece of work.

## Checking your work

- `npm test` runs every test: the backend unit and integration tests (pytest), the frontend unit tests (Vitest), and the end-to-end tests in the installed Google Chrome (Playwright). It starts the servers itself on test ports with a temporary database, so nothing else needs to be running, and it never touches `backend/data/accountable.db`. It exits nonzero if any test fails.
- `npm test -- backend`, `npm test -- frontend` or `npm test -- e2e` runs one suite; `npm test -- unit` runs pytest and Vitest.
- `npm run check` is the quality gate: formatting (Prettier, ruff format), lint (ESLint with the TypeScript, React Hooks and accessibility rules; ruff), a complexity limit of 15 per function, types (tsc, ty), a secrets scan (gitleaks), and `npm test` with unit test coverage of at least 80%, and 90% of the lines in `backend/app/rules.py` and `services/`. It runs every check, prints a summary and exits nonzero if any failed. Run it before you say a change is done, don't claim it passed unless you ran it, and fix what it finds without weakening a rule; if a rule doesn't suit the project, ask the engineer first.
- `npm run check:quick` runs the same without the end-to-end tests, for quick feedback while working. `npm run lint` runs only the checks that aren't tests.
- `npm run format` fixes the formatting.
- `npm run check` also checks two conventions: the current branch has its change folder, `docs/changes/<branch>/intent.md`, and no test is skipped, focused or left as a to-do (`scripts/check-conventions.mjs`).
- Prove each new test with a probe: break the code the way it would really break, run the test and see it fail, then restore the code and see it pass. Record the probe in the build log. "The way it would really break" means, for example, making the browser API itself fail rather than a method you stubbed, and checking a file's contents aren't empty before scanning them. A probe counts only when its test fails for the reason it targets: read the failure, and change only the behavior under test, never a name, an import or the syntax the code needs (a crash or a NameError proves nothing).
- When a check, a hook, a probe or a review catches your mistake, add the `Harness note:` line (format in `docs/IMPROVE.md`) to the task's build log entry at once, not at the end of the change.
- When the spec states something a person sees (a size, a color, a position, a scroll position), assert it in Playwright from the rendered page. jsdom has no layout, and a check by eye can miss it.
- When you walk through screens by eye (AC9), keep what a reviewer needs to repeat it: save the screenshots under `docs/evidence/<date>-<change>/`, and keep the script that took them there too, or in the change's tests, rather than deleting it.
- Run `npm run check` in the foreground. The Stop hook runs `npm run check:quick` when you stop, and two runs at once share coverage files and test ports, so both can fail.
- Record evidence for each task of the current change's `plan.md` in `docs/build_logs.log`.

## On Windows

- Windows Application Control on this machine blocks some Python tools' `.exe` launchers (`pip-audit.exe`, `coverage.exe`): run them as `uv run python -m <tool>`. PowerShell blocks `npm.ps1`: use `npm.cmd`.
- Git Bash and Node disagree about paths (`/tmp` isn't the same folder for both), and inline shell strings lose backslashes. Put test inputs with Windows paths, and scripts longer than a few lines, in files in a temporary folder outside the repository, and pass paths as arguments.
- Change code that holds backslash escapes (`\n`, `\r`, regular expressions) with the file edit tools, never by writing it through a Python or shell string, which turns the escapes into real line breaks or control characters. Python's `write_text` also writes CRLF here: write bytes, or use the edit tools. Read the changed lines afterwards.

## Hooks

- **git pre-commit** (lefthook, `lefthook.yml`, installed by `npm install`): formats the staged files (Prettier, ruff format), then runs ESLint, tsc, ruff check, ty and gitleaks on what's staged. No tests, so it stays quick.
- **Stop** (`.claude/settings.json`, `scripts/hooks/stop-check.mjs`): when you finish a turn, `npm run check:quick` runs. If it fails, the stop is blocked once and the failures come back to you to fix. On the next stop the checks run again: if they still fail you may stop, but say plainly what still fails (the engineer is shown the failures too). Never say the checks pass unless they did.
- **PreToolUse** (`scripts/hooks/protect-env.mjs`): edits to `.env` are blocked before they run: the file tools on any file named `.env` (after resolving relative paths and links) or hard-linked to the project's `.env`, and shell commands that redirect into `.env` or write, move, link or delete it. Ask the engineer to change `.env`. The shell check is best effort, so don't work around it with scripts.
