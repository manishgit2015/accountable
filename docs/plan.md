# Plan: building the Accountable MVP

**STATUS: APPROVED — 21 Nov 2026**

| | |
|---|---|
| Version | 3.0 (21 Nov 2026). Replaces plan 2.x. |
| Builds | `docs/intent.md` (approved 21 Nov 2026) as designed in `docs/spec.md` 2.0 (approved 21 Nov 2026) |
| Visual reference | `docs/mockups/1-spec-reference/` |
| Approver | The engineer (the project owner). Approved 21 Nov 2026, with E-1 to E-4 as recommended and E-5 changed (see below). |

## How to read this plan

- **IDs.** Requirement IDs (R, NFR, SEC, REL, OBS, DEP, ENG), verification IDs (V) and decision IDs (ADR) come from the spec. AC1–AC9 and SC1–SC5 are the intent's criteria. Task IDs (T1.2 and so on), escalations (E-1 and so on) and risks (RK-1 and so on) are defined here, and stay stable once the plan is approved.
- **Path markers.** Every path below is *proposed*: no application code exists yet (see "Repository baseline"). A path marked **(exists)** was checked in the repository on 21 Nov 2026.
- **Freedom to implement.** The plan fixes the module boundaries, contracts, order and proof. It leaves function names, internal structure and algorithms to the implementer, within those boundaries.
- **Commit points.** Each phase ends at a commit point. The course's convention is that the engineer commits (`course/for_agents/AGENT_GIT_GUIDE.md`), and an agent commits only when asked.

## Repository baseline (inspected 21 Nov 2026)

| Area | Finding |
|---|---|
| Application code | None. There's no `backend/`, `frontend/`, `e2e/`, `scripts/`, `package.json` or `pyproject.toml`. |
| Tests, CI and CD | None. There's no `.github/` workflow. The course adds a harness and CI on Week 1 Day 4, which is outside this plan. |
| Agent instructions | `AGENTS.md` **(exists)**: points to the docs, and says to update `docs/STATUS.md` after each piece of work. There's no `CLAUDE.md` or Cursor rules. |
| Course guides | `course/for_agents/*.md` **(exists)**. The Day 3 build is done from this plan in a fresh session, and the engineer commits per phase. Ed's `week1day3-end` branch has optional parallel test scripts. |
| Project settings | `.claude/settings.json` **(exists)**: `npm test` allowed, `.env` reads denied, `git push` needs asking. `.mcp.json` **(exists)**: the Playwright MCP server. |
| Brand | `.claude/skills/brand/` **(exists)**. Its tokens are already expressed in `docs/mockups/shared/tokens.css` **(exists)**. |
| `.gitignore` | **(exists)** Already ignores `node_modules/`, `.venv/`, `*.db`, `*.db-wal`, `*.db-shm`, `logs/`, `test-results/` and `playwright-report/`. It also ignores `*.log`, so one exception line is added for the build log (E-5). |
| Branch | `build-mvp` (the course calls it `mvp`). Its base is `main`. |

### What gets reused

- **Brand tokens and values** from `docs/mockups/shared/tokens.css`, copied into the frontend's tokens file. The mockup file itself isn't imported, so the mockups stay independent.
- **Sample names and scenarios** from `docs/mockups/shared/data.js`, as a starting point for `seed.py`, so the app matches the mockup at first run. Dates are recomputed relative to today (R83).
- **Mockup 1's layout and component styles**, as the visual target. They're rebuilt in React, not copied.
- **The installed Google Chrome**, for the end-to-end tests (`TECH_STACK.md`).

### Files that must not be modified

| Path | Why |
|---|---|
| `README.md` | It's the course's own guide (`TECH_STACK.md`) |
| `course/**`, `community_contributions/**`, `assets/**` | Course material |
| `.claude/skills/brand/**`, `.claude/settings.json`, `.mcp.json` | Project configuration owned by the engineer |
| `docs/intent.md`, `docs/spec.md` | Approved. They change only with the engineer's approval (escalate first). |
| `docs/mockups/**` | Approved visual reference |

### Decisions made before work started

These were gaps or contradictions in the approved documents. The engineer decided all five on 21 Nov 2026. None of them changes the scope.

| ID | Issue | Options | Decision |
|---|---|---|---|
| E-1 | `TECH_STACK.md` says "no raw SQL", but SQLite's connection settings (spec 6.3) can only be set with `PRAGMA` statements | (a) Allow `PRAGMA` text, in `db.py`'s connection hook only. (b) Find a driver option for each setting: no such option exists for `foreign_keys` or `synchronous`. | (a), with a test that it's the only text SQL (V-B02). Approved. |
| E-2 | Spec 7.4 says Uvicorn runs without reload for users and with reload for development, but there's only one command, `npm run dev` | (a) No reload by default, with `ACCOUNTABLE_RELOAD=1` turning it on. This adds one variable to DEP-2. (b) Always reload: simpler, but a file change restarts the user's server. (c) Never reload: developers restart it by hand. | (a), approved |
| E-3 | NFR-1 says "within 500 ms of navigation", but under the development servers (ADR-010) the first, cold load of the page compiles modules on demand and may be slower | (a) Measure navigation inside the app after the first load (route change to data shown), and record the cold first load separately without a threshold. (b) Apply 500 ms to the cold load too, which may force a production build and so change ADR-010. | (a), approved |
| E-4 | V-S10 ("can't be reached on the computer's network address") needs the machine's LAN address, which isn't stable in automated runs | (a) Automate it as "the servers are bound to 127.0.0.1": a test inspects the listening sockets. Check the LAN address by hand in V-M02. (b) Try to discover the LAN address in the test, which is flaky without a network. | (a), approved |
| E-5 | Where to record each task's evidence (section 4.7 below) | (a) A "Build log" section in `docs/STATUS.md`. (b) A separate file. | A separate file, `docs/build_logs.log`, kept in git through an exception in `.gitignore` (engineer's choice). `docs/STATUS.md` still gets a short line per finished piece of work, as `AGENTS.md` asks. |

---

## 1. Files that change

Files are grouped by module, and every one is created (C) unless marked modified (M). For each group:

- the **Boundaries, extensibility and risks** note applies to every file in it
- **Verification** names the V cases that prove the group
- **Tasks** are the tasks in section 2 that may change these files

A file that isn't listed may only be changed with an approved plan update (section 2, "Change control").

### 1.1 Repo root, launcher and tooling

| Path | Action | Planned changes | Requirements | Depends on | Tasks |
|---|---|---|---|---|---|
| `package.json` | C | npm workspace (`frontend`). Scripts: `predev`, `dev`, `test`, `test:perf`, `lint`, `format`, `seed`, `clear`, `audit`. `engines.node >=24`, version 0.1.0. Dev dependencies: `concurrently`, `@playwright/test`. | R1, R4, DEP-3, DEP-5, ENG-7 | `scripts/*.mjs`, `pyproject.toml` | T1.1, T1.8 |
| `package-lock.json` | C | Generated by `npm install`. Never edited by hand. | DEP-3 | `package.json` | T1.1 and after |
| `pyproject.toml` | C | Python 3.12 project for `backend/`. Runtime: fastapi, uvicorn, sqlalchemy, alembic, pydantic. Dev: pytest, pytest-cov, httpx, ruff, pip-audit. Ruff and pytest settings. Version 0.1.0. | ENG-3, ENG-4, ADR-004 | (none) | T1.1, T1.8 |
| `uv.lock` | C | Generated by `uv sync` | DEP-3 | `pyproject.toml` | T1.1 and after |
| `.python-version` | C | `3.12` | ENG-3 | (none) | T1.1 |
| `scripts/ensure-installed.mjs` | C | Node built-ins only. Checks Node ≥24 and uv, with the documented fix in each message. Runs `npm install` and `uv sync` only when they haven't been run. Makes no network call when everything is present. | R1, R2, DEP-3 | (none) | T1.1 |
| `scripts/run-tests.mjs` | C | The single verification entry point. Sets a temporary `ACCOUNTABLE_DB` and test ports, refuses the default database path, runs pytest, then Vitest, then Playwright, and stops at the first failure with a nonzero exit. | ENG-7, spec 13.2 | `playwright.config.ts` | T1.8 |
| `playwright.config.ts` | C | `channel: "chrome"`. `webServer` starts the backend on `127.0.0.1:8001` and Vite on `127.0.0.1:5174` with the test database. One worker by default (RK-17). | DEP-1, spec 13.2 | `e2e/fixtures.ts` | T1.8 |

- **Boundaries:** scripts orchestrate only. No business logic, and no shell-specific syntax (Windows).
- **Extensibility:** `npm start`, a build-and-serve path for hosting, can be added later as a new script without changing `dev` (ADR-010).
- **Risks:** RK-1, RK-2, RK-19.
- **Verification:** V-M02, plus every suite through `npm test`.

### 1.2 Backend (`backend/`)

