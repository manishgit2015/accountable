# Plan: building the Accountable MVP

This plan builds what the approved intent (`docs/intent.md`) asks for, as the approved spec 2.0 (`docs/spec.md`) designs it. It uses the spec's IDs:

- requirements: R, NFR, SEC, REL, OBS, DEP and ENG
- verification cases: V
- decisions: ADR
- the intent's acceptance and success criteria: AC1–AC9 and SC1–SC5

The stack is in `docs/TECH_STACK.md`, and the visual reference is mockup B in `docs/mockups/b-hero-topnav/`. Mockup B labels the closed columns "12 months", but the spec's R60 (this month only) wins.

No code has been written yet. The repo holds only the course material and these docs.

## Files that change

Everything below is new except where marked *(changed)*. `README.md` is the course's guide and stays as it is.

### Repo root

| File | Purpose |
|---|---|
| `package.json` | npm workspace with `frontend/`. Scripts: `predev`, `dev`, `test`, `lint`, `seed`, `clear`. Sets `engines.node` to `>=24`, and the version to 0.1.0 (DEP-5). |
| `package-lock.json` | Locked npm versions |
| `pyproject.toml`, `uv.lock` | The Python 3.12 project for `backend/`: FastAPI, Uvicorn, SQLAlchemy, Alembic and Pydantic, with dev dependencies pytest, httpx, pytest-cov, ruff and pip-audit. Ruff settings live here (ENG-3). Version 0.1.0. |
| `.python-version` | Pins 3.12 for uv |
| `playwright.config.ts` | Installed Chrome (`channel: "chrome"`), and test servers on `127.0.0.1:8001` and `:5174` with a temporary database (DEP-1) |
| `scripts/ensure-installed.mjs` | Run by `predev`. Uses Node built-ins only. Checks for Node 24+ and uv with a clear message, then runs `npm install` and `uv sync` only when needed (DEP-3). |
| `scripts/run-tests.mjs` | Runs pytest, then Vitest, then Playwright, stops at the first failure, and makes sure the tests never use the default database (section 13.2 of the spec) |

