# Spec: Testing and verification

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Test levels, the rules for tests, and the verification cases (V IDs). Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 13. Testing and verification strategy

### 13.1 Levels

| Level | Tool | Scope |
|---|---|---|
| Unit (backend) | pytest | `rules.py` and the services, against a temporary database |
| Integration (API) | pytest with FastAPI's TestClient | Every endpoint, error format, status code and rule, each test on a new temporary database |
| Unit and component (frontend) | Vitest and Testing Library | Formatting, deal logic, the data table, forms, dialogs and dashboard lists |
| End to end | Playwright with installed Chrome | Whole journeys against real servers on test ports with a test database |
| Security | pytest and Playwright | Section 10's negative cases |
| Performance | A generator script and Playwright timing | NFR-1 to NFR-3 at 2 × the target volume |
| Accessibility | Playwright keyboard-only runs, best effort | NFR-7 |
| Manual | People | Looks, first-time use, and the walkthrough |

### 13.2 Rules for tests

- `npm test` runs pytest, Vitest and Playwright, and fails if any test fails.
- Tests never use the real database. `ACCOUNTABLE_DB` must point at a temporary file, and a test fails if it's the default path.
- Time is fixed in tests: an injectable clock in the backend, fake timers in Vitest, and `page.clock` in Playwright. The end-to-end and performance runs fix the backend at the browser's time, 2026-11-21 14:30, through `ACCOUNTABLE_FIXED_NOW` (`scripts/run-tests.mjs`), so "today" agrees on any day.
- Every end-to-end test fails on a browser console error or on any request outside localhost (V-E00).
- Each test's name starts with the requirement it proves, for example `R16 moving to Won sets the close date to today`.
- Coverage of `rules.py` and `services/` is at least 90% of lines. `npm test -- --coverage` (part of `npm run check`) enforces it with `scripts/core-coverage.mjs`, which counts lines only.
- Unit test coverage is at least 80% of lines, statements, functions and branches, for the backend (pytest-cov, `backend/app/`) and the frontend (Vitest, every file in `frontend/src/` except tests and `main.tsx`). `npm run check` enforces it (`npm test -- --coverage`).

### 13.3 Verification cases