| Path | Action | Planned changes | Requirements | Depends on | Tasks |
|---|---|---|---|---|---|
| `backend/app/__init__.py` | C | Package marker | (none) | (none) | T1.2 |
| `backend/app/main.py` | C | App factory. Middleware order: request ID and logging, security, errors. Mounts the routers. Start-up: migrate, then seed if new, then log the start-up lines. Start-up failures exit with one clear line (REL-9). | OBS-4, REL-9, DEP-4 | everything below | T1.2, T1.4, T2.6 |
| `backend/app/config.py` | C | Reads `ACCOUNTABLE_DB`, `ACCOUNTABLE_API_PORT`, `ACCOUNTABLE_WEB_PORT`, `ACCOUNTABLE_LOG_LEVEL` (and `ACCOUNTABLE_RELOAD` if E-2 is approved). One injectable clock, which every "now" and "today" goes through. | DEP-2, R16, R77 | (none) | T1.2 |
| `backend/app/logging.py` | C | Request ID (`X-Request-ID`), one line per request with the path template, a rotating file `backend/logs/accountable.log` (5 MB × 3), and no bodies or values | OBS-1–OBS-3, SEC-8, ADR-005 | `config.py` | T1.2 |
| `backend/app/errors.py` | C | The error format and codes in spec 5.2. A locked database becomes 503, and anything unexpected a generic 500 with the stack trace only in the log. | spec 5.2, REL-6 | `logging.py` | T1.2 |
| `backend/app/security.py` | C | Host allowlist (SEC-2), Origin check on POST, PATCH and DELETE (SEC-3), 1 MB body limit, JSON-only bodies (415), and no CORS headers | SEC-2, SEC-3, SEC-7 | `config.py`, `errors.py` | T1.3 |
| `backend/app/db.py` | C | Engine factory. A connection hook sets the four settings in spec 6.3 (E-1). The five tables in SQLAlchemy Core with every constraint and index in spec 6.1–6.2. A transaction helper. | spec 6.1–6.3, REL-1, REL-2, ENG-4 | `config.py` | T1.4 |
| `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako` | C | Alembic set up for SQLite batch mode, with its target metadata from `db.py` | ADR-004, DEP-4 | `db.py` | T1.4 |
| `backend/migrations/versions/0001_initial.py` | C | Creates the five tables, constraints and indexes | spec 6.1–6.2 | `db.py` | T1.4 |
| `backend/app/rules.py` | C | Pure functions: usual probability, stage-change effects (probability, close date, `closed_at`, customer), late, expected revenue, positions and renumbering. No input or output. | R14–R20, R24, spec 4.2, 6.4 | (none) | T1.5 |
| `backend/app/schemas.py` | C | Pydantic request and response models for every shape in spec 5.3–5.5, with `extra="forbid"` and the R21 field rules. Field names follow the spec. | R10–R13, R21, spec 5 | `rules.py` (stage enum) | T1.6 |
| `backend/app/services/__init__.py` | C | Package marker | (none) | (none) | T2.1 |
| `backend/app/services/records.py` | C | Create, read, update and delete for organizations, contacts, deals and activities. Required links on create (R11, R12). R23 contact match. R34 cleared links. A deal's first stage change and its top-of-column position. List counts (R44). | R10–R13, R21–R23, R34, R44 | `db.py`, `rules.py`, `schemas.py` | T2.1, T2.2 |
| `backend/app/services/moves.py` | C | Stage change through `PATCH` and `/move` in one transaction. R15–R18 through `rules.py`. `closed_at`. Midpoint or renumbering. 409 `stale_position`. | R15–R18, R24, R63, R67, spec 5.4 | `records.py`, `rules.py` | T2.3 |
| `backend/app/services/deletes.py` | C | Delete-impact counts, and deletes relying on the foreign key rules (R31–R33) | R30–R36 | `db.py` | T2.4 |
| `backend/app/services/timeline.py` | C | Merged timelines, newest first, with `source` | R50–R54 | `db.py` | T2.5 |
| `backend/app/services/dashboard.py` | C | Every field of spec 5.5. Months and the closed windows by `closed_at` (ADR-015). The funnel over deals created in the last 12 months from stage history (R74). Follow-up groups (R76). | R70–R79 | `db.py`, `rules.py` | T2.8 |
| `backend/app/routers/__init__.py` | C | Package marker | (none) | (none) | T1.2 |
| `backend/app/routers/health.py` | C | `GET /api/health` | OBS-5 | `db.py` | T1.2 |
| `backend/app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py` | C | HTTP only: parse, call a service, shape the response. Includes `/timeline`, `/delete-impact` and `/move`. | spec 5.3–5.4, ENG-1 | services | T2.1–T2.5 |
| `backend/app/routers/dashboard.py` | C | `GET /api/dashboard` | spec 5.5 | `services/dashboard.py` | T2.8 |
| `backend/app/seed.py` | C | Sample data built through the services or `db.py`, relative to the clock, with history and `closed_at` that fit each deal | R80–R84, R4 | services, `rules.py` | T2.6 |
| `backend/app/cli.py` | C | `seed` and `clear`: the question, `--yes`, exit codes 0, 1 and 2, and one transaction each | R4, spec 5.6, REL-10 | `seed.py`, `db.py` | T2.7 |
| `backend/app/perfdata.py` | C | Generates 2 × the intent's data volume into a given database | NFR-1–NFR-3, NFR-13 | `seed.py` helpers | T4.2 |

- **Boundaries (ENG-1):**
  - Routers never touch `db.py` directly, and services never import FastAPI.
  - `rules.py` imports nothing from the app.
  - Only `db.py` and migrations know about SQLite. Everything else goes through SQLAlchemy Core expressions, so a later Postgres move (`TECH_STACK.md`: Supabase) changes `db.py`, the migrations and the connection settings, not the services.
- **Extensibility:**
  - Services take their connection or transaction and the clock as arguments, not from globals. A future user or tenant context (sign-in, the later intent) can then be passed the same way without restructuring.
  - The stage list lives in one place, `rules.py`, and is mirrored once in `frontend/src/lib/deals.ts`. Editable stages are out of scope and aren't designed for.
  - The API is unversioned (ADR-009). A breaking change later would add a new router prefix, not alter these.
- **Risks:** RK-3 to RK-11, RK-13, RK-14.
- **Verification:** V-B01 to V-B14, V-S01 to V-S07.

### 1.3 Backend tests (`backend/tests/`)

| Path | Action | Planned changes | Requirements | Tasks |
|---|---|---|---|---|
| `backend/tests/conftest.py` | C | A temporary database per test (migrated), a fixed clock, and a TestClient. Fails if `ACCOUNTABLE_DB` is the default path. | spec 13.2 | T1.8 |
| `backend/tests/test_smoke.py` | C | Health answers. Replaced by the real suites as they arrive. | OBS-5 | T1.8 |
| `test_rules.py`, `test_db.py`, `test_organizations.py`, `test_contacts.py`, `test_deals.py`, `test_move.py`, `test_deletes.py`, `test_activities.py`, `test_timelines.py`, `test_dashboard.py`, `test_seed.py`, `test_cli.py`, `test_migrations.py`, `test_errors.py`, `test_security.py`, `test_logging.py` | C | Section 4. One file per V case. `test_logging.py` covers OBS-1–OBS-3 and SEC-8. | Section 4.6 | T1.3–T2.8, T4.1 |

### 1.4 Frontend (`frontend/`)

| Path | Action | Planned changes | Requirements | Depends on | Tasks |
|---|---|---|---|---|---|
| `frontend/package.json` | C | Runtime: react, react-dom, react-router, @tanstack/react-query, @tanstack/react-table, react-hook-form, zod, recharts, @dnd-kit/core, @dnd-kit/sortable, Radix UI primitives, lucide-react, date-fns, and @fontsource for the three fonts. Dev: vite, typescript, vitest, @testing-library/react, jsdom, eslint, prettier. | spec 7.1, ENG-5 | (none) | T1.7, T1.8 |
| `frontend/vite.config.ts` | C | `host: 127.0.0.1`. Port from `ACCOUNTABLE_WEB_PORT`. Proxies `/api` to `http://127.0.0.1:<api port>`. Default allowed hosts. | SEC-1, SEC-2, DEP-2 | (none) | T1.7 |
| `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/index.html` | C | Strict TypeScript, and the HTML entry | ENG-2 | (none) | T1.7 |
| `frontend/eslint.config.js`, `frontend/.prettierrc` | C | Lint and format, including a rule against `fetch` outside `src/api/` | ENG-1, ENG-2 | (none) | T1.8 |
| `frontend/vitest.config.ts`, `frontend/src/test/setup.ts` | C | jsdom, Testing Library, a ResizeObserver stub and fake timers | spec 13.2 | (none) | T1.8 |
| `frontend/src/main.tsx`, `frontend/src/App.tsx` | C | Router for the five sections and the record pages. Query client: reads retried once, changes never retried. Font imports. An error boundary per route. | R2, REL-5, REL-12 | components | T1.7, T3.x |
| `frontend/src/styles/tokens.css`, `global.css` | C | The spec 3.9 tokens (values from `docs/mockups/shared/tokens.css`), type scale, panels and shadows. Badge fills per ADR-017. | spec 3.9, NFR-9 | (none) | T1.7 |
| `frontend/src/api/client.ts` | C | The only place `fetch` is called. 10 s timeout. Reads the error format, request ID and 404, 409 and 503. Translates `snake_case` to `camelCase`. | REL-4, REL-6, OBS-3, ENG-6 | (none) | T1.7, T3.2 |
| `frontend/src/api/types.ts` | C | TypeScript types for every API shape in spec 5, written once by hand from `schemas.py`'s contract | spec 5 | `schemas.py` | T3.2 |
| `frontend/src/api/queries.ts` | C | Query and mutation hooks, which queries each change refetches (spec 7.2), and the optimistic move with rollback | spec 7.2, R64 | `client.ts` | T3.2, T3.7 |
| `frontend/src/lib/format.ts`, `frontend/src/lib/deals.ts` | C | Money and dates. Stage list and colors, late, expected revenue, greeting (R79), initials. | spec 3.9 Writing, R19, R20, R79 | (none) | T3.1 |
| `frontend/src/components/*.tsx` | C | `TopBar`, `Panel`, `Button`, `Badge`, `DataTable`, `SidePanel`, `ConfirmDialog`, `EmptyState`, `Timeline`, `ActivityForm`, `Picker`, `ErrorBoundary`, `OfflineBanner`, `NotFound` | R40–R48, R30, R53–R56, REL-7, REL-12 | tokens, lib | T1.7, T3.1, T3.6 |
| `frontend/src/forms/*.tsx` | C | `OrganizationForm`, `ContactForm`, `DealForm`. Zod schemas match R21. Server messages appear next to fields. Save disabled while saving. | R21, R45, R48, R15, R23, REL-5 | components, queries | T3.3–T3.5 |
| `frontend/src/pages/organizations/*`, `contacts/*`, `deals/*` | C | List and detail pages | R40–R56 | components, forms | T3.3–T3.6 |
| `frontend/src/pages/pipeline/*` | C | `PipelinePage`, `StageStrip`, `Board`, `Column`, `DealCard`, `ClosedRow`. dnd-kit with the keyboard sensor. | R60–R67 | queries, lib | T3.7 |
| `frontend/src/pages/dashboard/*` | C | `DashboardPage`, `HeroPanel`, `RevenueChart`, `FunnelPanel`, `WonLostChart`, `StageDonut`, `FollowUps`, `RecentActivity` | R70–R79 | queries, lib | T3.8 |
| `frontend/src/**/*.test.ts(x)` | C | Section 4. V-F01 to V-F10. | Section 4.6 | (none) | T3.x, T4.x |

