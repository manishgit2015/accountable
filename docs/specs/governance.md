# Spec: Assumptions, risks, decisions and governance

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Assumptions, risks, decisions (ADR, E and D IDs), resolved ambiguities, open questions, changing the spec, known gaps and ownership. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 16. Assumptions, risks and decisions

### 16.1 Assumptions

| ID | Assumption | If it's wrong |
|---|---|---|
| A-1 | Retired by the change `mvp-multiuser`: everyone now signs in (section 3.11). It was "Only the salesperson uses the computer, so no sign-in is needed". | (none) |
| A-2 | No privacy or regulatory rule applies to a small team's sales data held on Supabase and served from Render | Rules such as GDPR could require deleting or exporting a person's data on request, an agreement with Supabase and Render, or data kept in a particular region |
| A-3 | The team's data is only on Supabase (ADR-027), and Supabase's backups are enough. A local SQLite file holds only sample or test data, so it isn't backed up. | A bad change to the team's data, or a lost Supabase project, loses data. The free plan's backups are limited (section 16.2). |
| A-4 | Node 24+ and uv can be installed by the user, following the documentation | A non-technical user may need help with setup |
| A-5 | The target platforms and browsers in NFR-6 and NFR-12 | More testing would be needed |
| A-6 | The test machine for performance is a typical recent laptop | The thresholds may need adjusting |
| A-7 | The team doesn't need roles or permissions yet | Anyone signed in can change or delete anything. Roles would be needed. |
| A-8 | The problem's impacts are as described in section 1.2 | The success measures may target the wrong thing |
| A-9 | Everyone on the team works in one time zone, the one set in `TZ` on Render | "Today", late deals, follow-up groups and month figures are a day out for someone elsewhere |
| A-10 | The team is small, up to 10 people signed in at once (NFR-14) | The pool size, last write wins and Render's free plan would need revisiting |
| A-11 | Supabase encrypts the hosted data at rest, and Render and Supabase keep it to the regions chosen for them | SEC-10 and A-2 would need another answer |

### 16.2 Risks

Each change's delivery risks are in its plan. These are the product's architectural and product risks:

| Risk | Handling |
|---|---|
| Local time: on Render, "today" is the day in `TZ`, so someone in another time zone sees the team's day | ADR-013, ADR-026 and A-9. Moving to UTC would need a migration that converts stored times. |
| Last write wins can lose one person's change when two people edit the same record at once | ADR-003, kept for a small team by the change `mvp-multiuser` *[Assumption: the product owner accepts it]*. Version checks would fix it. |
| Forward-only migrations make data rollback depend on a copy | DEP-6 and the runbook. The hosted data depends on Supabase's backups, which are limited on the free plan. |
| Render's free plan sleeps after 15 minutes, so the first load can take about a minute | REL-14. A paid plan doesn't sleep. |
| The backend doesn't check Supabase's certificate (ADR-028), so someone who can intercept the network (a rogue Wi-Fi, hijacked DNS) could pose as the database and receive the password and the data | Accepted by the engineer, 27 Nov 2026. The connection is still encrypted against passive listening. Verifying against Supabase's CA certificate would remove the risk. |
| Supabase pauses a free project after a week without use | The runbook says how to restore it. Daily use keeps it awake. |
| There's no staging database, and every start but a test uses `DATABASE_URL` (ADR-027), so development always works on the team's data | DEP-1. The test paths refuse `DATABASE_URL` (ADR-027). `npm run seed` and `npm run clear` refuse there (R4). A second Supabase project for development would remove the risk. |
| The test sign-in key could be trusted outside the tests | SEC-17: only the test runs set it, start-up refuses it with `DATABASE_URL`, and V-B15 and V-S15 check both |
| Postgres and SQLite can answer differently (case, accents, `LIKE`), and the automated tests run only on SQLite | R125 and ENG-4, with V-M08 by hand on Postgres before release. A local Postgres in the test runs would catch it automatically. |
| Requiring an organization for every contact, including leads, adds a step for individual buyers | Accepted by the product owner |
| There are no baselines for the business outcomes | SC2–SC4 are judged against their targets, not against an improvement on before |
| "Visually stunning" and "a pleasure to use" are judgement calls | The product owner reviews the look (V-M04, SC5), against the mockups |

### 16.3 Decisions

Architecture decisions (ADR) and engineering decisions (E) that shape the product today.

