# Spec: Assumptions, risks, decisions and governance

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Assumptions, risks, decisions (ADR, E and D IDs), resolved ambiguities, open questions, changing the spec, known gaps and ownership. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 16. Assumptions, risks and decisions

### 16.1 Assumptions

| ID | Assumption | If it's wrong |
|---|---|---|
| A-1 | Only the salesperson uses the computer, so no sign-in is needed | Anyone at the computer can read and change sales data. Sign-in would be needed. |
| A-2 | No privacy or regulatory rule applies while the data stays on one computer used by one person | Rules such as GDPR could require deleting or exporting a person's data on request |
| A-3 | The user backs up `backend/data/` themselves | Losing the computer loses the data |
| A-4 | Node 24+ and uv can be installed by the user, following the documentation | A non-technical user may need help with setup |
| A-5 | The target platforms and browsers in NFR-6 and NFR-12 | More testing would be needed |
| A-6 | The test machine for performance is a typical recent laptop | The thresholds may need adjusting |
| A-7 | One salesperson's needs are close enough to the wider team's | The data model may need changes when the team joins |
| A-8 | The problem's impacts are as described in section 1.2 | The success measures may target the wrong thing |

### 16.2 Risks

Each change's delivery risks are in its plan. These are the product's architectural and product risks:

| Risk | Handling |
|---|---|
| Local time, rather than UTC, makes a later move to hosting harder | ADR-013. Moving would need a migration that converts stored times. |
| Last write wins is wrong once there are several users | ADR-003 holds only while there's one user. A change that adds users must revisit it. |
| The two development servers aren't a production runtime | ADR-010. Hosting will need a build-and-serve setup. |
| Forward-only migrations make data rollback depend on the user's copy | DEP-6 and the runbook |
| Requiring an organization for every contact, including leads, adds a step for individual buyers | Accepted by the product owner |
| There are no baselines for the business outcomes | SC2–SC4 are judged against their targets, not against an improvement on before |
| "Visually stunning" and "a pleasure to use" are judgement calls | The product owner reviews the look (V-M04, SC5), against the mockups |

### 16.3 Decisions

Architecture decisions (ADR) and engineering decisions (E) that shape the product today.

| ID | Decision | Notes |
|---|---|---|
| ADR-001 | The stack is as set by `docs/TECH_STACK.md` | A constraint on the product |
| ADR-002 | Both servers listen on `127.0.0.1` only, with Host and Origin checks (SEC-1–SEC-3) | |
| ADR-003 | Last write wins on concurrent edits | |
| ADR-004 | Alembic versioned migrations, run on start-up | Adds Alembic alongside SQLAlchemy Core, because real data must survive future versions |
| ADR-005 | No personal data in logs. Logs go to the terminal and a rotating local file. | |
| ADR-006 | Stage changes are a separate, read-only table | |
| ADR-007 | Lists load in full, and search, sort and paging happen in the browser | Simple and fast at 1,000 rows. It would need server paging at about 10 × the volume. |
| ADR-008 | Fractional positions with renumbering | One row changes per drop. The alternative, renumbering the whole column every time, is simpler but writes more. |
| ADR-009 | An unversioned `/api` | The frontend is the only client. A breaking change for other clients would be `/api/v2`. |
| ADR-010 | The development servers are the runtime for users | It's what `TECH_STACK.md` sets. The alternative, a built frontend served by FastAPI, starts faster and runs one process, but adds a build step. |
| ADR-011 | Stage colors, contrast rules, funnel from stage history, the contact must match the organization, reopening keeps the date, follow-up groups, timelines follow the current contact | |
| ADR-012 | Mockup 1 (`docs/mockups/1-spec-reference/`) is the visual reference | It follows the layout set earlier by mockup B, which was removed |
| ADR-013 | Times are stored and compared in the computer's local time | Matches "today" as the user sees it. The alternative, UTC plus a stored time zone, is safer for hosting later. |
| ADR-014 | No metrics, tracing or alerting | A single-user local app with no one on call |
| ADR-015 | The `closed_at` column drives the month figures | See C-3 |
| ADR-016 | Duplicate names are allowed | See R22 |
| ADR-017 | Small text with a white color uses darker fills: badges stay at 12px, and their Cerulean and Raspberry fills become the darker `#0E7194` and `#D12E57` (now `--cerulean-strong` and `--raspberry-strong`, ADR-019) | Resolves a contradiction between the badge style and the contrast rule in 3.9 |
| ADR-018 | The light or dark choice is kept in the browser's `localStorage`, not in the database | No backend, API or migration change, and it can be applied before the first paint. The alternative, a settings row with an API, would follow the app across browsers, but adds a migration, an endpoint and a request before the page can be colored. Approved 25 Nov 2026 (`docs/changes/mvp-darkmode/intent.md`). |
| ADR-019 | The dark palette is derived from the brand: page `#04232E`, black panels, Sea Mist ink, lighter `-text` colors, and unchanged fills. Tokens used as fills, or for text on fills, are separate from text tokens and don't change with the mode (`--midnight`, `--cerulean-strong`, `--raspberry-strong`). | A `-text` token can't be both a text color that lightens in dark mode and a fill under white text, and `--ink` can't be both main text and Midnight on fills. Splitting them keeps one tokens file and no per-component overrides. Approved by the product owner on 26 Nov 2026, from the screenshots in `docs/changes/mvp-darkmode/` (V-M04). Two later fixes from the independent reviews, the dark `--line` (`#527280` to `#62828E`, REV-003) and the toggle's icon at its full 18px (REV-008), were approved by the product owner the same day from the retaken screenshots. |
| E-1 | The connection `PRAGMA` statements in `db.py` are the only text SQL | SQLite's settings in section 6.3 can only be set that way. A test checks it's the only text SQL (V-B02). |
| E-2 | Uvicorn runs without reload by default, and `ACCOUNTABLE_RELOAD=1` turns reload on for development | One command, `npm run dev`, serves both users and developers |
| E-3 | NFR-1 is measured as in-app navigation after the first load; the cold first load is recorded without a threshold | Under ADR-010 the first load compiles modules on demand |
| E-4 | V-S10 is automated as "the servers are bound to 127.0.0.1", by inspecting the listening sockets; the LAN address is checked by hand in V-M02 | The LAN address isn't stable in automated runs |
| E-5 | Evidence for each task is recorded in `docs/build_logs.log` | `docs/STATUS.md` still gets a short line per finished piece of work |
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