- **Boundaries:**
  - Pages compose components and hooks.
  - Only `src/api/` talks to the network.
  - Colors come only from tokens.
  - The frontend never computes authoritative figures. The dashboard comes from the API, and the pipeline's optimistic totals are replaced by the server's answer.
- **Extensibility:**
  - Each section is its own route folder, so a new section (a later intent) adds a folder and a tab.
  - `DataTable`, `SidePanel` and `ConfirmDialog` are generic for the three tables and reused by future record types.
  - A dark mode (Week 1 Day 4 in the course) only needs the tokens file redefined, because components never hard-code colors.
- **Risks:** RK-7, RK-12, RK-15, RK-16, RK-18.
- **Verification:** V-F01 to V-F10, V-E01 to V-E12.

### 1.5 End to end (`e2e/`)

| Path | Action | Planned changes | Requirements | Tasks |
|---|---|---|---|---|
| `e2e/fixtures.ts` | C | Resets the test database before each test (`cli seed --yes` or `clear --yes` against the test path). Fails on any console error or any request leaving `127.0.0.1` or `localhost` (V-E00). Fixes the clock with `page.clock`. | R2, R7 | T1.8 |
| `e2e/smoke.spec.ts` | C | Opens the app and sees the top bar. Replaced by `start.spec.ts` later. | R1 | T1.8 |
| `start`, `organizations`, `contacts`, `deals`, `record-pages`, `activities`, `pipeline`, `won-deal`, `commands`, `persistence`, `keyboard`, `layout`, `security` (each `.spec.ts`) | C | Section 4 (V-E01 to V-E12, V-S08 to V-S10) | Section 4.6 | T3.3–T4.4 |
| `e2e/perf/perf.spec.ts` | C | Timing run with `perfdata`. Run by `npm run test:perf` only. | NFR-1–NFR-3 | T4.2 |
| `e2e/visual/compare.spec.ts` | C | Takes screenshots of the dashboard and pipeline at 1440px for the V-M04 comparison against mockup 1. Not a pass/fail pixel test. | V-M04 | T5.2 |

### 1.6 Docs

| Path | Action | Planned changes | Tasks |
|---|---|---|---|
| `docs/STATUS.md` **(exists)** | M | How to install, run, seed, clear, back up and restore. The runbook (spec 12). One short line per finished task or phase (`AGENTS.md`). | Every task, T5.3 |
| `docs/build_logs.log` | C | The build log: one entry per task with its evidence (section 4.7, E-5). Plain text, appended only, never rewritten. | Every task |
| `.gitignore` **(exists)** | M | One line, `!docs/build_logs.log`, so the build log is tracked despite the `*.log` rule. Nothing else changes. | T0.2 |
| `docs/plan.md` **(exists)** | M | Only through change control | (none) |

### 1.7 Changes to call out separately

| Kind | What changes | Where | Task |
|---|---|---|---|
| **Database schema** | New: five tables, constraints and indexes, by migration `0001_initial` only. No other schema change in the MVP. | `db.py`, `migrations/versions/0001_initial.py` | T1.4 |
| **Configuration** | New environment variables per DEP-2 (+ `ACCOUNTABLE_RELOAD` if E-2 is approved). No secrets, and no `.env` file. | `config.py`, `vite.config.ts` | T1.2, T1.7 |
| **API** | New: everything in spec 5 under `/api`. There's no existing API to stay compatible with. | `routers/*`, `schemas.py` | T1.6, T2.x |
| **Infrastructure** | None. Local only: no CI, deploy, containers or hosting. | (none) | (none) |
| **Dependencies** | New npm and PyPI packages listed in 1.1 and 1.4, pinned by lockfiles. Nothing else without a reason in the change (ENG-5). | `package.json`, `frontend/package.json`, `pyproject.toml` | T1.1, T1.7, T1.8 |

### 1.8 Files touched by more than one task

Only the task that owns a file may change it while parallel work is under way (section 2, "Parallel execution"):

- `package.json`, `frontend/package.json` and `pyproject.toml` are owned by T1.1, T1.7 and T1.8. Later additions go through the stream lead.
- `backend/app/main.py` is owned by T1.2. Routers are registered with one line each.
- `backend/app/schemas.py` is owned by T1.6. It's extended only by the backend stream.
- `frontend/src/App.tsx` (routes) and `frontend/src/api/queries.ts` belong to the frontend stream.
- `docs/STATUS.md` and `docs/build_logs.log` are appended by every task. Merge carefully at checkpoints.

---

## 2. Order of work

### Overview

| Phase | Goal | Tasks | Checkpoint |
|---|---|---|---|
| 0 | Validate the repository, environment and decisions | T0.1–T0.2 | C0: environment ready, E-1 to E-5 decided |
| 1 | Contracts and foundation: skeleton, guard rails, schema, rules, API contract, test harness | T1.1–T1.8 | C1: `npm run dev` and `npm test` work on an empty app |
| 2 | Core backend: services, API, seed, commands, dashboard | T2.1–T2.8 | C2: every backend V case passes |
| 3 | Frontend integration: shared pieces, tables, records, pipeline, dashboard | T3.1–T3.8 | C3: every frontend and journey V case passes |
| 4 | Engineering hardening: security, performance, reliability, accessibility, quality gates | T4.1–T4.5 | C4: every automated V case passes, thresholds met |
| 5 | Full verification and readiness | T5.1–T5.5 | C5: Definition of Done met, engineer approval, tag |

That's 30 tasks in all.

### Rules for every task

- Tests are written with or before the code they prove, and named by requirement ID (ENG-7).
- A task is done only when its verification has been run and passed, and its evidence is recorded (section 4.7).
- Never go past a failing mandatory gate: `npm test` and `npm run lint` from T1.8 on.
- No refactoring outside the task's files. No changes to "Files that must not be modified".
- Each phase ends at a commit point.

### Escalation (applies to every task)

Stop and ask the engineer when any of these happens:

- a file outside the task's list must change in a way that affects behavior or architecture
- a requirement seems wrong, missing or contradictory
- a security, privacy or reliability rule would have to be weakened
- a new dependency is needed that isn't listed
- a threshold can't be met

### Change control

A file change not in section 1 needs an impact note in `docs/STATUS.md`. If it changes scope, behavior, a contract or the architecture, it also needs the engineer's approval before it's made.

### Phase 0: Repository and prerequisite validation

**T0.1 Validate the environment and repository assumptions**
- **Objective:** Confirm the baseline above still holds and the tools exist.
- **Requirements:** R1, NFR-6, DEP-3.
- **Dependencies:** none.
- **Files:** none. Read-only, except `docs/build_logs.log`.
- **Steps:**
  1. Check `node --version` (≥24), `uv --version` and Google Chrome are installed.
  2. Check that ports 8000, 5173, 8001 and 5174 are free.
  3. Check that `backend/`, `frontend/` and `e2e/` still don't exist.
  4. Check the branch is `build-mvp`.
- **Constraints:** install nothing.
- **Extensibility:** none.
- **Verification:** the commands above.
- **Evidence:** versions and results in `docs/build_logs.log`.
- **Exit:** all present, or the engineer told what's missing.
- **Escalate if:** a tool is missing, or code already exists.

**T0.2 Confirm the open decisions**
- **Objective:** Record the engineer's answers to E-1 to E-5, and set up the build log.
- **Requirements:** ENG-10.
- **Dependencies:** T0.1.
- **Files:** `docs/build_logs.log`, `.gitignore` (the one exception line), `docs/STATUS.md`.
- **Steps:** create the build log with the exception in `.gitignore`, then record each answer. If any differs from the recommendation, update the affected tasks through change control.
- **Constraints:** no implementation yet.
- **Extensibility:** none.
- **Verification:** none.
- **Evidence:** the decisions, recorded.
- **Exit:** all five decided.
- **Escalate if:** any is unanswered.

**Checkpoint C0:** the environment is confirmed and the decisions are recorded.

### Phase 1: Contracts and foundation

**T1.1 Root workspace and launcher**
- **Objective:** `npm run dev` installs what's missing and starts both servers.
- **Requirements:** R1, R2, DEP-3, DEP-5.
- **Dependencies:** C0.
- **Files:** `package.json`, `pyproject.toml`, `.python-version`, `scripts/ensure-installed.mjs`, and the lockfiles.
- **Steps:**
  1. Create the workspace and `pyproject.toml` with the runtime dependencies.
  2. Write `ensure-installed.mjs` with Node built-ins.
  3. Make `dev` run Uvicorn on `127.0.0.1` and Vite together through `concurrently`, and print `http://127.0.0.1:5173`.