| ID | Case | Proves |
|---|---|---|
| V-B01 | `test_rules.py`: probabilities, the hand-set probability kept, Won/Lost close date, late, expected revenue, positions and renumbering | R14–R16, R19, R20, section 6.4 |
| V-B02 | `test_db.py`: foreign keys on, WAL and FULL set, the exactly-one-parent check | R13, section 6.3 |
| V-B03 | `test_organizations.py`: CRUD, field rules, list counts and open value | R10, R21, R44 |
| V-B04 | `test_contacts.py`: organization required on create, status default, cleared link kept on edit, field rules | R11, R21, R34 |
| V-B05 | `test_deals.py`: required fields, value and probability bounds, contact must match organization, `PATCH` stage change follows the rules, top of column | R12, R15, R21, R23, R67 |
| V-B06 | `test_move.py`: across and within columns, Won makes the contact a customer, reopening keeps status and date, stage change rows, 409 `stale_position`, repeated move | R15–R18, R24, R63, section 5.4 |
| V-B07 | `test_deletes.py`: R31–R33 checked on the rows themselves, delete-impact counts, won deals still counted, delete of a missing record | R30–R36 |
| V-B08 | `test_activities.py`: CRUD, mark done and undone, future dates allowed, exactly one parent | R13, R53, R55 |
| V-B09 | `test_timelines.py`: deal, contact and organization timelines, order and sources | R50, R51, R54 |
| V-B10 | `test_dashboard.py`: every figure on a fixed data set, funnel from history, follow-up groups, month boundary, empty database | R70–R79 |
| V-B11 | `test_seed.py`: counts, coverage, history fits, seeding only when new | R4, R80–R84 |
| V-B12 | `test_cli.py`: refuses without "yes", `--yes`, exit codes, works with another connection open | R4, section 5.6, REL-10 |
| V-B13 | `test_migrations.py`: upgrade from empty, and from the previous version with data, keeps the rows. A failed migration leaves the database unchanged. | DEP-4, REL-9 |
| V-B14 | `test_errors.py`: the error format and each status code in section 5.2 | Section 5.2 |
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
| V-F11 | `lib/theme.test.ts` and `components/ThemeToggle.test.tsx`: light by default, an invalid saved value means light, the toggle sets `data-theme` and saves the choice, `aria-pressed` and the icon follow the mode, and blocked storage still switches both ways with no error, both when its methods throw and when reading `window.localStorage` itself throws (site data blocked). `styles/tokens.test.ts`: the dark block is found (its checks fail rather than skip), every text token meets 4.5:1 on the surfaces it's used on in both modes, `--line` meets 3:1 on the panel, raised surface and page in dark mode, and no color is written anywhere in `frontend/src` except `tokens.css`. | R90–R93, NFR-7, ENG-1 |
| V-E00 | `e2e/fixtures.ts`, in every test: no console errors and no request outside localhost | R2, R7 |
| V-E01 | `start.spec.ts`: lands on the dashboard with sample data on every screen | AC1, R4 |
| V-E02 | `organizations.spec.ts`: add, search, sort, edit, delete with counts, links show "None" | AC2, R30, R31, R34 |
| V-E03 | `contacts.spec.ts`: the same round, status filter, inline organization | AC2, AC3, R45 |
| V-E04 | `deals.spec.ts`: the same round, late deals stand out, probability prefill | AC2, AC4 |
| V-E05 | `record-pages.spec.ts`: links on each page, the organization's combined timeline, missing record | AC3, R50–R52, R56 |
| V-E06 | `pipeline.spec.ts`: drag across and within columns, reload, add in a column, late cards, keyboard drag, rollback when the API fails (mocked) | AC4, R60–R67 |
| V-E07 | `won-deal.spec.ts`: dashboard figures, close date, timeline, recent activity, contact becomes customer | AC6, R16–R18, R77 |
| V-E08 | `activities.spec.ts`: log each type with a follow-up, on the deal's and contact's timelines, on the dashboard until done | AC5, R53, R76 |
| V-E09 | `commands.spec.ts`: after `clear --yes`, every screen is empty but works. After `seed --yes`, the sample data is back. | AC2, R4, R78 |
| V-E10 | `persistence.spec.ts`: survives a reload, and survives a backend restart | AC2, R3 |
| V-E11 | `keyboard.spec.ts`: add, edit, delete and drag with the keyboard only, focus always visible; and secondary buttons show the focus ring in both modes. Focus counts as visible only with an outline, the `--focus-ring` color itself, a highlighted menu item, or Chrome's own outline on a date field's calendar button; an ordinary shadow doesn't count. | NFR-7, R66 |
| V-E12 | `layout.spec.ts`: no horizontal scroll at 1024px and 1280px | R5 |
| V-E13 | `theme.spec.ts`: starts in light mode with the light tokens; the toggle is on every section and a record page; switching to dark changes the page, panel and raised colors on the dashboard (with a chart tooltip), the pipeline, a table, its row menu, a delete dialog, the Add deal side panel and a record page; a search box and the Log activity form keep what's typed; the choice survives a reload, is already on `<html>` when `<body>` first exists, and switching back is remembered too; Tab reaches the toggle, its focus ring shows in both modes, and Space and Enter switch it; with reading `localStorage` blocked, the app starts light and the toggle switches both ways with no console error; chart tooltip items are in `--ink` in both modes; the toggle's icon is 18px square inside its 36px button; and the scroll position is kept when the mode changes | R90–R95, NFR-7 |
| V-S01–V-S10 | `test_security.py` and `security.spec.ts`: each negative case in section 10, plus a check that nothing listens on anything but `127.0.0.1` | SEC-1–SEC-8 |
| V-P01 | `e2e/perf/` plus a data generator: page, API and search timings at 2 × volume | R6, NFR-1–NFR-3, NFR-13 |
| V-M01 | The coding agent's end-to-end walkthrough, every screen by eye, then the product owner's review | AC9 |
| V-M02 | A fresh clone on Windows, macOS and Linux: first run, then a second run with the network off | AC1, R1, R2, NFR-6 |
| V-M03 | Crash test: kill the backend process (`kill -9`, or Task Manager) straight after a save, restart, and check the change | AC8, REL-1 |
| V-M04 | Every screen compared by eye with mockup 1 and the brand rules, in light mode and in dark mode. Light mode is also compared with screenshots taken before dark mode (`e2e/visual/dark-mode.spec.ts`: six screens at 1440px, pixel for pixel), to confirm nothing changed but the toggle and the approved fixes in R94; the top bar at 1024px and 1280px, and the screens those six don't cover, are checked by eye. The approved dashboard and pipeline screenshots in `docs/changes/mvp-darkmode/` are replaced only when `ACCOUNTABLE_SCREENSHOTS=1` is set. | SC5, NFR-9, R94, R95 |
| V-M05 | Someone new answers the SC1 questions with no instructions | SC1, NFR-8 |
| V-M06 | Two weeks of real use, with the product owner checking SC2–SC4 | SC2–SC4 |