### 16.5 Open questions

- Sign-in, several people sharing the same data, and a record of who did what.
- Making Accountable available beyond the computer it runs on (hosting).
- Which privacy rules apply once a real business uses it, and what they require (A-2, SEC-12).
- Whether SC2–SC4 are the right measures, and who checks them over the two weeks.
- Which real business will use it, and whether its needs differ.

## 17. Changing this spec

- **Each change** to Accountable is made on its own branch and has a folder `docs/changes/<branch name>/` holding its `intent.md` (why, and what success looks like) and its `plan.md` (how it's built and verified). A change's review report can go there too.
- **The change updates this spec** on its branch: new or changed requirements, contracts, data design, decisions and verification cases, written as the product will be once the change merges. When the change merges into `main`, this spec describes the product with it.
- **This spec is the authority** on how the product behaves. A change's intent and plan explain why it changed, and don't override this spec once the change has merged.
- **IDs stay stable** (section 1.6). A removed requirement keeps its ID retired, with a one-line note of the change that removed it.
- **Code this spec doesn't describe** is raised in review (`docs/REVIEW.md`): either the spec gains the missing description, or the code is removed.
- **Release.** Each release is tagged and has notes in `docs/STATUS.md` (DEP-5). The current release is `v0.1.0` (22 Nov 2026), from the change `mvp`.

### 17.1 Known gaps

Places where the product today falls short of this spec. Each is tracked in `docs/STATUS.md` until a change fixes it.

- **REL-7:** saving is blocked while the backend can't be reached in the forms, dialogs, the deal page and timelines, but not on the pipeline board (drops) or the dashboard's follow-up checkboxes. Those fail and roll back with a message instead (review finding REV-001, `docs/reviews/review-report.md`).
- **V-M02** has been run on Windows only, and **V-M05** hasn't been run.
- **NFR-7, light mode:** Raspberry text (`--raspberry-text`) on the page color is 4.47:1, just under 4.5:1. That pair shows in three places: a late date on a hovered table row (the hover is the page color), every form's error message (`.form-error`, always), and the highlighted "Delete" item in a row menu. It predates dark mode, and stays because light mode mustn't change in the `mvp-darkmode` change (R94). `styles/tokens.test.ts` lists it as a known gap. Dark mode has no such gap.
- **NFR-7, light mode:** muted ink (`--ink-muted`) on the page color is 4.15:1, under 4.5:1. Spec 3.9 says muted ink is for white only in light mode, but the pipeline uses it on the page: under each column head ("$4.5K expected"), on the dashed "Add deal" buttons, and in "Closed in November". It predates dark mode and stays under R94; `styles/tokens.test.ts` lists it as a known gap. Dark mode has no such gap (6.2:1).

## 18. Ownership

| | |
|---|---|
| **Owner** | The product owner (the project owner) |
| **Describes** | Accountable `v0.1.0` |
| **Last changed by** | The change `mvp-darkmode` (`docs/changes/mvp-darkmode/`). Before it: the change `mvp` (`docs/changes/mvp/`), and the docs reorganization that made this spec the description of the whole product. |