- **Constraints:** no shell-specific syntax. No network when installed (R2).
- **Extensibility:** script names leave room for `start` later.
- **Verification:**
  - From a clean clone, `npm run dev` installs and starts.
  - The second run makes no install.
  - Ctrl+C stops both servers on Windows.
- **Evidence:** terminal output of both runs.
- **Exit:** both servers start in under 15 s on the second run (NFR-5).
- **Escalate if:** `concurrently` misbehaves on Windows.

**T1.2 Backend skeleton, configuration, logging, errors and health**
- **Objective:** A FastAPI app with the cross-cutting pieces every endpoint relies on.
- **Requirements:** DEP-2, OBS-1–OBS-5, SEC-8, spec 5.2, REL-6, REL-9.
- **Dependencies:** T1.1.
- **Files:** `backend/app/__init__.py`, `main.py`, `config.py`, `logging.py`, `errors.py`, `routers/__init__.py`, `routers/health.py`.
- **Steps:**
  1. Build the app factory and configuration with the injectable clock.
  2. Add the request ID and access log with path templates, and the rotating file.
  3. Add the error handlers producing spec 5.2's format.
  4. Add `GET /api/health`.
  5. Make a port in use fail with one clear line.
- **Constraints:** never log bodies or values. No stack traces in responses.
- **Extensibility:** the clock and configuration are injected, so tests and later hosted settings reuse them.
- **Verification:** V-B14 (partial), `test_logging.py`.
- **Evidence:** pytest output, and a sample log line.
- **Exit:** health answers, and an error returns the spec format with a request ID.
- **Escalate if:** none expected.

**T1.3 Security middleware**
- **Objective:** Enforce the local-only trust boundary.
- **Requirements:** SEC-1–SEC-3, SEC-7, ADR-002.
- **Dependencies:** T1.2.
- **Files:** `backend/app/security.py`, `main.py` (registration), `backend/tests/test_security.py`.
- **Steps:**
  1. Add the Host allowlist (127.0.0.1 or localhost on the API and web ports, plus the test ports).
  2. Add the Origin check on changing methods.
  3. Add the body size limit and the JSON-only rule.
  4. Make sure no CORS headers are sent.
- **Constraints:** requests through the Vite proxy must pass. Test both a good request through the proxy and a refused foreign one (RK-4).
- **Extensibility:** the allowlist comes from configuration, so a hosted deployment changes configuration, not code.
- **Verification:** V-S01–V-S03, V-S06.
- **Evidence:** pytest output.
- **Exit:** the negative cases are refused, and proxied requests are accepted.
- **Escalate if:** the proxy can't preserve an acceptable Host or Origin.

**T1.4 Database layer and initial migration**
- **Objective:** The schema exists, created only by Alembic, with crash-safe settings.
- **Requirements:** spec 6.1–6.3, REL-1, REL-2, ADR-004, DEP-4, E-1.
- **Dependencies:** T1.2.
- **Files:** `backend/app/db.py`, `backend/alembic.ini`, `backend/migrations/*`, `main.py` (start-up migrate), `backend/tests/test_db.py`, `test_migrations.py`.
- **Steps:**
  1. Define the tables in Core.
  2. Add the connection hook with the four settings.
  3. Write migration `0001` in batch mode.
  4. Run `upgrade head` on start-up before serving requests. A failed migration exits and leaves the file unchanged.
- **Constraints:**
  - Text SQL only in the connection hook (E-1).
  - Never delete or recreate an existing database file.
  - Every constraint in spec 6.1 is enforced by the database, not only by the API.
- **Extensibility:** schema changes only through new migrations. SQLite-specific code stays in `db.py` and the migrations.
- **Verification:** V-B02, V-B13 (empty to head).
- **Evidence:** pytest output, and `alembic current` on a new file.
- **Exit:** a new database has every table, index and check. The settings read back as expected.
- **Escalate if:** a constraint can't be expressed in SQLite.

**T1.5 Business rules**
- **Objective:** Every stage, probability, date and position rule as pure functions.
- **Requirements:** R14–R20, R24, spec 4.2, 6.4.
- **Dependencies:** T1.2.
- **Files:** `backend/app/rules.py`, `backend/tests/test_rules.py`.
- **Steps:**
  1. Write the tests first from spec 4.2's table.
  2. Implement the rules: usual probability, the effects of each kind of move, late, expected revenue, midpoint, and the renumber condition (1e-6).
- **Constraints:** no input or output, no clock reads (today is passed in), no imports from other app modules.
- **Extensibility:** one stage list. Rules are testable on their own and reusable by later features, such as the reports in a later intent.
- **Verification:** V-B01.
- **Evidence:** pytest output with coverage of `rules.py`.
- **Exit:** every row of spec 4.2 is covered.
- **Escalate if:** a row of spec 4.2 is ambiguous.

**T1.6 API contract (schemas)**
- **Objective:** Fix every request and response shape before services and frontend depend on them.
- **Requirements:** R10–R13, R21, spec 5.1–5.5.
- **Dependencies:** T1.5.
- **Files:** `backend/app/schemas.py`.
- **Steps:**
  1. Write models for each shape in spec 5, with `extra="forbid"`.
  2. Add the R21 validators: trimming, lengths, email and phone shape, website schemes with a bare-domain prefix, bounds and dates.
- **Constraints:** names and nullability exactly as spec 5.3. A change after C1 is a contract change (change control).
- **Extensibility:** response models are separate from request models, so fields can be added to responses without breaking requests.
- **Verification:** unit tests of the validators in `test_organizations.py` and `test_deals.py` (partial).
- **Evidence:** pytest output.
- **Exit:** the contract is reviewed against spec 5 field by field.
- **Escalate if:** spec 5 is ambiguous for a field.

**T1.7 Frontend skeleton**
- **Objective:** The app shell matches mockup 1's top bar and tokens, and reaches the API.
- **Requirements:** spec 3.9, R2, SEC-1, REL-4, REL-12.
- **Dependencies:** T1.1.
- **Files:** `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/*`, `src/api/client.ts`, `src/components/TopBar.tsx`, `Panel.tsx`, `Button.tsx`, `Badge.tsx`, `ErrorBoundary.tsx`.
- **Steps:**
  1. Set up Vite on `127.0.0.1` with the proxy.
  2. Add the tokens (from the mockup values) and the bundled fonts.
  3. Add the top bar with five routes as placeholders, the error boundary, and a client with timeout and error parsing.
- **Constraints:** no CDN. Tokens only. Badges per ADR-017.
- **Extensibility:** the routes and top bar take their sections from one list.
- **Verification:** V-F10 (partial), and `smoke.spec.ts`.
- **Evidence:** Vitest and Playwright output, and a screenshot of the shell.
- **Exit:** the shell renders with no console errors, and the client calls `/api/health` through the proxy.
- **Escalate if:** none expected.

**T1.8 Test harness and lint gate**
- **Objective:** `npm test` and `npm run lint` are the gates from here on.
- **Requirements:** ENG-2, ENG-3, ENG-7, spec 13.2, V-E00.
- **Dependencies:** T1.2, T1.7.
- **Files:** `scripts/run-tests.mjs`, `playwright.config.ts`, `backend/tests/conftest.py`, `test_smoke.py`, `frontend/vitest.config.ts`, `src/test/setup.ts`, `eslint.config.js`, `.prettierrc`, `e2e/fixtures.ts`, `e2e/smoke.spec.ts`, and the lint settings in `pyproject.toml`.
- **Steps:**
  1. Write the runner, which refuses the default database.
  2. Write the fixtures: reset, console guard, request guard and fixed clock.
  3. Set up Ruff, ESLint (with the `fetch` rule) and Prettier.
  4. Add one smoke test per suite.
- **Constraints:** tests never use `backend/data/accountable.db`.
- **Extensibility:** the runner takes a filter, so a future CI (Week 1 Day 4) can call the same entry point.
- **Verification:** `npm test` passes. `npm run lint` passes. A deliberately failing test makes `npm test` exit nonzero, and is then removed.
- **Evidence:** both commands' output, including the forced failure.
- **Exit:** gates working.
- **Escalate if:** none expected.

**Checkpoint C1 (commit point "Build: phase 1"):**
- `npm run dev` starts the empty app on all three systems, or at least the engineer's own system, with the others in T5.1.
- `npm test` and `npm run lint` pass.
- The contract (T1.6) and schema (T1.4) are frozen for Phase 2 and 3 work.

### Phase 2: Core backend

**T2.1 Organizations, contacts and deals: create, read, update and delete**
- **Objective:** The three record APIs with every rule except stage moves and deletes.
- **Requirements:** R10–R12, R21–R23, R34, R44, R67 (creation position), R18 (creation row).
- **Dependencies:** C1.
- **Files:** `services/__init__.py`, `services/records.py`, `routers/organizations.py`, `contacts.py`, `deals.py`, `main.py` (registration), `tests/test_organizations.py`, `test_contacts.py`, `test_deals.py`.
- **Steps:** write the services and routers per spec 5.3: list counts, required links on create, the R23 check when either link is set or changed, the R34 rule in `PATCH`, a new deal's first stage change row and top position, and 404 for missing IDs.
- **Constraints:** one transaction per request. Routers have no SQL.
- **Extensibility:** services take the connection and clock. Record logic is grouped per record type, so new fields touch one service and one schema.
- **Verification:** V-B03, V-B04, V-B05 (except the stage-change rows).
- **Evidence:** pytest output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.2 Activities**
- **Objective:** The activity API.
- **Requirements:** R13, R53, R55.
- **Dependencies:** T2.1.
- **Files:** `services/records.py` (activity part), `routers/activities.py`, `tests/test_activities.py`.
- **Steps:**
  1. Create, list, update and delete, with exactly one parent (enforced by the API and by the database check).
  2. Done and undone.
  3. Future dates allowed.
