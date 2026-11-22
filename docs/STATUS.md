The MVP is released as `v0.1.0` (22 Nov 2026), built from `docs/changes/mvp/plan.md`, phases 0 to 5. `docs/spec.md` describes the whole product, and each change has its own folder in `docs/changes/`. A few verification runs are still open (see "Next").

## Using Accountable

Accountable runs on your own computer only. Nothing leaves it, and it works without the internet once installed.

### Install (once)

1. **Node.js 24 or later.** Install the current LTS from https://nodejs.org. Check with `node --version`.
2. **uv** (it runs the Python backend and downloads Python 3.12 for you). Follow https://docs.astral.sh/uv/getting-started/installation/: on Windows `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`, on macOS and Linux `curl -LsSf https://astral.sh/uv/install.sh | sh`. Open a new terminal afterwards. Check with `uv --version`.
3. **Google Chrome**, only if you run the tests.
4. Get the code: `git clone <repository>` and `cd accountable`.

The first `npm run dev` installs the rest itself (the npm packages, the Python packages and Python 3.12), so the first run needs the internet. Later runs don't.

### Run

- `npm run dev`, then open **http://127.0.0.1:5173**. The first run on a new database loads the sample data.
- On Windows, if PowerShell says "running scripts is disabled", type `npm.cmd` instead of `npm` (for example `npm.cmd run dev`).
- Stop it with Ctrl+C in that terminal (on Windows, answer `Y` to "Terminate batch job").
- The app listens on 127.0.0.1 only (ports 8000 for the API and 5173 for the page), so other computers can't reach it.
- Optional settings: `ACCOUNTABLE_DB` (database path), `ACCOUNTABLE_API_PORT`, `ACCOUNTABLE_WEB_PORT`, `ACCOUNTABLE_LOG_LEVEL` (default `INFO`) and `ACCOUNTABLE_RELOAD=1` (restart the backend when its code changes, for development).

### Sample data and starting fresh

- `npm run seed` replaces **all** data with the sample data.
- `npm run clear` deletes **all** data, to start with your real data.
- Both ask "Type yes to continue" first, and change nothing unless you type `yes`. Add `-- --yes` to skip the question (`npm run clear -- --yes`). They work while the app is running; reload the page afterwards.

### Back up and restore

Your data is in the `backend/data/` folder: `accountable.db`, and while the app runs also `accountable.db-wal` and `accountable.db-shm`. The `-wal` file can hold your latest changes, so always copy the whole folder, never the `.db` file alone.

- **Back up:** stop the app (Ctrl+C), then copy the `backend/data/` folder somewhere safe, for example `backend/data-backup-2026-11-22/` or another drive.
- **Restore:** stop the app, delete or rename `backend/data/`, put the copied folder back as `backend/data/`, then `npm run dev`.
- **Before upgrading** (pulling a new version), back up first. Database upgrades only go forward, so restoring the copy is the way back.
- Accountable doesn't make backups itself.

### Logs

- Every request is logged to the terminal and to `backend/logs/accountable.log` (rotated at 5 MB, keeping 3 old files). Lines never contain your data: only the time, a request ID, the method, the path pattern, the status and the time taken.
- When the app shows an error with "Reference: 9f2c", search the log for `9f2c` to find that request.
- Start-up logs the address, the database path, the schema version and whether sample data was loaded.
- `http://127.0.0.1:5173/api/health` answers `{"status":"ok",...}` when the app and its database are working.

### When something goes wrong (runbook)

| Symptom | Action |
|---|---|
| "Port 8000 (or 5173) is already in use" | Close the other copy of Accountable, or the program using that port, and run `npm run dev` again. On Windows, a copy left running can be found with `Get-NetTCPConnection -LocalPort 8000,5173 -State Listen` and stopped in Task Manager. |
| "uv not found" or "node not found" (or "needs Node.js 24") | Install them as in "Install" above, open a new terminal, and run `npm run dev` again. |
| "running scripts is disabled" in PowerShell | Use `npm.cmd run dev`. |
| "Can't reach Accountable" in the browser | Check the terminal running `npm run dev`. Restart it if it stopped. |
| "Accountable is busy" | Wait a moment and try again. If it keeps happening, check nothing else has the database file open (a database viewer, a sync tool). |
| The database won't open | Stop the app, copy `backend/data/` somewhere safe, and look in `backend/logs/accountable.log` for the error. |
| The first run fails while installing | Check the internet connection and run `npm run dev` again. It only installs what's missing. |
| Starting again from the sample data | `npm run seed` |
| Starting with real data | `npm run clear` |
| Backing up | Stop the app and copy the `backend/data/` folder, which holds the database and its `-wal` file |
| Restoring | Stop the app and put the copied folder back as `backend/data/` |

