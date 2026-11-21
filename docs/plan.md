# Plan: building the Accountable MVP

This plan is how we'll build what `docs/intent.md` asks for, as `docs/spec.md` describes it. Requirement IDs (R1, R2 and so on) refer to the spec, and "criterion 1" to 9 refer to the intent's success criteria. The stack and commands are in `docs/TECH_STACK.md`. The visual reference is mockup B in `docs/mockups/b-hero-topnav/`.

No code has been written yet. The repo holds only the course material and these docs.

## Files that change

Everything below is new except where marked *(changed)*. `README.md` is the course's guide and stays as it is.

### Repo root

| File | Purpose |
|---|---|
| `package.json` | npm workspace with `frontend/`, plus the scripts `dev`, `predev`, `test`, `seed` and `clear`. Sets `engines.node` to `>=24`. |
| `package-lock.json` | Locked npm versions |
| `pyproject.toml`, `uv.lock` | The Python 3.12 project for `backend/`, with its dev dependencies (pytest, httpx) |
| `.python-version` | Pins 3.12 for uv |
| `playwright.config.ts` | End-to-end setup: installed Chrome (`channel: "chrome"`), and test servers on ports 8001 and 5174 that use a test database |
| `scripts/ensure-installed.mjs` | Run by `predev`. Runs `npm install` and `uv sync` only when they're missing, using no packages of its own (Concern 8, R1). |
| `.gitignore` *(changed)* | Adds `backend/data/` (the `*.db` pattern already covers the file) |

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `app/main.py` | FastAPI app, the `/api` routers, and seeding when the database is new (R4) |
| `app/config.py` | Database path from `ACCOUNTABLE_DB` (default `backend/data/accountable.db`), plus a clock the tests can set |
| `app/db.py` | SQLAlchemy Core engine, `PRAGMA foreign_keys = ON` on every connection, and the five tables with their constraints and indexes |
| `app/schemas.py` | Pydantic models for requests and responses, and the 422 field messages |
| `app/rules.py` | Stage probabilities, late deals, expected revenue, won/lost close dates, contact-to-customer, and midpoint and renumbering positions (R14–R20). Pure functions. |
| `app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py` | CRUD, the `/move` endpoint, and the delete-impact counts (R30) |
| `app/routers/dashboard.py` | `GET /api/dashboard` |
| `app/services/timeline.py` | Merged, newest-first timelines for organizations, contacts and deals (R50–R54) |
| `app/services/dashboard.py` | Summary figures, monthly series, funnel from stage history, donut, follow-up groups and recent activity (R70–R77) |
| `app/seed.py` | Sample data with dates relative to today (R80–R84) |
| `app/cli.py` | `seed` and `clear`: ask "Type yes to continue", accept `--yes`, and clear the tables in one transaction (Concern 7) |
| `tests/conftest.py` | A fresh temporary database and a fixed "today" for each test |
| `tests/test_*.py` | See [Proof](#proof) |

### Frontend (`frontend/`)

| File | Purpose |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | Vite and React with TypeScript. Vite proxies `/api` to the backend. |
| `vitest.config.ts`, `src/test/setup.ts` | jsdom, Testing Library, and a ResizeObserver stub for Recharts |
| `src/main.tsx`, `src/App.tsx` | Router, query client and the `@fontsource` imports (R2) |
| `src/styles/tokens.css`, `src/styles/global.css` | The spec's color tokens, type scale, panels and shadows |
| `src/api/client.ts`, `src/api/queries.ts` | Fetch wrapper with error messages, and the TanStack Query hooks and mutations |
| `src/lib/format.ts` | Money (`$12,500`, `$1.2M`) and dates ("12 Nov 2026", "Today", "Yesterday") |
| `src/lib/deals.ts` | Stage list and colors, usual probabilities, late check, expected revenue, greeting by time of day, and organization initials |
| `src/components/` | `TopBar`, `Panel`, `Button`, `Badge`, `DataTable` (TanStack Table with search, sort and paging), `SidePanel`, `ConfirmDialog`, `EmptyState`, `Timeline`, `ActivityForm`, `Picker` (a select with "Add …") |
| `src/forms/` | `OrganizationForm`, `ContactForm` and `DealForm` (React Hook Form with Zod) |
| `src/pages/organizations/`, `contacts/`, `deals/` | List and detail pages (R40–R54) |
| `src/pages/pipeline/` | `PipelinePage`, `StageStrip`, `Board`, `Column`, `DealCard`, `ClosedRow` (dnd-kit) |
| `src/pages/dashboard/` | `DashboardPage`, `HeroPanel`, `RevenueChart`, `FunnelPanel`, `WonLostChart`, `StageDonut`, `FollowUps`, `RecentActivity` |
| `src/**/*.test.ts(x)` | See [Proof](#proof) |

### End to end (`e2e/`)

| File | Purpose |
|---|---|
| `e2e/fixtures.ts` | Resets the test database before each test (`seed --yes` or `clear --yes`), fails a test on any console error or failed request, and blocks requests to anywhere but localhost (R2, R7) |
| `e2e/*.spec.ts` | See [Proof](#proof) |

### Docs

| File | Purpose |
|---|---|
| `docs/STATUS.md` *(changed)* | How to run the app, and progress after each phase |
| `docs/plan.md` | This plan |

## Order of work

Each phase ends with `npm test` passing and `docs/STATUS.md` updated. Phases run in order, with one exception: phases 2 and 3 only touch the backend, so phase 4 can start alongside them once phase 1 is done, if two people (or sessions) are working.

### Phase 0: Skeleton and commands

1. Root `package.json` with the workspace and the five scripts, `pyproject.toml`, and `scripts/ensure-installed.mjs`.
2. An empty FastAPI app with `GET /api/health`, and a Vite React app that shows the top bar and an empty page.
3. Tokens, global styles and the bundled fonts.
4. Vitest, pytest and Playwright wired into `npm test`, with one smoke test each.
5. `docs/STATUS.md` explains how to install Node and uv, and how to run the app.

*Done when* a fresh clone runs `npm run dev` on Windows, Mac and Linux, prints `http://localhost:5173`, and shows the top bar, and `npm test` passes (R1, R2).

### Phase 1: Data model and business rules (backend)

1. Tables, constraints and indexes in `db.py`, with foreign keys on.
2. `rules.py`, with full unit tests before any endpoint uses it.
3. CRUD for organizations, contacts, deals and activities, with validation (R10–R13, R34, Concern 5).
4. Stage changes through `PATCH` and `/move`: probability, close date, customer status, stage-change rows and position (R15–R18, R63).
5. Deletes and delete-impact counts (R30–R35).
6. Timelines (R50–R54).

*Done when* every rule in R10–R35 has a passing pytest.

### Phase 2: Sample data, seed and clear (backend)

1. `seed.py`, generating data with dates relative to today and a stage history that fits each deal (R80–R84).
2. Seeding a new database when the app starts.
3. `npm run seed` and `npm run clear` with the question and `--yes`, both working while the app is running (R4).

*Done when* the seed tests pass and running both commands next to a running app on Windows works.

### Phase 3: Dashboard figures (backend)

1. `services/dashboard.py`: summary figures, 12-month series, funnel from stage history, open value by stage, follow-up groups and recent activity.
2. `GET /api/dashboard`.

*Done when* the figures match hand-worked values on a small fixed data set (criterion 6).

### Phase 4: Frontend foundations

1. Routing for the five sections and the record pages.
2. API client, query hooks and the error message pattern.
3. `format.ts` and `deals.ts` with their unit tests.
4. Shared components: `DataTable`, `SidePanel`, `ConfirmDialog`, `Badge`, `EmptyState`, `Timeline` and `Picker`.

*Done when* the component and library tests pass and every route shows its page title.

### Phase 5: Tables, record pages, forms and activities

1. Organizations, Contacts (with the status filter) and Deals tables (R40–R46).
2. Add and edit forms in the side panel, with inline "Add organization" and "Add contact" (R45). The deal form fills in the usual probability (R15).
3. Delete dialogs using the delete-impact counts (R30).
4. Organization, contact and deal pages with timelines and "Log activity" (R50–R54).

*Done when* the e2e tests for organizations, contacts, deals and activities pass.

### Phase 6: Pipeline

1. The six-column board with stage strip and totals (R60–R62).
2. Dragging between and within columns with optimistic totals, rollback on failure and keyboard support (R63, R64, R66).
3. "Add deal" in a column (R65), and Won/Lost "Show all".

*Done when* the pipeline e2e tests pass, including after a reload.

### Phase 7: Dashboard

1. Hero panel with greeting, summary and revenue line chart.
2. Funnel, won/lost bar chart and stage donut.
3. Follow-ups with mark done, and recent activity.
4. Empty states (R78).

*Done when* the dashboard e2e tests pass and the page matches mockup B's screenshot by eye.

### Phase 8: Hardening

1. A performance run with a generated 1,000 contacts, 500 deals and 5,000 activities (R6).
2. Empty-database run of every screen after `npm run clear` (criterion 2).
3. Checks at 1024px and 1280px (R5), and an offline check with the network blocked (R2).
4. Fix whatever these turn up.

### Phase 9: Walkthrough and sign-off

1. The coding agent uses the app end to end in a real browser as a salesperson would. That covers every section and action, each screen checked by eye against mockup B, with the console watched for errors. It fixes what it finds (criterion 9).
2. Someone new tries the criterion 8 questions on the sample data with no instructions.
3. The project owner uses it and has the final say, including on looks.
4. `docs/STATUS.md` says the MVP is done.

## Risks

| Risk | What could go wrong | How we handle it |
|---|---|---|
| **One command on Windows** | `predev` installing, `concurrently`, uv paths and Ctrl+C behave differently on Windows | `ensure-installed.mjs` uses only Node built-ins. Phase 0 isn't done until it's run on Windows. Each server is started through `npm`/`uv` with no shell-specific syntax. |
| **"Today" and time zones** | Close dates, late deals, "this month" and follow-up groups depend on the local date. Tests that run near midnight, or in another time zone, give different answers. | One clock in `config.py`, which the tests set. Dates are stored as local `YYYY-MM-DD` and times as local ISO strings. Vitest uses fake timers and Playwright uses `page.clock`. |
| **Drag and drop** | Dropping into an exact gap, saving position, and rolling back on failure are fiddly. Playwright drags can be flaky. | Position logic lives in `rules.py` with unit tests. The e2e drags use stepped mouse moves, with a keyboard-drag test as a second route. |
| **Funnel from stage history** | Wrong history in seed data gives a funnel that doesn't add up | `seed.py` builds history by walking each deal through its stages. A test checks that every deal's history starts with its creation and ends at its current stage. |
| **Required links vs cleared links** | R34 allows saving a record whose link was cleared by a delete, but a new record must have every link. The rule is easy to get wrong in `PATCH`. | `PATCH` only checks a link that is in the request. Tests cover a cleared organization or contact being kept, filled in, and refused when set to a mismatched contact (Concern 5). |
| **Deleting while linked** | `SET NULL` and `CASCADE` only work with foreign keys on, which SQLite leaves off by default | The pragma runs on every connection, and a test checks it's on. Delete tests check the rows directly. |
| **Seed or clear while the app runs** | On Windows, deleting an open database file fails | The tables are cleared inside a transaction, never by deleting the file. A test runs a clear while another connection is open. |
| **Performance** | Loading 5,000 activities or building timelines could be slow | Indexes on every foreign key and on `occurred_at`. Lists load in full but timelines are fetched per record. The phase 8 performance run measures each page. |
| **Offline** | A library or font fetched from a CDN breaks the app without internet | Only `@fontsource` packages and bundled icons. The e2e fixture blocks every non-localhost request and fails the test if one is made. |
| **Brand fidelity** | Screens drift from mockup B, or small Sea Green or Marigold text fails contrast | All colors come from tokens, and text uses the `-text` variants. The phase 7 and 9 checks compare against the mockup screenshots. |
| **Recharts in tests** | Recharts needs a measured size, so it renders nothing in jsdom | The setup stubs ResizeObserver. Chart contents are checked in e2e rather than in Vitest. |
| **Test data leaking** | Tests changing the real database | Tests always set `ACCOUNTABLE_DB` to a temporary or `e2e`-only file, and the test servers use their own ports. A test fails if that path equals the default. |
| **Scope creep** | Adding things not in the intent (global search, user names, filters on the board) | Anything not in the spec goes to `docs/STATUS.md` as a later idea, not into the build. |

## Proof

`npm test` runs all three suites and fails if any test fails. Each test name starts with the requirement it proves, for example `R16 moving to Won sets the close date to today`.

### Backend unit tests (pytest, `backend/tests/`)

| File | What it proves |
|---|---|
| `test_rules.py` | Usual probability for each stage (R14). Stage change resets probability, and a hand-set value survives edits that don't change stage (R15). Won and Lost set the close date to today (R16). Late is open and past due only (R19). Expected revenue and open pipeline (R20). Midpoint positions and renumbering when the gap is too small. |
| `test_db.py` | Foreign keys are on. An activity needs exactly one of contact and deal (R13). |
| `test_organizations.py` | Create, read, update and delete. A name is required (R10). List includes contact count, open deal count and open value (R44). |
| `test_contacts.py` | An organization is required on create (R11). Status defaults to lead. A cleared organization can stay blank on edit (R34). |
| `test_deals.py` | Every required field on create (R12). Value is a whole number of 0 or more, and probability is 0 to 100. The main contact must be from the deal's organization (Concern 5). A stage change through `PATCH` follows the same rules as `/move`. |
| `test_move.py` | Moving to another column changes stage, probability and position in one go (R63). Moving within a column keeps the stage and saves the new place. Moving to Won makes the contact a customer (R17). Moving back out of Won keeps the customer status and the close date (Concern 4). Each move adds a stage change row (R18). |
| `test_deletes.py` | Deleting an organization keeps its contacts and deals with no organization (R31). Deleting a contact keeps their deals with no contact, and removes their activities (R32). Deleting a deal removes its activities and stage changes (R33). Delete-impact counts match (R30). A won deal still counts on the dashboard after its organization and contact are gone (R35). |
| `test_activities.py` | Create, edit, delete and mark done (R53). "When it happened" defaults to now. |
| `test_timelines.py` | Deal timeline is its activities and stage changes, newest first. Contact timeline adds activity from deals where they're the main contact (R51, Concern 10). Organization timeline merges its contacts and deals (R50). Each entry says where it came from (R54). |
| `test_dashboard.py` | On a fixed data set: the four summary figures (R70), 12 months of revenue and won/lost counts (R71, R72), open value by stage (R73), funnel values and carry-over percentages from stage history (R74, Concern 3), the 10 latest entries (R75), and follow-up groups with the later count (R76, Concern 9). A deal won today counts this month (R77). An empty database gives zeros, not errors (R78). |
| `test_seed.py` | Counts and coverage (R80). Won and lost in each of the last 12 months, open deals over the next 3 months, and at least 4 late (R81). Follow-ups in every group (R82). Every deal's history fits its stage (R83). A new database is seeded on start, and an existing one isn't (R4). |
| `test_cli.py` | `seed` and `clear` refuse without "yes" and run with `--yes`. Clear empties every table. Both work while another connection is open (Concern 7). |

### Frontend unit tests (Vitest, next to the files they test)

| File | What it proves |
|---|---|
| `lib/format.test.ts` | `$12,500`, `$1.2M`, `$0`. Dates as "12 Nov 2026", "12 Nov 2026, 14:30", "Today" and "Yesterday". |
| `lib/deals.test.ts` | Usual probabilities, the late check against a fixed today, expected revenue, the greeting at the three times of day, and organization initials. |
| `components/DataTable.test.tsx` | Search matches any text column regardless of case (R40). Clicking a heading sorts and clicking again reverses (R41). 25 per page and the "Showing 1–25 of N" count (R43). The empty message (R46). |
| `components/ConfirmDialog.test.tsx` | Shows the record name and the linked-record counts. Nothing is deleted until confirmed (R30). |
| `components/Timeline.test.tsx` | Newest first, the right icon per type, stage changes worded as "Moved from X to Y", and the source label (R54). |
| `forms/DealForm.test.tsx` | Required fields show messages next to them (R45). Changing stage fills in its usual probability, which can then be overwritten (R15). The contact picker lists only the chosen organization's contacts (Concern 5). |
| `forms/ContactForm.test.tsx` | The organization is required, and "Add organization" opens inline. |
| `pages/contacts/ContactsPage.test.tsx` | The status filter shows counts and filters the rows (R44). |
| `pages/pipeline/Column.test.tsx` | Column totals and expected revenue. Won and Lost show 5 rows and "N more · Show all" (R60). |
| `pages/pipeline/DealCard.test.tsx` | The Late badge replaces the date for late deals. The meter width matches the probability (R62). |
| `pages/dashboard/FollowUps.test.tsx` | Overdue, Today and Next 7 days groups, the later count, and a ticked item leaving the list (R76). |

### End-to-end tests (Playwright with installed Chrome, `e2e/`)

Every test runs through `e2e/fixtures.ts`, so each one fails on a console error (R7) or on any request leaving localhost (R2).

| File | What it proves |
|---|---|
| `start.spec.ts` | Opening the app lands on the dashboard with sample data, and every section shows records (criterion 1, R4). |
| `organizations.spec.ts` | Add, find by search, sort, edit and delete an organization. The delete warning gives the right counts, and afterwards its contacts and deals show "None" (criterion 2, R30, R31, R34). |
| `contacts.spec.ts` | The same round for contacts, including the status filter and "Add organization" from inside the form (criteria 2 and 3, R45). |
| `deals.spec.ts` | The same round for deals. Late deals stand out in the table. The deal form fills in the stage probability (criteria 2 and 4, R15, R44). |
| `record-pages.spec.ts` | Each record page shows its links. The organization page shows the combined timeline (criterion 3, R50–R52). |
| `activities.spec.ts` | Log a note, a call and an email with a follow-up on a contact and on a deal. They show on the timeline newest first, the deal's entries show on the main contact's timeline, and the follow-up shows on the dashboard until marked done (criterion 5, R53, R76). |
| `pipeline.spec.ts` | Drag a card to another column, and its stage, probability and totals change at once. The deals table agrees. Drag within a column and between two cards, then reload, and the order holds. Add a deal in a column at that stage. A late card stands out. The keyboard drag works (criterion 4, R60–R66). |
| `won-deal.spec.ts` | Moving a deal to Won updates the dashboard's won-this-month figure and revenue chart, sets the close date to today, adds the stage change to the timeline and recent activity, and makes the contact a customer (criterion 6, R16–R18, R77). |
| `persistence.spec.ts` | Changes survive a reload, and survive a backend restart (criterion 2, R3). |
| `commands.spec.ts` | After `clear --yes`, every screen shows its empty state and still works. After `seed --yes`, the sample data is back (criterion 2, R4, R78). |
| `layout.spec.ts` | No horizontal scroll at 1024px and 1280px wide (R5). |

### Checks that aren't automated

- **Performance (phase 8):** with the large generated data set, each page shows within half a second and search keeps up with typing (R6).
- **Fresh clone on Windows, Mac and Linux:** `npm run dev` from nothing, then a second run with the network off (criterion 1, R1, R2).
- **Looks:** every screen compared by eye with mockup B and the brand rules (criterion 7).
- **First-time use:** someone new answers the criterion 8 questions within a couple of clicks of the dashboard.
- **Walkthrough and sign-off:** the full criterion 9 walkthrough by the coding agent, then the project owner's own review.