- **Constraints:** none beyond T2.1's.
- **Extensibility:** activity types come from one enum, so a new type is a contract change.
- **Verification:** V-B08.
- **Evidence:** pytest output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.3 Stage changes and moves**
- **Objective:** Stage changes from `PATCH` and `/move` follow the rules identically.
- **Requirements:** R15–R18, R24, R63, R67, spec 4.2, 5.4.
- **Dependencies:** T2.1, T1.5.
- **Files:** `services/moves.py`, `routers/deals.py` (move route, and `PATCH` delegating to moves), `tests/test_move.py`.
- **Steps:**
  1. Run one code path for both routes, using `rules.py` for the effects.
  2. Set `closed_at`. Make the contact a customer on Won.
  3. Compute the midpoint, renumbering if needed.
  4. Validate `before_id` and `after_id`, returning 409 `stale_position`.
  5. Add no stage change row when the stage is unchanged.
- **Constraints:** one transaction. The deal's previous state is read in the same transaction.
- **Extensibility:** moves are the one place stage effects happen, so later automation (a later intent) calls the same service.
- **Verification:** V-B06, and the rest of V-B05.
- **Evidence:** pytest output.
- **Exit:** every row of spec 4.2 is verified through the API.
- **Escalate if:** none expected.

**T2.4 Deletes and delete-impact**
- **Objective:** Deleting behaves as the warning says.
- **Requirements:** R30–R36.
- **Dependencies:** T2.2, T2.3.
- **Files:** `services/deletes.py`, the delete routes in the three routers, `tests/test_deletes.py`.
- **Steps:**
  1. Compute the impact counts.
  2. Delete inside a transaction, relying on the foreign keys.
  3. Return 404 for something already gone.
- **Constraints:** don't reimplement the cascade in Python, so the database stays the single source of truth.
- **Extensibility:** none needed.
- **Verification:** V-B07.
- **Evidence:** pytest output with the row checks.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.5 Timelines**
- **Objective:** The three timelines.
- **Requirements:** R50–R54.
- **Dependencies:** T2.3.
- **Files:** `services/timeline.py`, the timeline routes, `tests/test_timelines.py`.
- **Steps:** merge activities and stage changes, newest first, with `source`. The contact timeline follows deals where they're the main contact now.
- **Constraints:** a bounded number of queries per timeline (no query per entry).
- **Extensibility:** the entry shape has a `kind` field, so new entry kinds can be added.
- **Verification:** V-B09.
- **Evidence:** pytest output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.6 Sample data and first-run seeding**
- **Objective:** A new database starts alive.
- **Requirements:** R4, R80–R84.
- **Dependencies:** T2.1–T2.3.
- **Files:** `backend/app/seed.py`, `main.py` (seed if new), `tests/test_seed.py`.
- **Steps:**
  1. Build deterministic data, using a fixed random seed, relative to the clock.
  2. Start from the names and scenarios in `docs/mockups/shared/data.js`.
  3. Walk each deal through its stages to create its history and `closed_at`.
  4. Seed only when the database was just created.
- **Constraints:** use the rules, not hand-set values. Real-looking but made-up names only.
- **Extensibility:** the generator's helpers are reused by `perfdata.py`.
- **Verification:** V-B11.
- **Evidence:** pytest output, and the counts printed.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.7 Seed and clear commands**
- **Objective:** The reset and empty commands.
- **Requirements:** R4, spec 5.6, REL-10.
- **Dependencies:** T2.6.
- **Files:** `backend/app/cli.py`, `package.json` (`seed` and `clear` scripts), `tests/test_cli.py`.
- **Steps:**
  1. Ask the question, and accept `--yes`.
  2. Run each command in one transaction.
  3. Print the summary, and use exit codes 0, 1 and 2.
- **Constraints:** never delete the file. Works while the app is running.
- **Extensibility:** none needed.
- **Verification:** V-B12.
- **Evidence:** pytest output, and a manual run beside a running app on Windows.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T2.8 Dashboard figures**
- **Objective:** `GET /api/dashboard` matches spec 5.5.
- **Requirements:** R70–R79, ADR-015, C-1.
- **Dependencies:** T2.3, T2.6.
- **Files:** `services/dashboard.py`, `routers/dashboard.py`, `tests/test_dashboard.py`.
- **Steps:**
  1. Build each field from the database, using the clock for today.
  2. Use `closed_at` for months and windows.
  3. Build the funnel over deals created in the last 12 months.
  4. Group the follow-ups, and add the counts for the greeting line.
- **Constraints:** aggregation in SQL expressions (Core), not by loading every row. Within NFR-2.
- **Extensibility:** each figure is its own function, so a new panel adds a function and a field.
- **Verification:** V-B10.
- **Evidence:** pytest output on the fixed data set, including the month boundary and an empty database.
- **Exit:** all pass.
- **Escalate if:** a figure's definition is unclear.

**Checkpoint C2 (commit point "Build: phase 2"):**
- V-B01 to V-B14 pass.
- The API answers every spec 5 shape.
- `npm test` and `npm run lint` pass.

### Phase 3: Frontend integration

**T3.1 Shared library and components**
- **Objective:** The building blocks every page uses.
- **Requirements:** R40–R43, R46, R47, R30, R54, R56, REL-7, spec 3.9.
- **Dependencies:** C1. Can start before C2 (see "Parallel execution").
- **Files:** `src/lib/format.ts`, `deals.ts`, `src/components/DataTable.tsx`, `SidePanel.tsx`, `ConfirmDialog.tsx`, `EmptyState.tsx`, `Timeline.tsx`, `Picker.tsx`, `OfflineBanner.tsx`, `NotFound.tsx`, and their tests.
- **Steps:**
  1. Write the formatters.
  2. Build `DataTable` on TanStack Table, with search, sort, 25 per page, the count, default sort, and empty and no-match states.
  3. Build `SidePanel` and `ConfirmDialog` on Radix UI.
  4. Build `Timeline`, `Picker` (with an "Add …" item), and the banner and not-found pieces.
- **Constraints:** no data fetching inside components. Tokens only.
- **Extensibility:** `DataTable` takes its column definitions, so it's reused by all tables.
- **Verification:** V-F01–V-F04, V-F10.
- **Evidence:** Vitest output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T3.2 API types, hooks and refetching**
- **Objective:** One typed client layer for every endpoint.
- **Requirements:** spec 5, 7.2, ENG-6, REL-5.
- **Dependencies:** C2 (or the frozen contract from T1.6 plus mocked responses).
- **Files:** `src/api/types.ts`, `src/api/queries.ts`, `src/api/client.test.ts`.
- **Steps:**
  1. Write the types from `schemas.py`.
  2. Write a hook per endpoint.
  3. Make each mutation refetch its dependent queries.
  4. Translate case in one place.
- **Constraints:** no `fetch` elsewhere (lint-enforced).
- **Extensibility:** adding an endpoint means adding a type and a hook.
- **Verification:** `client.test.ts`.
- **Evidence:** Vitest output.
- **Exit:** all pass.
- **Escalate if:** the contract and spec 5 disagree.

**T3.3 Organizations**
- **Objective:** Table, form, record page and delete.
- **Requirements:** R10, R40–R48, R50, R30, R31.
- **Dependencies:** T3.1, T3.2.
- **Files:** `src/pages/organizations/*`, `src/forms/OrganizationForm.tsx`, `App.tsx` (route), `e2e/organizations.spec.ts`.
- **Steps:** build the table columns per R44, the form in the side panel with server messages, the record page with its lists and timeline, and delete with the server's counts.
- **Constraints:** none beyond the shared ones.
- **Extensibility:** the same pattern is reused by T3.4 and T3.5.
- **Verification:** V-E02.
- **Evidence:** Playwright output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T3.4 Contacts**
- **Objective:** The same for contacts, plus the status filter and inline organization add.
- **Requirements:** R11, R44, R45, R51, R32.
- **Dependencies:** T3.3.
- **Files:** `src/pages/contacts/*`, `src/forms/ContactForm.tsx`, `App.tsx` (route), its tests, `e2e/contacts.spec.ts`.
- **Steps:** follow T3.3. Add the segmented filter with counts, and "Add organization" in the picker.
- **Constraints:** none beyond the shared ones.
- **Extensibility:** none needed.
- **Verification:** V-F06, V-E03.
- **Evidence:** test output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T3.5 Deals**
- **Objective:** The deals table, form and record page.
- **Requirements:** R12, R15, R19, R23, R44, R45, R48, R52.
- **Dependencies:** T3.4.
- **Files:** `src/pages/deals/*`, `src/forms/DealForm.tsx`, `App.tsx` (route), its tests, `e2e/deals.spec.ts`.
- **Steps:**
  1. Add the Late badge and date.
  2. Fill in the probability from the stage, with override.
  3. Filter the contacts by organization, with inline adds.
  4. Add the stage picker on the record page.
- **Constraints:** none beyond the shared ones.
- **Extensibility:** none needed.
- **Verification:** V-F05, V-E04.
- **Evidence:** test output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T3.6 Activities on record pages**
- **Objective:** Log, edit, delete and mark done.
- **Requirements:** R53–R56.
- **Dependencies:** T3.5.
- **Files:** `src/components/ActivityForm.tsx`, the contact and deal page files, `e2e/record-pages.spec.ts`, `e2e/activities.spec.ts`.
- **Steps:**
  1. Add the "Log activity" form.
  2. Add the timeline actions.
  3. Handle the missing-record page.