### For developers

- `npm test` runs every test (pytest, Vitest, Playwright in the installed Chrome) on a temporary database and the test ports 8001 and 5174. It never touches `backend/data/accountable.db`. `npm test -- backend`, `-- frontend` or `-- e2e` runs one suite.
- `npm run lint` checks lint, formatting and types. `npm run format` fixes formatting.
- `npm run audit` checks the npm and Python dependencies for known vulnerabilities.
- `npm run test:perf` times the app at 2× the expected data volume (V-P01).
- `node scripts/run-tests.mjs visual` saves 1440px screenshots of the dashboard and pipeline to `docs/evidence/2026-11-22-visual/`, for comparing with mockup 1 (V-M04).

## Done

- 2026-11-20: Clarified the MVP scope in `docs/intent.md`: delete behaviour, required fields, stage probabilities, Won/Lost handling, pipeline columns, dashboard chart range and organization timelines.
- 2026-11-20: Wrote `docs/spec.md` with the MVP requirements (R1–R84), the brand-based design and the technical design. The project owner accepted all ten decisions in its "Concerns and decisions" section. Added `npm run clear` to `docs/TECH_STACK.md`.

- 2026-11-20: Made three HTML mockups of the dashboard and pipeline in `docs/mockups/` (A: spec layout, B: hero and top navigation, C: focus rail), each with Playwright screenshots. `docs/mockups/README.md` compares them and lists the points they raise for the spec.

- 2026-11-20: The project owner chose mockup B (hero and top navigation). `docs/spec.md` was updated to match: the top bar layout, the hero dashboard, the donut of open value by stage, the pipeline cards and the capped Won and Lost columns. Mockup B was trimmed to MVP scope (no user name, avatar or global search) and re-screenshotted.

- 2026-11-21: Wrote `docs/plan.md`: the files that will change, ten phases of work (0 to 9), the risks and how we handle them, and the unit and end-to-end tests that prove each requirement. No code yet.

- 2026-11-21: Restructured `docs/intent.md` into 14 sections, from business context to approval, after interviewing the product owner. Assumptions and proposed targets are marked as such. The product owner approved it the same day.
- 2026-11-21: Rewrote `docs/spec.md` as version 2.0, in 18 sections across five areas, keeping the R1–R84 IDs. It adds architecture, the API and data contracts, security, failure handling, observability, deployment, engineering standards, an ADR log and a Definition of Done. The product owner approved it, including C-2: the pipeline's Won and Lost columns show only deals closed this calendar month. Mockup B's screenshot still labels those columns "12 months".
- 2026-11-21: Refreshed `docs/plan.md` against spec 2.0. It now uses the spec's IDs (AC/SC, V and ADR). It adds the files for migrations, errors, security, logging, the error boundary and performance, and the tests for them. The phases are updated (guard rails in phase 0, hardening and release in phases 8 and 9), and the risks now include IPv6 `localhost`, the Host and Origin checks, Alembic with SQLite, `closed_at`, and backing up WAL files.
- 2026-11-21: The earlier mockups (A, B and C) were removed. Made two new mockups of the dashboard and pipeline that follow spec 2.0 and the brand: `docs/mockups/1-spec-reference/` and `docs/mockups/2-lanes-and-tiles/`, each with Playwright screenshots and no console errors. `docs/mockups/README.md` compares them and lists the points they raise for the spec: the badge contrast rule, and the visual reference path in spec 3.9 and the plan.

- 2026-11-21: The product owner chose mockup 1 (`docs/mockups/1-spec-reference/`) as the visual reference. `docs/spec.md` (references, 3.9, NFR-9, V-M04, ADR-012) and `docs/plan.md` now point to it. 
- 2026-11-21: Settled the badge contrast contradiction (ADR-017). Badges stay at 12px, and those with white text use the darker `--raspberry-text` or `--cerulean-text` fill. The spec's section 3.9 and both mockups were updated, and the screenshots re-taken.
- 2026-11-21: Rewrote `docs/plan.md` as version 3.0, a draft awaiting engineer approval:
  - a repository baseline and file-level inventory
  - 30 tasks in six phases, each with objective, files, steps, constraints, verification, evidence, exit and escalation
  - optional parallel streams
  - a 24-item risk register
  - proof with commands and requirement-to-test traceability

  Five decisions (E-1 to E-5) need the engineer's answer before work starts. No application code has been written.