| ID | Decision | Notes |
|---|---|---|
| ADR-001 | The stack is as set by `docs/TECH_STACK.md` | A constraint on the product |
| ADR-002 | On this computer, the servers listen on `127.0.0.1` only. On Render, the one service listens on `0.0.0.0` behind Render's HTTPS. Host and Origin checks in both (SEC-1–SEC-3). | Changed by `mvp-multiuser`, which added hosting |
| ADR-003 | Last write wins on concurrent edits | Kept by `mvp-multiuser` for a small team (section 16.2) |
| ADR-004 | Alembic versioned migrations, run on start-up | Adds Alembic alongside SQLAlchemy Core, because real data must survive future versions |
| ADR-005 | No personal data in logs. Logs go to the terminal and a rotating local file. | |
| ADR-006 | Stage changes are a separate, read-only table | |
| ADR-007 | Lists load in full, and search, sort and paging happen in the browser | Simple and fast at 1,000 rows. It would need server paging at about 10 × the volume. |
| ADR-008 | Fractional positions with renumbering | One row changes per drop. The alternative, renumbering the whole column every time, is simpler but writes more. |
| ADR-009 | An unversioned `/api` | The frontend is the only client. A breaking change for other clients would be `/api/v2`. |
| ADR-010 | The development servers are the runtime for development | It's what `TECH_STACK.md` sets. Since `mvp-multiuser`, users reach the hosted app instead (ADR-021). |
| ADR-011 | Stage colors, contrast rules, funnel from stage history, the contact must match the organization, reopening keeps the date, follow-up groups, timelines follow the current contact | |
| ADR-012 | Mockup 1 (`docs/mockups/1-spec-reference/`) is the visual reference | It follows the layout set earlier by mockup B, which was removed |
| ADR-013 | Times are stored and compared in the app's local time: the computer's, or on Render the time zone in `TZ` (ADR-026) | Matches "today" as the team sees it. The alternative, UTC plus each person's time zone, suits a team spread over time zones (A-9). |
| ADR-014 | No metrics, tracing or alerting | A small team's app with no one on call. Render shows whether the service is up. |
| ADR-015 | The `closed_at` column drives the month figures | See C-3 |
| ADR-016 | Duplicate names are allowed | See R22 |
| ADR-017 | Small text with a white color uses darker fills: badges stay at 12px, and their Cerulean and Raspberry fills become the darker `#0E7194` and `#D12E57` (now `--cerulean-strong` and `--raspberry-strong`, ADR-019) | Resolves a contradiction between the badge style and the contrast rule in 3.9 |
| ADR-018 | The light, dark or system choice is kept in the browser's `localStorage`, not in the database. Since `mvp-multiuser`, it's per browser rather than per person. | No backend, API or migration change, and it can be applied before the first paint. The alternative, a settings row with an API, would follow the app across browsers, but adds a migration, an endpoint and a request before the page can be colored. Approved 25 Nov 2026 (`docs/changes/mvp-darkmode/intent.md`). |
| ADR-019 | The dark palette is derived from the brand: page `#04232E`, black panels, Sea Mist ink, lighter `-text` colors, and unchanged fills. Tokens used as fills, or for text on fills, are separate from text tokens and don't change with the mode (`--midnight`, `--cerulean-strong`, `--raspberry-strong`). | A `-text` token can't be both a text color that lightens in dark mode and a fill under white text, and `--ink` can't be both main text and Midnight on fills. Splitting them keeps one tokens file and no per-component overrides. Approved by the product owner on 26 Nov 2026, from the screenshots in `docs/changes/mvp-darkmode/` (V-M04). Two later fixes from the independent reviews, the dark `--line` (`#527280` to `#62828E`, REV-003) and the toggle's icon at its full 18px (REV-008), were approved by the product owner the same day from the retaken screenshots. |
| ADR-020 | The data is in Postgres on Supabase, through SQLAlchemy Core, with the same table definitions and migrations as SQLite, which the tests keep using (local development uses Supabase too, ADR-027) | Set by the change's intent. Keeping database access behind `db.py` and the services contained the move. The alternative, Supabase's own client library from the browser, would put the data rules in the frontend and need row-level security. |
| ADR-021 | The hosted app is one Render web service: FastAPI serves the built frontend and the API from one process | Set by the change's intent. One origin, so no CORS, and the Host and Origin checks still hold. The alternative, a separate static site, would add CORS and a second service. |
| ADR-022 | A `users` table keeps each person's ID, email and name from their token, and records point to it | Records show a name without asking Supabase on each request, and keep it after the person is removed (R114). The alternative, storing the name on each record, would show an old name after it changes. |
| ADR-023 | The backend checks each token itself against Supabase's public signing keys, cached for up to 10 minutes (SEC-13) | No call to Supabase per request. The alternative, asking Supabase Auth to check each token, is simpler but adds a network call to every request. It needs a JWT library, which the change's plan justifies (ENG-5). |
| ADR-024 | The top-bar search runs on the server, over every organization, contact and deal, case-insensitively in a way that's the same on SQLite and Postgres (R121, R125) | It covers records not loaded on the page. ADR-007's browser-side search stays for each table. |
| ADR-025 | The tests and ui-check sign in with tokens signed by a key made for each test run, trusted only when `ACCOUNTABLE_TEST_AUTH_KEYS` is set (SEC-17) | The tests exercise the same token check as real use, need no Supabase, no network and no secrets, and use nobody's real password (AC15). The alternative, skipping the check in tests, would leave the check itself untested end to end. |
| ADR-027 | Every start that isn't a test uses Postgres on Supabase from `DATABASE_URL`, with no fallback to the SQLite file. Test mode (`ACCOUNTABLE_TEST_AUTH_KEYS`) uses only a temporary SQLite file: it never reads `.env` and refuses `DATABASE_URL`, and the test runner, Playwright's config and pytest refuse it as well | The engineer's decision, 27 Nov 2026 (`docs/changes/mvp-multiuser/intent.md`). Real use always works on the team's data, and no test path can reach it, with several locks rather than one. The alternative, falling back to the local file, would let someone work on data the team can't see |
| ADR-028 | TLS to Postgres encrypts the connection but doesn't check the server's certificate, like libpq's `sslmode=require`, so no CA file is needed. The database password in `DATABASE_URL` is what protects the data | The engineer's decision, 27 Nov 2026, replacing an earlier choice to verify against Supabase's CA. The traffic and the password are encrypted, but a man in the middle wouldn't be detected (section 16.2). The alternative, verifying against Supabase's CA certificate, would detect one but needs the CA file in the repository |
| ADR-026 | On Render, the app's local time is the team's time zone, set with `TZ` | Keeps ADR-013 for a team in one time zone (A-9) without a migration of stored times |
| E-1 | The `PRAGMA` statements in `db.py` are the only text SQL: the connection settings, and on SQLite the foreign key switch and check around migrations (DEP-4) | SQLite's settings in section 6.3 can only be set that way. Postgres's settings go in its connection options, not text SQL. A test checks it's the only text SQL (V-B02). |
| E-2 | Uvicorn runs without reload by default, and `ACCOUNTABLE_RELOAD=1` turns reload on for development | One command, `npm run dev`, serves both users and developers |
| E-3 | NFR-1 is measured as in-app navigation after the first load; the cold first load is recorded without a threshold | Under ADR-010 the first load compiles modules on demand |
| E-4 | V-S10 is automated as "the servers are bound to 127.0.0.1", by inspecting the listening sockets; the LAN address is checked by hand in V-M02 | The LAN address isn't stable in automated runs |
| E-5 | Evidence for each task is recorded in `docs/build_logs.log` | `docs/STATUS.md` still gets a short line per finished piece of work |
| E-6 | `npm run seed` and `npm run clear` work only on a local SQLite database, and refuse when `DATABASE_URL` is set (R4) | The engineer's decision in `docs/changes/mvp-multiuser/intent.md`, so nobody can replace or wipe the team's data from the command line |
| E-9 | The Postgres driver is pg8000, and `.env` is read with python-dotenv (ENG-5) | pg8000 is pure Python, so Windows Application Control has no DLL to block. The engineer's decision, 27 Nov 2026 |
| E-7 | The test runs fail any unit test that takes over 1 second (NFR-15) | CI runs on a much slower machine. Set by the change's intent. |
| E-8 | Once data is loaded into Supabase, its records aren't deleted: no clear, reseed, emptied or truncated table, or migration that deletes rows, whether by command, script, agent or by hand in Supabase's dashboard. The sample data stays. | The engineer's decision, 26 Nov 2026. Deleting one record in the app, with its warning (R30–R36), is still how a person removes a record, as the engineer confirmed the same day. |
| D-2 | A dashboard follow-up item is the activity's fields plus `source` `{kind, id, name}`; a recent item is the timeline entry shape | Section 5.5 |
| D-3 | A deal created directly at Won or Lost gets `closed_at` set to its creation time, and its contact's status doesn't change | Section 4.2, "Created at a stage" |