- **Constraints:** none beyond the shared ones.
- **Extensibility:** none needed.
- **Verification:** V-E05, V-E08.
- **Evidence:** Playwright output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T3.7 Pipeline**
- **Objective:** The board per R60–R67 and mockup 1.
- **Requirements:** R60–R67, REL-8, REL-11.
- **Dependencies:** T3.2, T2.3.
- **Files:** `src/pages/pipeline/*`, `queries.ts` (optimistic move), `App.tsx` (route), its tests, `e2e/pipeline.spec.ts`.
- **Steps:**
  1. Build the stage strip, the columns, and Won and Lost for this month, with the latest 5 and "Show all".
  2. Build the cards per spec 3.9.
  3. Use dnd-kit sortable across columns with the keyboard sensor.
  4. Make moves optimistic, with rollback and a message on failure, and reload on 409.
  5. Add "Add deal" per column.
- **Constraints:** the server's answer replaces optimistic totals. Positions come from the server.
- **Extensibility:** columns take their stages from one list.
- **Verification:** V-F07, V-F08, V-E06.
- **Evidence:** test output.
- **Exit:** all pass, including after a reload.
- **Escalate if:** dnd-kit can't meet the exact-drop or keyboard needs.

**T3.8 Dashboard**
- **Objective:** The dashboard per R70–R79 and mockup 1.
- **Requirements:** R70–R79.
- **Dependencies:** T3.2, T2.8.
- **Files:** `src/pages/dashboard/*`, `App.tsx` (index route), its tests, `e2e/start.spec.ts`, `e2e/won-deal.spec.ts`.
- **Steps:**
  1. Build the hero panel: greeting, summary line, four figures, and the Recharts area-line with the one gradient.
  2. Build the funnel, the won and lost bars, and the donut.
  3. Build the follow-ups with done, and the recent activity.
  4. Add the empty states.
- **Constraints:** figures only from `/api/dashboard`.
- **Extensibility:** each panel is its own component fed by one field of the response.
- **Verification:** V-F09, V-E01, V-E07.
- **Evidence:** test output, and a screenshot.
- **Exit:** all pass.
- **Escalate if:** none expected.

**Checkpoint C3 (commit point "Build: phase 3"):**
- V-F01 to V-F10 and V-E01 to V-E08 pass.
- `npm test` and `npm run lint` pass.

### Phase 4: Engineering hardening

**T4.1 Security verification and dependency audit**
- **Requirements:** SEC-1–SEC-12.
- **Dependencies:** C3.
- **Files:** `backend/tests/test_security.py` (complete), `test_logging.py`, `e2e/security.spec.ts`, `package.json` (`audit` script).
- **Steps:**
  1. Complete V-S01 to V-S10, using E-4's approach for V-S10.
  2. Run `npm audit --audit-level=high` and `uv run pip-audit`.
- **Constraints:** a high or critical finding blocks, and a fix goes through change control.
- **Extensibility:** none needed.
- **Verification:** V-S01–V-S10.
- **Evidence:** test and audit output.
- **Exit:** all pass, and nothing high or critical is open.
- **Escalate if:** a finding has no fix.

**T4.2 Performance**
- **Requirements:** R6, NFR-1–NFR-3, NFR-13, E-3.
- **Dependencies:** C3.
- **Files:** `backend/app/perfdata.py`, `e2e/perf/perf.spec.ts`, `package.json` (`test:perf`).
- **Steps:**
  1. Generate 2 × the volume.
  2. Measure p95 over 20 runs: in-app navigation, API calls, search and sort.
  3. Fix any regressions within the existing design (indexes, query shape, memoization).
- **Constraints:** no architecture change (for example server-side paging, ADR-007) without approval.
- **Extensibility:** none needed.
- **Verification:** V-P01.
- **Evidence:** the timing report.
- **Exit:** thresholds met.
- **Escalate if:** a threshold can't be met without a design change.

**T4.3 Reliability and failure handling**
- **Requirements:** R3, REL-1–REL-12, R78.
- **Dependencies:** C3.
- **Files:** `e2e/persistence.spec.ts`, `e2e/commands.spec.ts`, and fixes in owned files.
- **Steps:**
  1. Automate the reload, restart, seed and clear cases.
  2. Check the timeout, 503 and offline banner with a mocked API.
  3. Run the V-M03 crash test by hand.
- **Constraints:** none.
- **Extensibility:** none needed.
- **Verification:** V-E09, V-E10, V-M03.
- **Evidence:** test output, and crash test notes.
- **Exit:** all pass.
- **Escalate if:** data is lost in V-M03.

**T4.4 Accessibility and layout**
- **Requirements:** NFR-7, R5, R66.
- **Dependencies:** C3.
- **Files:** `e2e/keyboard.spec.ts`, `e2e/layout.spec.ts`, and fixes.
- **Steps:**
  1. Run keyboard-only add, edit, delete and drag.
  2. Check that focus is visible.
  3. Check there's no horizontal scroll at 1024px and 1280px.
- **Constraints:** best effort per the intent. No formal audit.
- **Extensibility:** none needed.
- **Verification:** V-E11, V-E12.
- **Evidence:** test output.
- **Exit:** all pass.
- **Escalate if:** none expected.

**T4.5 Quality gates**
- **Requirements:** ENG-2, ENG-3, spec 13.2 coverage.
- **Dependencies:** T4.1–T4.4.
- **Files:** tests only, to raise coverage.
- **Steps:**
  1. Run `npm run lint`.
  2. Run TypeScript `tsc --noEmit` (part of lint).
  3. Check coverage of `rules.py` and `services/` is at least 90%.
- **Constraints:** no coverage-only tests that assert nothing.
- **Extensibility:** none needed.
- **Verification:** the commands above.
- **Evidence:** outputs.
- **Exit:** all gates pass.
- **Escalate if:** none expected.

**Checkpoint C4 (commit point "Build: phase 4"):** every automated V case passes, the thresholds are met, and the audits are clean.

### Phase 5: Full verification and readiness

**T5.1 Cross-platform and offline run (V-M02).** Fresh clone on Windows, macOS and Linux: first run, then a second with the network off. Also check the LAN address by hand (E-4). *Evidence:* notes per system. *Escalate if:* any system fails.

**T5.2 Visual comparison (V-M04).** `e2e/visual/compare.spec.ts` takes screenshots at 1440px, and they're compared by eye with mockup 1's. Differences are fixed, or listed for the engineer. *Evidence:* the screenshots and a difference list.

**T5.3 Operational documentation.** `docs/STATUS.md`: install Node and uv, run, seed, clear, back up and restore (`backend/data/` with the `-wal` file), logs, and the spec 12 runbook. *Evidence:* the updated file.

**T5.4 End-to-end walkthrough (V-M01) and first-time use (V-M05).** The agent uses every section and action as a salesperson would, with every screen checked by eye and the console watched, and fixes what it finds. Then someone new tries the SC1 questions. *Evidence:* the walkthrough log and findings.

**T5.5 Definition of Done and release.** Check each item of spec 17 and record the evidence. The engineer uses the app and approves it (AC9, SC5). Only after that approval, tag `v0.1.0` (DEP-5). *Escalate if:* any item fails.

**Checkpoint C5 (commit point "Build: phase 5"):** Definition of Done met, the engineer's approval recorded, and the tag made.

### Parallel execution (optional)

The default is one agent working through the tasks in order, one phase per fresh session, as the course does. If the engineer chooses to run two agents:

| Stream | Tasks | Owns | Starts after |
|---|---|---|---|
| A: backend | T2.1–T2.8 | `backend/**` except `main.py` registration lines added by the lead | C1 |
| B: frontend foundation | T3.1, then T3.2 against the frozen contract with mocked responses | `frontend/src/lib/**`, `frontend/src/components/**`, `frontend/src/api/**` | C1 |
| Lead | Merges, and adds the router registration and package additions | `package.json`, `frontend/package.json`, `pyproject.toml`, `main.py`, `docs/STATUS.md` | (none) |

- Each stream works in its own git worktree and branch.
- **Integration checkpoint:** after C2, the lead merges both streams, then runs `npm test` and `npm run lint` before T3.3 starts.
- T3.3 to T3.8 run in sequence on one agent, because they share `App.tsx`, `queries.ts` and the record pages.
- Phase 4 tasks T4.1 to T4.4 can be split across agents, because they touch separate test files. Any fix to shared application files goes through the lead.

---

## 3. Risks

Likelihood (L) and impact (I) are High, Medium or Low. The owner is who acts: the implementing agent, or the engineer for decisions.