`.gitignore` needs no change: `*.db`, `*.db-wal`, `*.db-shm` and `logs/` already cover the data and log files.

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `app/main.py` | Builds the app: middleware, routers, the start-up order (migrate, then seed if new, then log the start-up lines), and the start-up failures (REL-9, OBS-4) |
| `app/config.py` | Reads `ACCOUNTABLE_DB`, `ACCOUNTABLE_API_PORT`, `ACCOUNTABLE_WEB_PORT` and `ACCOUNTABLE_LOG_LEVEL` (DEP-2). Holds the clock the tests can set. |
| `app/db.py` | Engine. Every connection sets `foreign_keys`, WAL, `synchronous = FULL` and `busy_timeout` (spec 6.3). Table definitions in SQLAlchemy Core (ENG-4). |
| `app/errors.py` | The error format and status codes from spec 5.2. Turns a locked database into 503 `busy` (REL-6), and anything unexpected into a generic 500. |
| `app/security.py` | Middleware for the Host check (SEC-2), the Origin check on changing requests (SEC-3), the 1 MB body limit, and JSON-only bodies |
| `app/logging.py` | One line per request with a request ID and path template, an `X-Request-ID` header, a rotating file (5 MB × 3), and no bodies or field values (OBS-1–OBS-3, SEC-8) |
| `app/schemas.py` | Pydantic models with `extra = forbid` and the R21 field rules |
| `app/rules.py` | Pure functions: probabilities, late check, expected revenue, Won/Lost effects, positions and renumbering (R14–R20, R24, spec 6.4) |
| `app/services/records.py` | CRUD for the four records, with the R23 contact check and the R34 cleared-link rule |
| `app/services/moves.py` | Stage changes and `/move`, applying R15–R18 and R67, `closed_at`, and 409 `stale_position` |
| `app/services/deletes.py` | Delete-impact counts and deletes (R30–R36) |
| `app/services/timeline.py` | Organization, contact and deal timelines (R50–R54) |
| `app/services/dashboard.py` | Every figure in spec 5.5, including the funnel over deals created in the last 12 months and the months by `closed_at` (R70–R79) |
| `app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `dashboard.py`, `health.py` | HTTP only (ENG-1) |
| `app/seed.py` | Sample data relative to today, with stage history and `closed_at` (R80–R84) |
| `app/cli.py` | `seed` and `clear`, with their question, `--yes` and exit codes (spec 5.6) |
| `app/perfdata.py` | Generates 2 × the intent's data volume for the performance run (V-P01) |
| `alembic.ini`, `migrations/env.py`, `migrations/versions/0001_initial.py` | Alembic migrations using SQLite batch mode, run on start-up (ADR-004, DEP-4) |
| `tests/conftest.py` | A new temporary database and a fixed clock for each test, and a check that the default path is never used |
| `tests/test_*.py` | See [Proof](#proof) |

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | Vite and React with TypeScript in strict mode. Vite listens on `127.0.0.1`, proxies `/api` to `http://127.0.0.1:8000`, and keeps its local-only allowed hosts (SEC-1, SEC-2). |
| `eslint.config.js`, `.prettierrc` | Lint and format rules (ENG-2), including a rule against `fetch` outside `src/api/` (ENG-1) |
| `vitest.config.ts`, `src/test/setup.ts` | jsdom, Testing Library and a ResizeObserver stub |
| `src/main.tsx`, `src/App.tsx` | Router, query client (reads retried once, changes never retried: REL-5), the `@fontsource` imports, and an error boundary on each page (REL-12) |
| `src/styles/tokens.css`, `global.css` | The spec 3.9 tokens, type scale, panels and shadows |
| `src/api/client.ts` | Fetch with a 10 s timeout (REL-4). Reads the error format, the request ID and 404/409/503. Translates `snake_case` to `camelCase` (ENG-6). |
| `src/api/queries.ts` | TanStack Query hooks and the refetches each change triggers (spec 7.2) |
| `src/lib/format.ts`, `src/lib/deals.ts` | Money and dates. The late check, expected revenue, greeting (R79) and initials. |
| `src/components/` | `TopBar`, `Panel`, `Button`, `Badge`, `DataTable`, `SidePanel`, `ConfirmDialog`, `EmptyState`, `Timeline`, `ActivityForm`, `Picker`, `ErrorBoundary`, `OfflineBanner` (REL-7), `NotFound` (R56) |
| `src/forms/` | `OrganizationForm`, `ContactForm`, `DealForm`, with Zod schemas matching R21 and the server's messages shown next to fields (R48) |
| `src/pages/organizations/`, `contacts/`, `deals/` | List and detail pages (R40–R56) |
| `src/pages/pipeline/` | `PipelinePage`, `StageStrip`, `Board`, `Column`, `DealCard`, `ClosedRow` (dnd-kit, with the keyboard sensor) |
| `src/pages/dashboard/` | `DashboardPage`, `HeroPanel`, `RevenueChart`, `FunnelPanel`, `WonLostChart`, `StageDonut`, `FollowUps`, `RecentActivity` |
| `src/**/*.test.ts(x)` | See [Proof](#proof) |

### End to end (`e2e/`)

| File | Purpose |
|---|---|
| `e2e/fixtures.ts` | Resets the test database before each test (`seed --yes` or `clear --yes`). Fails on any console error or any request leaving `127.0.0.1` or `localhost` (V-E00). Fixes the clock with `page.clock`. |
| `e2e/*.spec.ts` | See [Proof](#proof) |
| `e2e/perf/perf.spec.ts` | The timing run against the `perfdata` set, kept out of the normal `npm test` and run in phase 8 (V-P01) |

### Docs

| File | Purpose |
|---|---|
| `docs/STATUS.md` *(changed)* | How to install, run, seed, clear, back up and restore, plus the runbook (spec 12) and progress after each phase |
| `docs/plan.md` *(changed)* | This plan |

## Order of work

Each phase ends with `npm test` and `npm run lint` passing, and `docs/STATUS.md` updated (ENG-7, ENG-9). Phases run in order, with one exception: phases 2 and 3 only touch the backend, so phase 4 can start alongside them once phase 1 is done, if two people or sessions are working on it.

### Phase 0: Skeleton, commands and guard rails

1. Root `package.json`, `pyproject.toml`, `scripts/ensure-installed.mjs` and `scripts/run-tests.mjs`.
2. FastAPI with `config.py`, `errors.py`, `security.py`, `logging.py` and `GET /api/health`. Vite React with the top bar and an empty page, both on `127.0.0.1`.
3. Alembic set up with an empty first migration, run on start-up.
4. Tokens, global styles and the bundled fonts.
5. ESLint, Prettier and Ruff, and a smoke test in each suite.
6. `docs/STATUS.md`: installing Node and uv, running the app, and where the logs are.

*Done when:*
- A fresh clone runs `npm run dev` on Windows, macOS and Linux and prints `http://127.0.0.1:5173` within 15 s (R1, NFR-5).
- The page shows the top bar, and `/api/health` answers.
- A request with a foreign Host or Origin gets 403.
- `npm test` passes.

### Phase 1: Data model and business rules (backend)

1. The five tables and their indexes in `db.py` and `0001_initial.py`.
2. `rules.py`, with full unit tests before any service uses it.
3. Schemas with the R21 rules, and `services/records.py` with CRUD and the R23 and R34 checks.
4. `services/moves.py`: stage changes, `/move`, `closed_at`, the top-of-column rule and 409 `stale_position`.
5. `services/deletes.py` with the delete-impact counts.
6. `services/timeline.py`.
7. The routers for the four records.

*Done when* V-B01 to V-B09 and V-B14 pass.

### Phase 2: Sample data, seed and clear (backend)

1. `seed.py`, with history and `closed_at` that fit each deal, and closed deals in every one of the last 12 months, the current month included.
2. Seeding a new database at start-up, after the migrations run.
3. `cli.py` and the `seed` and `clear` scripts.
4. A migration test on a database holding data.

*Done when* V-B11 to V-B13 pass, and seed and clear work next to a running app on Windows.

### Phase 3: Dashboard figures (backend)

1. `services/dashboard.py` and its router, producing the spec 5.5 response.

*Done when* V-B10 passes on its fixed data set, including the month boundary and an empty database (AC6).

### Phase 4: Frontend foundations

1. Routing for the five sections, the record pages and `NotFound`.
2. `client.ts` with the timeout, error format and request ID, and `queries.ts`.
3. `format.ts` and `deals.ts`.
4. Shared components, including `ErrorBoundary` and `OfflineBanner`.

*Done when* V-F01 to V-F04 and V-F10 pass, and every route shows its title.

### Phase 5: Tables, record pages, forms and activities

1. The three tables with their default sorts, search, paging and the contact status filter (R40–R47).
2. The forms in the side panel, with inline adds, the probability fill-in and server messages (R45, R48, R15).
3. Delete dialogs with the server's counts (R30).
4. Record pages, timelines, "Log activity", and editing, deleting and marking activities done (R50–R56).

*Done when* V-F05, V-F06 and V-E01 to V-E05 and V-E08 pass.

### Phase 6: Pipeline

1. The board, stage strip and totals. Won and Lost show this month only, with the latest 5 and "Show all" (R60–R62).
2. Dragging across and within columns with optimistic totals and rollback. A 409 makes the board reload. The keyboard sensor works (R63, R64, R66, REL-8, REL-11).
3. "Add deal" in a column, and stage changes made elsewhere landing at the top (R65, R67).

*Done when* V-F07, V-F08 and V-E06 pass, including after a reload.

### Phase 7: Dashboard

1. Hero panel with greeting, summary line, the four figures and the revenue chart.
2. Funnel, won and lost bars, and stage donut.
3. Follow-ups with mark done, and recent activity.
4. Empty states (R78).

*Done when* V-F09 and V-E07 pass, and the page matches mockup B by eye.

### Phase 8: Hardening

1. Security: V-S01 to V-S10, and `npm audit --audit-level=high` and `pip-audit` with nothing high or critical open (SEC-11).
2. Performance: V-P01 at 2 × volume against NFR-1 to NFR-3.
3. Reliability: V-E09, V-E10 and the V-M03 crash test.
4. Accessibility and layout: V-E11 and V-E12.
5. The offline run of V-M02.
6. Coverage of `rules.py` and `services/` is at least 90%.
7. Fix whatever these turn up.

### Phase 9: Walkthrough, sign-off and release

1. V-M01: the coding agent's end-to-end walkthrough, fixing what it finds (AC9).
2. V-M04: every screen against mockup B and the brand. V-M05: first-time use (SC1).
3. `docs/STATUS.md` gets the runbook, backup and restore steps (spec 12).
4. Check every Definition of Done item (spec 17).
5. The product owner uses it and approves it (AC9, SC5).
6. Tag `v0.1.0` (DEP-5).

After release, the product owner checks SC2–SC4 over two weeks of use (V-M06). That isn't part of done.

## Risks

| Risk | What could go wrong | How we handle it |
|---|---|---|
| **One command on Windows** | `predev` installing, `concurrently`, uv paths and Ctrl+C behave differently on Windows | `ensure-installed.mjs` uses only Node built-ins. Phase 0 isn't done until it's run on Windows. No shell-specific syntax in scripts. |
| **`localhost` and IPv6** | `localhost` resolves to `::1` on some systems, while the servers listen on `127.0.0.1`, so the page or the proxy fails | Print `127.0.0.1` (R1). Point the proxy at `127.0.0.1:8000`. Phase 0 checks it on all three systems. |
| **Host and Origin checks blocking our own app** | The Vite proxy rewrites `Host` or `Origin`, so the backend refuses the app's own requests | The allowed values include the proxy's. Phase 0 tests both a good request through the proxy and a refused foreign one. |
| **Alembic with SQLite** | SQLite can't alter most columns in place, so later migrations fail | Use Alembic's batch mode from the first migration. V-B13 runs every migration on a database holding data. |
| **"Today" and time zones** | Close dates, late deals, months and follow-up groups depend on local time, so tests near midnight or in other zones give different answers | One clock in `config.py`, which tests set. Vitest uses fake timers and Playwright `page.clock`. V-B10 includes a month boundary. |
| **`closed_at` vs `close_date`** | Mixing the two gives month figures and Won/Lost columns that disagree | The month figures and the closed columns read only `closed_at` (spec 6.1). V-B10 and V-F07 cover both. |
| **Drag and drop** | Exact drops, saved order, rollback and two tabs are fiddly, and Playwright drags can be flaky | Position logic lives in `rules.py` with unit tests. E2e drags use stepped mouse moves, with a keyboard drag as a second route. The 409 path is tested. |
| **Funnel from stage history** | Wrong history in the seed gives a funnel that doesn't add up | `seed.py` walks each deal through its stages. V-B11 checks every history starts at creation and ends at the current stage. |
| **Required links vs cleared links** | R34 allows saving a record with a cleared link, while new records need all of them, which is easy to get wrong in `PATCH` | `PATCH` checks a link only when it's in the request. V-B04 and V-B05 cover kept, filled-in and mismatched links. |
| **Durability** | WAL with a lower `synchronous` setting can lose the last writes on a power cut | `synchronous = FULL`, checked by V-B02. V-M03 kills the process right after a save. |
| **Seed or clear while running** | Deleting an open database file fails on Windows | Clear tables in a transaction, never delete the file. V-B12 runs with another connection open. |
| **Backups and WAL** | A user copies only `accountable.db` and misses the `-wal` file | The runbook says to stop the app and copy the whole `backend/data/` folder. |
| **Performance** | Loading everything into the browser, or building timelines, gets slow | Indexes from spec 6.2. V-P01 runs at 2 × volume. ADR-007 names server-side paging as the fallback. |
| **Offline** | A library or font from a CDN breaks the app without internet | Only bundled packages. V-E00 blocks every request that isn't local. |
| **Brand fidelity** | Screens drift from mockup B, or small Sea Green or Marigold text fails contrast | Tokens only, with the `-text` variants for text. V-M04 compares against the mockup. |
| **Recharts in tests** | Charts render nothing in jsdom | The setup stubs ResizeObserver. Chart contents are checked in end-to-end tests. |
| **Test data leaking** | Tests change the real database | `run-tests.mjs` and `conftest.py` refuse to run against the default path. The test servers use their own ports. |
| **Scope creep** | Adding things outside the intent, such as global search, user names or board filters | ENG-10: anything the spec doesn't settle goes to the product owner first. |

## Proof

`npm test` runs pytest, Vitest and Playwright, and fails if any test fails. Each test's name starts with the requirement it proves, for example `R16 moving to Won sets the close date to today`. The V IDs match spec section 13.3, which says what each case covers.

### Backend unit and integration tests (pytest, `backend/tests/`)

| V | File | Key checks | Phase |
|---|---|---|---|
| V-B01 | `test_rules.py` | Stage probabilities. A hand-set probability kept until the stage changes. Won/Lost close date. Late. Expected revenue. Midpoint positions and renumbering. | 1 |
| V-B02 | `test_db.py` | Foreign keys, WAL and `synchronous = FULL` on every connection. The exactly-one-parent check on activities. | 1 |
| V-B03 | `test_organizations.py` | CRUD, R21 field rules, refused `javascript:` website, list counts and open value | 1 |
| V-B04 | `test_contacts.py` | Organization required on create, including leads. Status defaults to lead. Cleared organization kept on edit. | 1 |
| V-B05 | `test_deals.py` | Required fields, value and probability bounds, contact must match organization, `PATCH` stage change follows the rules and goes to the top of its column | 1 |
| V-B06 | `test_move.py` | Across and within columns. Won makes the contact a customer and sets `closed_at`. Reopening keeps status and close date. One stage change row per change. 409 `stale_position`. A repeated move. | 1 |
| V-B07 | `test_deletes.py` | R31–R33 checked on the rows. Delete-impact counts. Won deals still counted after links go. Deleting something already gone gives 404. | 1 |
| V-B08 | `test_activities.py` | CRUD, done and undone, future dates allowed, exactly one parent | 1 |
| V-B09 | `test_timelines.py` | Deal, contact and organization timelines, newest first, with sources. Follows the current main contact. | 1 |
| V-B10 | `test_dashboard.py` | Every spec 5.5 figure on a fixed data set. The funnel over deals created in the last 12 months. Months by `closed_at`. Follow-up groups. Month boundary. Empty database. Greeting counts. | 3 |
| V-B11 | `test_seed.py` | Counts and coverage. Closed deals in all 12 months. Late deals and follow-up groups present. Every history fits its deal. Seeds only a new database. | 2 |
| V-B12 | `test_cli.py` | Refuses without "yes". `--yes` skips the question. Exit codes 0, 1 and 2. Works with another connection open. | 2 |
| V-B13 | `test_migrations.py` | Upgrade from empty, and from the previous version holding data. A failed migration leaves the database as it was. | 2 |
| V-B14 | `test_errors.py` | The error format and request ID, and each status code: 400, 404, 409, 413, 415, 422, 503 and 500 | 1 |
| V-S01–V-S06 | `test_security.py` | A foreign Host gives 403. A foreign Origin on POST, PATCH or DELETE gives 403 and changes nothing. No CORS headers. Script and SQL text stored as plain text. 2 MB body gives 413. Unknown field gives 422. A 500 shows no stack trace. Logs hold no field values. | 0 and 8 |

### Frontend unit and component tests (Vitest, next to the files they test)

| V | File | Key checks | Phase |
|---|---|---|---|
| V-F01 | `lib/format.test.ts` | `$12,500`, `$1.2M`, `$0`, "12 Nov 2026", "12 Nov 2026, 14:30", "Today" and "Yesterday" | 4 |
| V-F02 | `lib/deals.test.ts` | Late check against a fixed today, expected revenue, greeting at 11:59, 12:00, 17:59 and 18:00, and initials | 4 |
| V-F03 | `components/DataTable.test.tsx` | Search ignoring case, sort and reverse, 25 per page, "Showing 1–25 of N", default sorts, empty and no-match messages | 4 |
| V-F04 | `components/ConfirmDialog.test.tsx` | Shows the name and the server's counts. Nothing is deleted until confirmed. | 4 |
| V-F05 | `forms/DealForm.test.tsx` | Field messages. Probability fills in and can be overwritten. Contacts filtered by organization. Server messages shown next to fields. Save disabled while saving. | 5 |
| V-F06 | `forms/ContactForm.test.tsx` | Organization required, and "Add organization" inline | 5 |
| V-F07 | `pages/pipeline/Column.test.tsx` | Totals. Won and Lost show this month only, the latest 5 and "Show all". A deal closed last month is absent. | 6 |
| V-F08 | `pages/pipeline/DealCard.test.tsx` | Late badge in place of the date, and meter width | 6 |
| V-F09 | `pages/dashboard/FollowUps.test.tsx` | Overdue, Today and Next 7 days groups, the later count, and a ticked item leaving | 7 |
| V-F10 | `components/ErrorBoundary.test.tsx`, `api/client.test.ts` | Fallback screen, 10 s timeout message, request ID shown, offline banner | 4 |

### End-to-end tests (Playwright with installed Chrome, `e2e/`)

Every test runs through `e2e/fixtures.ts` (V-E00), so each one fails on a console error or on any request that isn't local (R2, R7).

| V | File | Key checks | Phase |
|---|---|---|---|
| V-E01 | `start.spec.ts` | Lands on the dashboard with sample data on every screen | 5 |
| V-E02 | `organizations.spec.ts` | Add, search, sort, edit and delete. The delete warning's counts. Contacts and deals show "None" afterwards. | 5 |
| V-E03 | `contacts.spec.ts` | The same round, plus the status filter and "Add organization" inside the form | 5 |
| V-E04 | `deals.spec.ts` | The same round. Late deals stand out. The probability fills in from the stage. | 5 |
| V-E05 | `record-pages.spec.ts` | Links on each page. The organization's combined timeline. A missing record's page. | 5 |
| V-E06 | `pipeline.spec.ts` | Drag across and within columns, then reload. Add in a column. Late cards. Keyboard drag. Rollback when the API fails (mocked). Reload on 409. | 6 |
| V-E07 | `won-deal.spec.ts` | Moving to Won updates won-this-month and the chart, sets today's close date, adds the timeline and recent activity entries, and makes the contact a customer | 7 |
| V-E08 | `activities.spec.ts` | Log each type with a follow-up. It shows on the deal's and the contact's timelines, and on the dashboard until done. | 5 |
| V-E09 | `commands.spec.ts` | After `clear --yes`, every screen is empty and works. After `seed --yes`, the data is back. | 8 |
| V-E10 | `persistence.spec.ts` | Changes survive a reload and a backend restart | 8 |
| V-E11 | `keyboard.spec.ts` | Add, edit, delete and drag with the keyboard only. Focus always visible. | 8 |
| V-E12 | `layout.spec.ts` | No horizontal scroll at 1024px and 1280px | 8 |
| V-S07–V-S10 | `security.spec.ts` | A script in a name shows as text and doesn't run. A `javascript:` website is refused in the form. The servers can't be reached on the computer's network address. A cross-site POST from another origin changes nothing. | 8 |
| V-P01 | `perf/perf.spec.ts` | Page, API and search timings at 2 × volume against NFR-1 to NFR-3. Run in phase 8, outside the normal `npm test`. | 8 |

### Checks done by hand

| V | Check | Phase |
|---|---|---|
| V-M01 | The coding agent's full walkthrough, then the product owner's review (AC9) | 9 |
| V-M02 | A fresh clone on Windows, macOS and Linux, then a second run with the network off (AC1, R1, R2) | 0 and 8 |
| V-M03 | Kill the backend right after a save, restart, and find the change there (AC8, REL-1) | 8 |
| V-M04 | Every screen against mockup B and the brand (SC5) | 7 and 9 |
| V-M05 | Someone new answers the SC1 questions with no instructions | 9 |
| V-M06 | Two weeks of real use, checking SC2–SC4. This is after release, not part of done. | After release |