### 16.4 Resolved ambiguities

| ID | Question | Options and trade-offs | Chosen |
|---|---|---|---|
| C-1 | What time window does the funnel's "value reaching each stage" use? | (a) **All time:** simple, but old deals weigh on it more and more. (b) **Deals created in the last 12 months:** matches the other charts, but a deal created 13 months ago and won last month drops out. (c) **Deals that were open at some point in the last 12 months:** most accurate, but harder to explain. | (b) |
| C-2 | Won and Lost columns would grow forever | (a) **Last 12 months**, latest 5 with "Show all". (b) **This month only:** the board stays short, but it hides recent wins. (c) **Everything:** a column hundreds of cards long. | (b) |
| C-3 | Which date puts a won deal in a month: when it was moved, or its editable close date? | (a) **`closed_at`** (when moved): stable, and matches "counts in the month it was won" (AC6). But editing the close date doesn't move it. (b) **`close_date`:** the user can correct the month, but a typo moves revenue between months. | (a) |
| C-4 | How quick is "quick"? | Thresholds in NFR-1–NFR-3 | As written there |
| C-5 | What are the field limits? | Limits in R21 | As written there |
| C-6 | How is a person shown, when Supabase may have only their email? | (a) **Display name, else email**, initials from either. (b) **Email only.** (c) **A name required for everyone.** | (a), the engineer, 26 Nov 2026 |
| C-7 | What do `npm run seed` and `npm run clear` do against the shared Supabase database? | (a) **Keep both, guarded.** (b) **Seed an empty database once, no clear.** (c) **Local SQLite only.** | (c), the engineer, 26 Nov 2026 (E-6) |

