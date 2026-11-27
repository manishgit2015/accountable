# Spec: Testing and verification

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Test levels, the rules for tests, and the verification cases (V IDs). Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 13. Testing and verification strategy

### 13.1 Levels

| Level | Tool | Scope |
|---|---|---|
| Unit (backend) | pytest | `rules.py` and the services, against a temporary database |
| Integration (API) | pytest with FastAPI's TestClient | Every endpoint, error format, status code and rule, each test on a new temporary database |
| Unit and component (frontend) | Vitest and Testing Library | Formatting, deal logic, the data table, forms, dialogs and dashboard lists |
| End to end | Playwright with installed Chrome | Whole journeys against real servers on test ports with a test database, signed in with test tokens (SEC-17) |
| Security | pytest and Playwright | Section 10's negative cases |
| Performance | A generator script and Playwright timing | NFR-1 to NFR-3 at 2 × the target volume |
| Accessibility | Playwright keyboard-only runs, best effort | NFR-7 |
| Manual | People | Looks, first-time use, and the walkthrough |
| Hosted, by hand | People | The built app against Supabase, and Postgres's answers matching SQLite's (V-M07, V-M08) |

### 13.2 Rules for tests

- `npm test` runs pytest, Vitest and Playwright, and fails if any test fails.
- Tests never use the real database. `ACCOUNTABLE_DB` must point at a temporary file, and a test fails if it's the default path.
- Tests never use Supabase or the network, with or without the Supabase settings in `.env` (AC15). Every test path goes through `scripts/run-tests.mjs` (`npm test`, `npm run check`, `npm run check:quick` and so the Stop hook, `npm run test:perf`, the visual suite). It refuses to start when `DATABASE_URL` is set in its environment or `ACCOUNTABLE_TEST_DB` is an address rather than a file, drops `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and sets `ACCOUNTABLE_TEST_AUTH_KEYS` to a key made for that run. In that test mode the backend never reads `.env` and refuses `DATABASE_URL` too, `playwright.config.ts` refuses to start servers without test mode or with `DATABASE_URL`, and `backend/tests/conftest.py` refuses `DATABASE_URL` and runs in test mode even under a bare `uv run pytest` (ADR-027). The test runs and sign in with tokens signed by it (SEC-17, ADR-025). The end-to-end tests and ui-check sign in as test people, never with anyone's real password. CI needs no secrets.
- Every unit test runs in under 1 second on this computer (NFR-15). The backend and frontend runs fail any unit test that takes longer (V-U01).
- Time is fixed in tests: an injectable clock in the backend, fake timers in Vitest, and `page.clock` in Playwright. The end-to-end and performance runs fix the backend at the browser's time, 2026-11-21 14:30, through `ACCOUNTABLE_FIXED_NOW` (`scripts/run-tests.mjs`), so "today" agrees on any day.
- Every end-to-end test fails on a browser console error or on any request outside localhost (V-E00).
- Each test's name starts with the requirement it proves, for example `R16 moving to Won sets the close date to today`.
- Coverage of `rules.py` and `services/` is at least 90% of lines. `npm test -- --coverage` (part of `npm run check`) enforces it with `scripts/core-coverage.mjs`, which counts lines only.
- Unit test coverage is at least 80% of lines, statements, functions and branches, for the backend (pytest-cov, `backend/app/`) and the frontend (Vitest, every file in `frontend/src/` except tests and `main.tsx`). `npm run check` enforces it (`npm test -- --coverage`).

### 13.3 Verification cases

| ID | Case | Proves |
|---|---|---|
| V-B01 | `test_rules.py`: probabilities, the hand-set probability kept, Won/Lost close date, late, expected revenue, positions and renumbering | R14–R16, R19, R20, section 6.4 |
| V-B02 | `test_db.py`: foreign keys on, WAL and FULL set on SQLite, the exactly-one-parent check, and the Postgres engine's settings (pooler, TLS, pool size, timeouts) built from a `DATABASE_URL` without connecting | R13, section 6.3 |
| V-B03 | `test_organizations.py`: CRUD, field rules, list counts and open value | R10, R21, R44 |
| V-B04 | `test_contacts.py`: organization required on create, status default, cleared link kept on edit, field rules | R11, R21, R34 |
| V-B05 | `test_deals.py`: required fields, value and probability bounds, contact must match organization, `PATCH` stage change follows the rules, top of column | R12, R15, R21, R23, R67 |
| V-B06 | `test_move.py`: across and within columns, Won makes the contact a customer, reopening keeps status and date, stage change rows, 409 `stale_position`, repeated move | R15–R18, R24, R63, section 5.4 |
| V-B07 | `test_deletes.py`: R31–R33 checked on the rows themselves, delete-impact counts, won deals still counted, delete of a missing record | R30–R36 |
| V-B08 | `test_activities.py`: CRUD, mark done and undone, future dates allowed, exactly one parent | R13, R53, R55 |
| V-B09 | `test_timelines.py`: deal, contact and organization timelines, order and sources | R50, R51, R54 |
| V-B10 | `test_dashboard.py`: every figure on a fixed data set, funnel from history, follow-up groups, month boundary, empty database | R70–R79 |
| V-B11 | `test_seed.py`: counts, coverage, history fits, seeding only when new | R4, R80–R84 |
| V-B12 | `test_cli.py`: refuses without "yes", `--yes`, exit codes, works with another connection open, and refuses before asking, changing nothing, when `DATABASE_URL` is set | R4, section 5.6, REL-10 |
| V-B13 | `test_migrations.py`: upgrade from empty, and from the previous version with data, keeps the rows. A failed migration leaves the database unchanged. | DEP-4, REL-9 |
| V-B14 | `test_errors.py`: the error format and each status code in section 5.2, including 401 and 503 `database_unavailable` | Section 5.2, REL-13 |
| V-B15 | `test_auth.py`: every route but health refuses a missing, malformed, expired, wrongly signed or other-project token with 401; health needs none; the person comes from the token's claims; signing keys are cached and fetched again for an unknown key; test sign-in exists only in test mode; start-up refuses test mode with `DATABASE_URL` | R101, R102, R105, SEC-13, SEC-14, SEC-17 |
| V-B16 | `test_attribution.py`: each create sets `created_by` and `updated_by`, each update `updated_by`, from the token; a body with either is refused; the `users` row is added and updated; sample data has none; a removed person still has their name | R110–R114, section 6.5 |
| V-B18 | `test_database_choice.py`: outside test mode `DATABASE_URL` comes from `.env` and the environment wins; test mode never reads `.env` and refuses `DATABASE_URL` and the real SQLite file; a real start without `DATABASE_URL` stops; the Postgres engine (pg8000, pool, timeouts, `lock_timeout`, TLS without a certificate check) is built without connecting; the host is logged without user or password; an unreachable database is 503 `database_unavailable`; a first start never deletes; seed, clear and perfdata refuse | ADR-027, ADR-028, REL-9, REL-13, R4, E-8 |
| V-B19 | `test_dashboard.py`: the monthly figures' query, compiled for Postgres, groups by exactly the expression it selects, since Postgres refuses a grouped expression with its own bound values (error 42803) | R71, R72, R125 |
| V-B17 | `test_search.py`: part of a name in any case, for each kind; R122's order; 5 items with the full total; `%` and `_` as plain characters; under 2 or over 200 characters refused | R121, R122, R125 |
| V-F01 | `lib/format.test.ts`: money and dates | Section 3.9 Writing |
| V-F02 | `lib/deals.test.ts`: late check, expected revenue, greeting times, initials | R19, R20, R79 |
| V-F03 | `components/DataTable.test.tsx`: search, sort, 25 per page, count, empty and no-match messages | R40, R41, R43, R46, R47 |
| V-F04 | `components/ConfirmDialog.test.tsx`: name and counts, nothing deleted until confirmed | R30 |
| V-F05 | `forms/DealForm.test.tsx`: field messages, probability prefill and override, contact list filtered by organization, server errors shown | R15, R23, R45, R48 |
| V-F06 | `forms/ContactForm.test.tsx`: organization required, inline "Add organization" | R11, R45 |
| V-F07 | `pages/pipeline/Column.test.tsx`: totals, Won/Lost showing 5 and "Show all", and only this month's closed deals, with a deal closed last month absent | R60 |
| V-F08 | `pages/pipeline/DealCard.test.tsx`: Late badge, meter width | R62 |
| V-F09 | `pages/dashboard/FollowUps.test.tsx`: groups, later count, ticking removes | R76 |
| V-F10 | `components/ErrorBoundary.test.tsx` and the API client: fallback screen, timeout message, request ID shown | REL-4, REL-12, OBS-3 |
| V-F11 | `lib/theme.test.ts` and `components/UserMenu.test.tsx`: light by default, an invalid saved value means light, each of Light, Dark and System sets `data-theme` and saves the choice, System follows a faked `prefers-color-scheme` and its change, the selected choice is marked, and blocked storage still switches every way with no error, both when its methods throw and when reading `window.localStorage` itself throws (site data blocked). `styles/tokens.test.ts`: the dark block is found (its checks fail rather than skip), every text token meets 4.5:1 on the surfaces it's used on in both modes, `--line` meets 3:1 on the panel, raised surface and page in dark mode, and no color is written anywhere in `frontend/src` except `tokens.css`. | R90–R93, NFR-7, ENG-1 |
| V-F12 | `pages/SignIn.test.tsx` and `components/UserMenu.test.tsx`: the form, the wrong-details and can't-reach messages, the email kept and password cleared, no sign-up or reset link; the menu's name, email and initials (name, else email), keyboard use and sign out | R100, R103–R107, R109 |
| V-F13 | `components/GlobalSearch.test.tsx`: nothing under 2 characters, one request after the pause, groups and totals, keyboard highlight and Enter, Escape twice, no-match, searching and failure messages | R120–R124 |
| V-U01 | The backend and frontend test runs: any unit test over 1 second fails the run, checked with a probe test that sleeps | NFR-15 |
| V-E00 | `e2e/fixtures.ts`, in every test: no console errors and no request outside localhost, so none to Supabase | R2, R7, AC15 |
| V-E01 | `start.spec.ts`: signs in as a test person and lands on the dashboard with sample data on every screen | AC1, R4 |
| V-E02 | `organizations.spec.ts`: add, search, sort, edit, delete with counts, links show "None" | AC2, R30, R31, R34 |
| V-E03 | `contacts.spec.ts`: the same round, status filter, inline organization | AC2, AC3, R45 |
| V-E04 | `deals.spec.ts`: the same round, late deals stand out, probability prefill | AC2, AC4 |
| V-E05 | `record-pages.spec.ts`: links on each page, the organization's combined timeline, missing record | AC3, R50–R52, R56 |
| V-E06 | `pipeline.spec.ts`: drag across and within columns, reload, add in a column, late cards, keyboard drag, rollback when the API fails (mocked) | AC4, R60–R67 |
| V-E07 | `won-deal.spec.ts`: dashboard figures, close date, timeline, recent activity, contact becomes customer | AC6, R16–R18, R77 |
| V-E08 | `activities.spec.ts`: log each type with a follow-up, on the deal's and contact's timelines, on the dashboard until done | AC5, R53, R76 |
| V-E09 | `commands.spec.ts`: after `clear --yes`, every screen is empty but works. After `seed --yes`, the sample data is back. | AC2, R4, R78 |
| V-E10 | `persistence.spec.ts`: survives a reload, and survives a backend restart | AC2, R3 |
| V-E11 | `keyboard.spec.ts`: add, edit, delete and drag with the keyboard only, sign in, use the user menu and the top-bar search, focus always visible; and secondary buttons show the focus ring in both modes. Focus counts as visible only with an outline, the `--focus-ring` color itself, a highlighted menu item, or Chrome's own outline on a date field's calendar button; an ordinary shadow doesn't count. | NFR-7, R66 |
| V-E12 | `layout.spec.ts`: no horizontal scroll at 1024px and 1280px, with the search box and the user menu in the top bar, and the search box 240px wide at 1280px and 180px below | R5, section 3.9 |
| V-E13 | `theme.spec.ts`: starts in light mode with the light tokens; the user menu, with Light, Dark and System, is on every section and a record page; System follows an emulated dark or light `prefers-color-scheme`, and its change, with no reload; switching to dark changes the page, panel and raised colors on the dashboard (with a chart tooltip), the pipeline, a table, its row menu, a delete dialog, the Add deal side panel and a record page; a search box and the Log activity form keep what's typed; the choice survives a reload, is already on `<html>` when `<body>` first exists, and switching back is remembered too; Tab reaches the menu button, its focus ring shows in both modes, and the keyboard opens the menu and chooses each theme; with reading `localStorage` blocked, the app starts light and the theme choice switches every way with no console error; chart tooltip items are in `--ink` in both modes; the menu button is 36px round; and the scroll position is kept when the mode changes | R90–R96, NFR-7, AC13 |
| V-E14 | `auth.spec.ts`: signed out, every section and a record page show the sign-in screen and the API answers 401; wrong details show R103's message; signing in lands on the page asked for; signing out shows the sign-in screen; an ended session shows "Your session has ended" and returns to the page | AC10, R100–R103, R107, R108 |
| V-E15 | `attribution.spec.ts`: two test people; one adds a deal and logs an activity, the other edits the deal; the deal page shows both names, the timeline the first, and a sample record "Sample data" | AC11, R111–R113 |
| V-E16 | `search.spec.ts`: finds an organization, a contact and a deal by part of a name in another case, opens each with the mouse and with the keyboard, `/` focuses the box, and no matches | AC12, R120–R124 |
| V-S01–V-S10 | `test_security.py` and `security.spec.ts`: each negative case in section 10, plus a check that nothing listens on anything but `127.0.0.1` | SEC-1–SEC-8 |
| V-S11–V-S15 | `test_security.py`: the sign-in negative cases in section 10 (no token, expired, other key, other project, edited payload, body and header attempts, test token without test mode), and Host and Origin with `ACCOUNTABLE_PUBLIC_URL` set | SEC-2, SEC-3, SEC-13, SEC-14, SEC-17 |
| V-S16 | `scripts/check-bundle.mjs`, run by `npm run check` after a build: no `DATABASE_URL`, `sb_secret_` or `service_role` in the built frontend | SEC-15 |
| V-P01 | `e2e/perf/` plus a data generator: page, API and search timings at 2 × volume | R6, NFR-1–NFR-3, NFR-13 |
| V-M01 | The coding agent's end-to-end walkthrough, every screen by eye, then the product owner's review | AC9 |
| V-M02 | A fresh clone on Windows, macOS and Linux: first run, signing in against Supabase, then `npm run check` with the network off | AC1, R1, R2, NFR-6, AC15 |
| V-M03 | Crash test: kill the backend process (`kill -9`, or Task Manager) straight after a save, restart, and check the change | AC8, REL-1 |
| V-M04 | Every screen compared by eye with mockup 1 and the brand rules, in light mode and in dark mode, including the sign-in screen, the user menu and the search results, which mockup 1 doesn't show. Light mode is also compared with screenshots taken before dark mode (`e2e/visual/dark-mode.spec.ts`: six screens at 1440px, pixel for pixel), to confirm nothing changed but the top bar (the search box and the user menu where the toggle was) and the approved fixes in R94; the top bar at 1024px and 1280px, and the screens those six don't cover, are checked by eye. The approved dashboard and pipeline screenshots in `docs/changes/mvp-darkmode/` are replaced only when `ACCOUNTABLE_SCREENSHOTS=1` is set. | SC5, NFR-9, R94, R95 |
| V-M05 | Someone new answers the SC1 questions with no instructions | SC1, NFR-8 |
| V-M06 | Two weeks of real use, with the product owner checking SC2–SC4 | SC2–SC4 |
| V-M07 | `npm run build` and `npm run start` on this computer against the team's Supabase, then the deployed onrender.com address: sign in as a real person, use every section, search, check who added a record, sign out, and note how long the first load after a sleep takes | AC14, DEP-8, DEP-9, REL-14 |
| V-M08 | Against Postgres on Supabase, by hand before release: the migrations from empty, and the V-E16 searches and V-E15 names giving the same results as on SQLite | R125, DEP-4, AC12 |