| ID | What could break | Likely cause | L / I | Prevention | Detection or test | Recovery | Owner |
|---|---|---|---|---|---|---|---|
| RK-1 | One-command start fails on Windows | Shell syntax, `concurrently` signals, uv path | M / H | Node-only scripts. Phase 1 run on Windows. | T1.1, V-M02 | Fix the script. Document a manual fallback in STATUS. | Agent |
| RK-2 | App or proxy can't connect | `localhost` resolving to `::1` while the servers listen on `127.0.0.1` | M / H | Print and proxy by `127.0.0.1` (R1, SEC-1) | T1.1, T1.7, V-M02 | Fix the address in the configuration | Agent |
| RK-3 | The app refuses its own requests | Host or Origin rewritten by the Vite proxy | M / H | Allowlist covers the proxy's values. Test both paths. | V-S01–V-S03, smoke e2e | Adjust the allowlist (configuration) | Agent |
| RK-4 | Security bypass from a web page or the LAN | Missing Host or Origin check, binding to 0.0.0.0 | L / H | SEC-1 to SEC-3 in T1.3 before any write endpoint exists | V-S01–V-S03, V-S10, V-M02 | Block the release. Fix, then re-run V-S. | Agent, engineer reviews |
| RK-5 | Personal data in logs | Logging bodies or values while debugging | M / M | Logger without bodies. Review in T4.1. | `test_logging.py` (V-S07) | Remove the lines, rotate the logs out | Agent |
| RK-6 | Injection or stored script | Text SQL, `dangerouslySetInnerHTML`, `javascript:` links | L / H | Core only (E-1 exception), React escaping, scheme check (R21) | V-S04, V-S05, V-S08, V-S09 | Fix and re-test | Agent |
| RK-7 | Wrong stage effects (probability, dates, customer) | Two code paths for `PATCH` and `/move` | M / H | One service (T2.3) using `rules.py` | V-B01, V-B06, V-E06, V-E07 | Fix the rule, then add the missing case to spec 4.2's tests | Agent |
| RK-8 | Month figures and closed columns disagree | Mixing `closed_at` and `close_date` | M / M | Only `closed_at` for months and windows (ADR-015) | V-B10, V-F07, V-E07 | Fix the query | Agent |
| RK-9 | Funnel doesn't add up | Seed history inconsistent with stages | M / M | Seed walks deals through stages | V-B11, V-B10 | Regenerate seed logic | Agent |
| RK-10 | Required versus cleared links mishandled | `PATCH` checking links that aren't in the request | M / M | Check only the fields present (R34) | V-B04, V-B05 | Fix the service | Agent |
| RK-11 | Lost writes on a crash | WAL without `synchronous = FULL`, or writes outside transactions | L / H | Connection hook and one transaction per request | V-B02, V-M03 | Fix the settings. Users restore from their copy. | Agent |
| RK-12 | Board out of order, or cards jumping | Optimistic state not reconciled, positions computed in the client | M / M | Server positions win. Reload on 409. | V-E06 | Fix the reconciliation | Agent |
| RK-13 | Migration breaks real data later | SQLite ALTER limits, untested upgrade | M / H | Batch mode. V-B13 on a populated database. Forward-only with a user backup (DEP-6). | V-B13 | Restore the user's copy. Fix the migration. | Agent |
| RK-14 | "Today", the month or follow-ups off by a day | Wall-clock reads in many places, time zones, midnight | M / M | One injectable clock. Fixed clocks in all tests. | V-B10 (boundary), V-F02 | Fix the clock usage | Agent |
| RK-15 | Pages slow at volume | Full lists in the browser, N+1 queries in timelines | L / M | Indexes, bounded queries, memoized tables | V-P01 | Optimize within the design, or escalate to change ADR-007 | Agent, engineer decides |
| RK-16 | App needs the internet | A CDN font or asset | L / M | `@fontsource`, bundled icons | V-E00, V-M02 | Bundle the asset | Agent |
| RK-17 | Flaky end-to-end tests | Drag timing, shared servers, fixed ports | M / M | Stepped drags plus a keyboard route. One worker. A reset per test. | Repeated runs in T4.5 | Stabilize. Optional parallel servers per the course's `week1day3-end`, by approval. | Agent |
| RK-18 | Architectural drift | Fetch in pages, SQL in routers, colors hard-coded | M / M | ENG-1 rules, ESLint `fetch` rule, code review at checkpoints | Lint, checkpoint review | Refactor within the task's files | Agent |
| RK-19 | Dependency or lock problems | Unpinned versions, platform-specific wheels | L / M | Lockfiles, Node 24+ and Python 3.12 pinned | T1.1, V-M02 | Pin or replace through change control | Agent |
| RK-20 | Insecure dependency | A known vulnerability in a package | L / M | Popular, maintained packages. Audit in T4.1. | `npm run audit` | Upgrade, or escalate if there's no fix | Agent, engineer accepts |
| RK-21 | Parallel agents conflict | Both editing shared files | M / M | The ownership table. A lead for shared files. | Merge at the integration checkpoint | Re-apply on the lead's branch | Lead |
| RK-22 | Scope creep or unrequested refactoring | Adding search, filters or abstractions not in the spec | M / M | ENG-10, change control, "no speculative abstractions" | Checkpoint review against section 1 | Revert the extra change | Agent |
| RK-23 | Tests touch real data | Missing `ACCOUNTABLE_DB` in a run | L / H | The runner and `conftest` refuse the default path | T1.8 forced check | Restore from the user's copy | Agent |
| RK-24 | Costly refactoring later for multi-user or hosting | Globals for the database or clock, SQLite-only SQL in services | M / M | Injected connection and clock. SQLite code only in `db.py` and migrations. | Checkpoint review | Isolated to `db.py` and the migrations by design | Agent |

**Blocking risks:** none, once E-1 to E-5 are decided. RK-4 and RK-11 block the release if their tests fail.

**Risks needing the engineer's acceptance:**
- RK-20, if a finding has no fix
- RK-15, if ADR-007 would have to change
- the accepted residual risk A-3 (no backup made by the app)

---

## 4. Proof

Code that exists isn't proof. A task is proven only by the verification named for it, actually run.

### 4.1 Unit tests

- **Backend:** `rules.py` covers every row of spec 4.2, the late and expected-revenue rules, positions and renumbering (V-B01). The schema validators cover each R21 rule: trimming, lengths, email and phone shape, website schemes, bounds, dates and unknown fields (in V-B03 to V-B05).
- **Frontend:**
  - formatters (V-F01) and deal logic, including the greeting boundaries (V-F02)
  - `DataTable` behavior (V-F03) and `ConfirmDialog` (V-F04)
  - forms: messages, probability prefill and override, contact filtering, disabled save (V-F05, V-F06)
  - pipeline column and card rules (V-F07, V-F08)
  - follow-up grouping (V-F09)
  - error boundary, timeout and offline banner (V-F10)
- **Boundaries and negatives:**
  - value 0 and 1,000,000,000
  - probability 0, 100 and 101
  - names of 200 and 201 characters
  - a blank name after trimming
  - `javascript:` and bare-domain websites
  - a follow-up in the past, and an activity in the future

### 4.2 Integration tests (pytest with FastAPI's TestClient and a real temporary SQLite database)

| Area | Tests |
|---|---|
| API contracts | Every endpoint's success shape, and the error format and status codes (V-B03–V-B09, V-B14) |
| Database | Foreign keys, cascades and set-null on the rows (V-B07). Settings (V-B02). Migrations from empty and with data (V-B13). |
| Workflows | Moves with `closed_at`, customer status, stage rows and 409 (V-B06). Timelines (V-B09). Dashboard on a fixed data set (V-B10). Seed (V-B11). CLI (V-B12). |
| Trust boundary | Host, Origin, no CORS, body limit, 415, unknown fields, 500 without stack, no personal data in logs (V-S01–V-S07) |
| Dependency failures | Locked database gives 503 (V-B14). Missing record gives 404. Migration failure leaves the file unchanged (V-B13). |

There's no authentication or authorization to test: it's out of scope by intent (SEC-4). The local-only boundary is tested instead.

The security cases are numbered as follows, splitting the spec's V-S01–V-S10 group:

| ID | Case |
|---|---|
| V-S01 | Foreign Host gives 403 |
| V-S02 | Foreign Origin on POST, PATCH or DELETE gives 403 and changes nothing |
| V-S03 | No CORS headers sent |
| V-S04 | Script text stored and returned as text |
| V-S05 | SQL text stored as text, with the tables intact |
| V-S06 | 2 MB body gives 413, a non-JSON body 415, an unknown field 422 |
| V-S07 | A 500 has no stack trace, and logs have no bodies or values |
| V-S08 | Script text in a name renders as text and doesn't run (e2e) |
| V-S09 | A `javascript:` website is refused in the form and the API (e2e) |
| V-S10 | The servers listen only on 127.0.0.1 (socket check, per E-4) |

### 4.3 End-to-end tests (Playwright with installed Chrome)

Every test runs through `e2e/fixtures.ts` (V-E00): it fails on any console error or any request that isn't local, and starts from a reset database with a fixed clock.

| Journey | Tests |
|---|---|
| First run and every section (WF-1) | V-E01 |
| Record rounds and deletes with links (WF-3, WF-8) | V-E02–V-E05 |
| Pipeline work, including rollback and 409 (WF-4, WF-7) | V-E06 |
| Winning a deal (WF-6) | V-E07 |
| Follow-ups (WF-5) | V-E08 |
| Reset, empty and persistence (WF-2, WF-9) | V-E09, V-E10 |
| Keyboard and layout | V-E11, V-E12 |
| Rendered injection and the scheme check | V-S08, V-S09 |

### 4.4 Nonfunctional checks

| Attribute | Check | Measure |
|---|---|---|
| Performance and scalability | V-P01 at 2 × volume (E-3) | NFR-1 ≤500 ms p95, NFR-2 ≤300/100 ms p95, NFR-3 ≤100 ms |
| Start-up | T1.1, V-M02 | ≤15 s to the printed address after the first run (NFR-5) |
| Security | V-S01–V-S10, `npm run audit` | All refused as specified. Nothing high or critical open. |
| Reliability | V-E10, V-M03, V-B13 | No lost saved change, and migrations safe |
| Accessibility (best effort) | V-E11 | Keyboard-only paths work, and focus is visible |
| Observability | `test_logging.py`, health | Request ID on every response, log lines as OBS-1, health 200 or 503 |
| Offline | V-E00, V-M02 | No non-local requests, and it works with the network off |
| Backward compatibility | (none) | There's no existing API or data. From `v0.1.0` on, V-B13 guards data upgrades. |
| AI evaluation | (none) | The MVP has no AI features (intent §5) |