- 2026-11-21: The engineer approved `docs/plan.md`, with E-1 to E-4 as recommended and E-5 changed: the build log is a separate file, `docs/build_logs.log`, tracked through one exception line in `.gitignore`. Phase 0 is done (checkpoint C0). Node 24.16, uv 0.11 and Chrome 157 are present and the ports are free. Python 3.12 isn't installed, and uv downloads it on the first `uv sync`. Evidence is in `docs/build_logs.log`.

- 2026-11-21: Phase 1 is done (checkpoint C1, on Windows). `npm run dev` installs what's missing and starts the empty app at `http://127.0.0.1:5173`. `npm test` (pytest, Vitest, Playwright on a temporary database) and `npm run lint` pass. The backend has config with an injectable clock, logging, the error format, the Host, Origin, size and JSON checks, the schema by Alembic migration `0001_initial`, the business rules and the API contract. The frontend has the top bar, tokens, bundled fonts, an error boundary and the API client. The engineer approved six extra frontend dev packages, the dashboard item shapes, and `closed_at` for deals created closed (plan 1.4 and `docs/build_logs.log`). On this machine, PowerShell blocks `npm.ps1`, so type `npm.cmd run dev` there.
- 2026-11-21: Verification run after checkpoint C1. Everything passed: `npm test` (238 backend, 12 frontend, 1 e2e), `npm run lint`, backend coverage 93% (`rules.py` 100%), an ad hoc frontend build, `npm audit` and `pip-audit`. A failing test in any suite makes `npm test` exit 1. Windows Application Control blocks `pip-audit.exe`, so use `uv run python -m pip_audit`. `AGENTS.md` now documents `npm test`. Outputs are in `docs/evidence/2026-11-21-verification/`.

- 2026-11-21: Phase 2 is done (checkpoint C2, on Windows). The backend now has the full API in spec 5: organizations, contacts, deals and activities, timelines, delete-impact, `/move` (one code path with `PATCH` for stage effects) and the dashboard. A new database starts with sample data built from mockup 1's names, and `npm run seed` and `npm run clear` reset or empty it (they ask first, or take `-- --yes`, and work while the app runs). `npm test` (370 backend, 12 frontend, 1 e2e) and `npm run lint` pass. Evidence is in `docs/build_logs.log`.

- 2026-11-21: Phase 3 is done (checkpoint C3, on Windows). The frontend now has the Organizations, Contacts and Deals tables (search, sort, 25 per page, side-panel forms with inline adds, deletes with counts), record pages with timelines and "Log activity", the pipeline board (drag by mouse or keyboard, optimistic moves with rollback, reload on 409, Won and Lost for this month) and the dashboard as in mockup 1. `npm test` (370 backend, 106 frontend, 31 e2e) and `npm run lint` pass. Impact notes (no behaviour change): styles and two tokens added to `global.css`/`tokens.css`, Vite pre-bundles its packages so a fresh clone has no console error, and `e2e/fixtures.ts` lets a test accept the one error line it causes on purpose. Open: the e2e browser clock is fixed while the test backend uses the real clock (see `docs/build_logs.log`).

- 2026-11-21: Phase 4 is done (checkpoint C4, on Windows): security (V-S01–V-S10, `npm run audit` clean), performance at 2× the intent's volume (`npm run test:perf`, every p95 under NFR-1–NFR-3), reliability (reload, killed-backend restart, seed/clear, timeout, 503, offline banner, V-M03 crash test by hand with no loss), keyboard-only use and no sideways scroll at 1024/1280px, and 99% coverage of `rules.py` and `services/`. Two fixes: a keyboard-moved pipeline card keeps its focus, and wide tables no longer make the page scroll sideways at 1024px. The engineer chose a test-only fixed backend clock (`ACCOUNTABLE_FIXED_NOW`, set only by `npm test`) so e2e results don't depend on the day. `npm test` (388 backend, 106 frontend, 47 e2e) and `npm run lint` pass. Impact notes (no app behaviour change): `scripts/run-tests.mjs` and `playwright.config.ts` gain the perf mode and the fixed clock; `e2e/fixtures.ts` checks the clocks match; `activities.spec.ts` and `pipeline.spec.ts` (Phase 3) were steadied; new `backend/tests/test_perfdata.py` and `test_config.py`. Evidence is in `docs/build_logs.log`.