### 16.5 Open questions

- Whether the default theme should be System rather than Light (R91).
- Whether last write wins is acceptable for the team, or edits need version checks (ADR-003).
- Whether development needs its own Supabase project, so it never works on the team's data (DEP-1).
- Roles and permissions, and a fuller record of who did what (stage changes, deletes).
- Which privacy rules apply once a real business uses it, and what they require (A-2, SEC-12).
- Whether SC2–SC4 are the right measures, and who checks them over the two weeks.
- Which real business will use it, and whether its needs differ.

## 17. Changing this spec

- **Each change** to Accountable is made on its own branch and has a folder `docs/changes/<branch name>/` holding its `intent.md` (why, and what success looks like) and its `plan.md` (how it's built and verified). A change's review report can go there too.
- **The change updates this spec** on its branch: new or changed requirements, contracts, data design, decisions and verification cases, written as the product will be once the change merges. When the change merges into `main`, this spec describes the product with it.
- **This spec is the authority** on how the product behaves. A change's intent and plan explain why it changed, and don't override this spec once the change has merged.
- **IDs stay stable** (section 1.6). A removed requirement keeps its ID retired, with a one-line note of the change that removed it.
- **Code this spec doesn't describe** is raised in review (`docs/REVIEW.md`): either the spec gains the missing description, or the code is removed.
- **Release.** Each release is tagged and has notes in `docs/STATUS.md` (DEP-5). The current release is `v0.1.0` (22 Nov 2026), from the change `mvp`. The change `mvp-multiuser` is to be released as `v0.2.0`.

### 17.1 Known gaps

Places where the product today falls short of this spec. Each is tracked in `docs/STATUS.md` until a change fixes it.

- **REL-7:** saving is blocked while the backend can't be reached in the forms, dialogs, the deal page and timelines, but not on the pipeline board (drops) or the dashboard's follow-up checkboxes. Those fail and roll back with a message instead (review finding REV-001, `docs/reviews/review-report.md`).
- **V-M02** has been run on Windows only, and **V-M05** hasn't been run.
- **R111–R113, R120–R124 (AC11, AC12), from `mvp-multiuser`:** the backend records who added and last changed each record, names who added each activity in timelines (`added_by`), and answers `GET /api/search` (V-B16, V-B17), but the browser shows none of it: record pages don't show "Added by" or "Last changed by", timelines don't show the person, and the top bar has no search box. The engineer left the plan's phase 6, which builds them, out of `mvp-multiuser` on 27 Nov 2026. V-F13, V-E15 and V-E16 aren't written, and V-M04's and V-M07's checks of these screens are skipped.
- **NFR-7, light mode:** Raspberry text (`--raspberry-text`) on the page color is 4.47:1, just under 4.5:1. That pair shows in three places: a late date on a hovered table row (the hover is the page color), every form's error message (`.form-error`, always), and the highlighted "Delete" item in a row menu. It predates dark mode, and stays because light mode mustn't change in the `mvp-darkmode` change (R94). `styles/tokens.test.ts` lists it as a known gap. Dark mode has no such gap.
- **NFR-7, light mode:** muted ink (`--ink-muted`) on the page color is 4.15:1, under 4.5:1. Spec 3.9 says muted ink is for white only in light mode, but the pipeline uses it on the page: under each column head ("$4.5K expected"), on the dashed "Add deal" buttons, and in "Closed in November". It predates dark mode and stays under R94; `styles/tokens.test.ts` lists it as a known gap. Dark mode has no such gap (6.2:1).

## 18. Ownership

| | |
|---|---|
| **Owner** | The product owner (the project owner) |
| **Describes** | Accountable `v0.1.0` with the change `mvp-multiuser`, to be released as `v0.2.0` |
| **Last changed by** | The change `mvp-multiuser` (`docs/changes/mvp-multiuser/`). Before it: the change `mvp-darkmode` (`docs/changes/mvp-darkmode/`), the change `mvp` (`docs/changes/mvp/`), and the docs reorganization that made this spec the description of the whole product. |