### 4.5 Verification commands

None of these exist yet. Each is created by the task shown, and they're the only commands to use:

| Command | Created in | Runs | Fails when |
|---|---|---|---|
| `npm test` | T1.8 | pytest, Vitest, Playwright via `scripts/run-tests.mjs`, on a temporary database | Any test fails, or the default database is targeted |
| `npm run lint` | T1.8 | Ruff (lint and format check), ESLint, Prettier check, `tsc --noEmit` | Any finding |
| `npm run format` | T1.8 | Ruff format and Prettier write. It changes files, so it isn't a check. | (never fails on style) |
| `npm run test:perf` | T4.2 | `perfdata` plus `e2e/perf/perf.spec.ts` | A threshold is missed |
| `npm run audit` | T4.1 | `npm audit --audit-level=high` and `uv run pip-audit` | A high or critical finding |
| `npm run dev`, `npm run seed`, `npm run clear` | T1.1, T2.7 | The app and the commands | Exit codes per spec 5.6 |

`npm test` is the single entry point for correctness. A future CI (Week 1 Day 4) can call the same command.

### 4.6 Requirement-to-test traceability

| Requirement | Task | Test type | Test ID | Expected result |
|---|---|---|---|---|
| R1, DEP-3 | T1.1 | Manual, e2e smoke | V-M02, `smoke.spec` | One command installs and prints `http://127.0.0.1:5173` |
| R2, NFR-4 | T1.7, T1.8 | e2e guard, manual | V-E00, V-M02 | No non-local request. Works offline. |
| R3, REL-3 | T2.x, T4.3 | e2e | V-E10 | Changes survive reload and restart |
| R4 | T2.6, T2.7 | Integration, e2e | V-B11, V-B12, V-E09 | New database seeded. Commands ask and work. |
| R5 | T4.4 | e2e | V-E12 | No horizontal scroll at 1024 and 1280 |
| R6, NFR-1–NFR-3 | T4.2 | Performance | V-P01 | Thresholds met at 2 × volume |
| R7 | All UI tasks | e2e guard | V-E00 | No console errors |
| R10–R13, R21, R22 | T1.6, T2.1, T2.2 | Unit, integration | V-B03–V-B05, V-B08 | Rules enforced, with 422 messages per field |
| R14–R20, R24 | T1.5, T2.3 | Unit, integration | V-B01, V-B06 | Every row of spec 4.2 |
| R23 | T2.1, T3.5 | Integration, component | V-B05, V-F05 | Mismatched contact refused, picker filtered |
| R30–R36 | T2.4, T3.1, T3.3 | Integration, component, e2e | V-B07, V-F04, V-E02 | Counts match. Links cleared as warned. |
| R40–R48 | T3.1, T3.3–T3.5 | Component, e2e | V-F03, V-F05, V-F06, V-E02–V-E04 | Search, sort, paging, forms and messages |
| R50–R56 | T2.5, T3.6 | Integration, e2e | V-B09, V-E05, V-E08 | Timelines merged and newest first. Missing record handled. |
| R60–R67 | T2.3, T3.7 | Integration, component, e2e | V-B06, V-F07, V-F08, V-E06 | Board rules, exact drops, rollback, this month only |
| R70–R79 | T2.8, T3.8 | Integration, component, e2e | V-B10, V-F09, V-E01, V-E07 | Figures match the data, a win shows at once |
| R80–R84 | T2.6 | Integration | V-B11 | Coverage and history fit |
| NFR-5 | T1.1 | Manual | V-M02 | ≤15 s |
| NFR-6, NFR-12 | T5.1 | Manual | V-M02 | Works on all three systems |
| NFR-7, R66 | T3.7, T4.4 | e2e | V-E11 | Keyboard paths work |
| NFR-8, SC1 | T5.4 | Manual | V-M05 | Questions answered within a couple of clicks |
| NFR-9, SC5 | T5.2 | Manual (screenshots) | V-M04 | Matches mockup 1. Engineer approves. |
| SEC-1–SEC-3 | T1.3, T4.1 | Integration, e2e | V-S01–V-S03, V-S10 | Foreign Host or Origin refused, local-only binding |
| SEC-5–SEC-7 | T1.6, T4.1 | Integration, e2e | V-S04–V-S06, V-S08, V-S09 | Stored as text. Bad schemes and bodies refused. |
| SEC-8 | T1.2, T4.1 | Integration | V-S07 | No bodies or values in logs |
| SEC-11 | T4.1 | Audit | `npm run audit` | Nothing high or critical |
| REL-1, REL-2 | T1.4, T4.3 | Integration, manual | V-B02, V-M03 | Settings applied. No loss on crash. |
| REL-4–REL-8, REL-12 | T1.7, T3.2, T3.7, T4.3 | Component, e2e | V-F10, V-E06 | Timeouts, 503, offline, rollback, error boundary |
| REL-9, DEP-4 | T1.4 | Integration | V-B13 | Failed migration leaves the file unchanged |
| REL-10 | T2.7 | Integration, e2e | V-B12, V-E09 | Commands work beside a running app |
| OBS-1–OBS-5 | T1.2 | Integration | `test_logging.py`, V-B14 | Log lines, request ID, health |
| ENG-1–ENG-7 | T1.8, T4.5 | Lint, coverage | `npm run lint`, coverage | Clean lint. ≥90% on rules and services. |
| AC1 | T3.8, T5.1 | e2e, manual | V-E01, V-M02 | Starts with one command, lands on the dashboard |
| AC2 | T3.3–T3.5, T4.3 | e2e | V-E02–V-E04, V-E09, V-E10 | Full record rounds, reset, empty and persistence |
| AC3 | T3.6 | e2e | V-E05 | Links and the combined timeline |
| AC4 | T3.7 | e2e | V-E06 | Drag changes stage and probability. Order persists. |
| AC5 | T3.6 | e2e | V-E08 | Activities and follow-ups shown until done |
| AC6 | T3.8 | e2e | V-E07 | Win reflected, contact becomes customer |
| AC7 | T3.8 | e2e, manual | V-E01, V-M04 | Line, bar and pipeline visuals present |
| AC8 | T4.3 | Manual | V-M03 | Saved changes survive a crash |
| AC9 | T5.4, T5.5 | Manual | V-M01 | Walkthrough clean. Engineer approves. |
| SC2–SC4 | After release | Use | V-M06 | Checked by the engineer over two weeks |

### 4.7 Evidence for every task

Each task appends an entry to `docs/build_logs.log` (E-5) with:

1. the commands actually run
2. their results (pass and fail counts, or the relevant excerpt)
3. any reports produced (coverage, timings, screenshots, with their paths)
4. the files changed
5. the requirement IDs covered
6. known limitations, warnings or failures still open

A test is reported as passing only if it was run and passed. A skipped or failed check is reported as such.

---

## 5. Engineering review

### Findings

| Severity | Finding | Resolution |
|---|---|---|
| Critical | None remaining. Without E-1, the "no raw SQL" rule and the crash-safety settings contradicted each other, which would have blocked T1.4. | Raised as E-1, with a recommendation |
| Major | One command, two Uvicorn modes (spec 7.4) | E-2 |
| Major | NFR-1 is unmeasurable as written under ADR-010's development servers | E-3 |
| Major | V-S10 can't be automated reliably | E-4 |
| Major | Plan 2.x had no per-task exit criteria, evidence or escalation, so an agent would have had to invent them | Rewritten with the mandatory task structure |
| Major | There was no single gate against tests hitting real data | `run-tests.mjs` and `conftest.py` refuse the default path (T1.8, RK-23) |
| Minor | `docs/mockups/shared/data.js` is a useful seed starting point | Reused in T2.6 |
| Minor | The course's Day 4 harness (CI, `check` scripts, hooks) will build on these commands | The command names are kept simple, and `npm test` is reusable as the entry point |
| Minor | Phase 5 tasks are written more briefly than Phases 1 to 4 | They're manual checks whose steps are defined by spec 13.3 |

### Review against the quality attributes

- **Completeness:** every R, NFR, SEC, REL, OBS, DEP and ENG item and AC1–AC9 maps to a task and a test (section 4.6). SC2–SC4 are measured after release, by design.
- **Architecture:** spec 7's boundaries are kept, and lint enforces the frontend's network boundary. No architecture change is planned.
- **Modularity and extensibility:**
  - The injected connection and clock, SQLite isolated to `db.py`, separate request and response models, a generic table and panel, and token-only colors keep the likely next steps contained: sign-in and multi-user, Postgres and hosting, dark mode, new record types.
  - No plugin layers or speculative abstractions are introduced.
- **Simplicity:** one service per concern, and no repository or ORM layers on top of Core.
- **Testability:** pure rules, an injectable clock, temporary databases, and one entry point.
- **Security:** the trust boundary is built in T1.3, before any write endpoint exists, with negative tests.
- **Reliability:** transactions, durability settings, timeouts, one retry for reads and none for writes, rollback, and clear start-up failures.
- **Operational readiness:** health, logs, a runbook, backup and restore, and a release tag after approval.
- **Agent readiness:** each task names its files, steps, gates and stop conditions. Low-level design is left open within those bounds.

### Readiness

The engineer approved the plan and decided E-1 to E-5 on 21 Nov 2026. The work is 30 tasks in 6 phases (0–5), with 6 checkpoints (C0–C5). C1 to C5 are commit points.

---

**STATUS: APPROVED — 21 Nov 2026**

Implementation plan approved by the engineer on 21 Nov 2026. Implementation proceeds in task order, starting with Phase 0.