- 2026-11-22: Phase 5's agent work is done (T5.1–T5.5, on Windows); checkpoint C5 is not reached yet. A fresh clone's first `npm run dev` installed everything and started in 15 s; the second run, with outbound traffic blocked, needed no install and started in 4 s; the app can't be reached on the LAN addresses (V-M02, Windows). Screenshots at 1440px compared with mockup 1 (V-M04, `docs/evidence/2026-11-22-visual/`): "Add deal" now has its "+" and card "organization · contact" wraps to two lines. This file now has the install, run, seed, clear, backup, restore, logs and runbook sections. The V-M01 walkthrough found one defect, now fixed with a test: deleting from a record's own page showed "no longer exists" with 404 console errors instead of going back to the list. `npm test` (388 backend, 106 frontend, 48 e2e), `npm run lint`, `npm run audit` and `npm run test:perf` pass, and coverage is 99%. Impact note (tooling only, no app behaviour): `playwright.config.ts` and `scripts/run-tests.mjs` gain a `visual` mode (`node scripts/run-tests.mjs visual`) so `e2e/visual/compare.spec.ts` can run. Evidence and the full difference and finding lists are in `docs/build_logs.log` (T5.1–T5.5).

- 2026-11-22: The engineer used and approved the app (AC9, SC5). Phases 2 to 5 were committed together as "Build: phases 2-5" (b8442d5, since their changes overlap in the same files), and tagged `v0.1.0` (annotated, local, not pushed).
- 2026-11-22: Rewrote the review policy as `docs/REVIEW.md` (it was the untracked `docs/Review.md`) in the 14-section structure, keeping only what applies to Accountable. It has eight review passes, P0–P3 severity, a report format and merge criteria. The engineer approved it the same day, and asked for an independent review of `build-mvp` against `main`. Also re-ran the checks on 22 Nov: `npm test` (388 backend, 106 frontend, 48 e2e), `npm run lint` and `npm run audit` all pass.

- 2026-11-22: Reorganized the docs for future changes (no code changed). `docs/intent.md` and `docs/plan.md` moved, unchanged, to `docs/changes/mvp/`. `docs/spec.md` now describes the whole product as it stands: it takes in the problem, users and scope from the intent, holds AC1–AC9 and SC1–SC5 (section 1.4), records the plan's engineering decisions E-1 to E-5 and D-2, D-3 (section 16.3), lists known gaps (section 17.1), and no longer defers to the intent; its MVP Definition of Done stays in the plan. `AGENTS.md` now says to read the spec first and only the current change's folder, `docs/changes/<branch name>/`. `docs/REVIEW.md` now asks reviewers to flag code the spec doesn't describe, and points at the change folder.

## Release notes: v0.1.0 (22 Nov 2026)

The first release of Accountable: a local sales CRM for one salesperson.

- Organizations, contacts and deals, with search, sort, paging, side-panel forms, inline adds, and deletes that show what they'll affect.
- Record pages with linked records and timelines of activities and stage changes. Activities can have follow-ups, which can be marked done.
- A pipeline board: drag by mouse or keyboard, probabilities and totals update at once, and Won and Lost columns show this month's deals.
- A dashboard: the figures, revenue won by month, the sales funnel, deals won and lost, open value by stage, follow-ups and recent activity.
- Sample data on first run, `npm run seed` and `npm run clear`, local only (127.0.0.1), and works offline once installed.
- Known open items: V-M02 not yet run on macOS and Linux, or on Windows with Wi-Fi off; V-M05 (someone new) not yet run; the differences listed in `docs/build_logs.log` (T5.2, T5.4) accepted as they are.

## Next

- Run V-M02 on macOS and Linux, and on Windows with Wi-Fi off (commands in `docs/build_logs.log`, T5.1), and record the results here.
- Have someone new try the SC1 questions (V-M05, questions in T5.4).
- Two weeks of real use to check SC2 to SC4 (V-M06).
- Possible later changes from Phase 5: two source names on dashboard rows (needs a contract change), Cerulean follow-up links, a richer won/lost history in the sample data, the Deals table's default sort, and distinct names for the pipeline's "Add deal" buttons.
