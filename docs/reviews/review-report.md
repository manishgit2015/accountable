# Independent review: `build-mvp` → `main`

| | |
|---|---|
| Policy | `docs/REVIEW.md` 1.0 (approved by the engineer, 22 Nov 2026), with the engineer's fuller review brief (sections A–I) |
| Reviewer | An independent Claude Code session that wrote none of this code |
| Date | 22 Nov 2026 |
| Branch / base | `build-mvp` → `main` |
| Reviewed commit | `b8442d5cf32972272a1ff1238c76d488079b2764` (tagged `v0.1.0`); base `main` at `b6c6aafac589a39356a9ddef420dbdea836e10ce` |
| Uncommitted at review | `docs/STATUS.md` and `docs/build_logs.log` modified (release notes and the release entry, docs only); `docs/REVIEW.md` untracked. Reviewed as part of the change. |
| Report status | A recommendation, not an approval. Only the engineer approves, merges, pushes or tags. |

If any commit is added to `build-mvp` after `b8442d5`, the results in section F must be re-run on the new SHA before they count as evidence for it.

---

## A. Executive summary

**Scope.** `git diff main...HEAD`: 177 files (171 added, 5 modified, 1 renamed; none deleted), about 28,100 lines, plus the two uncommitted doc changes. It is the whole MVP: the FastAPI backend (`backend/app/`: config, db, errors, logging, security, rules, schemas, services, routers, seed, CLI, one Alembic migration), its 223 pytest tests, the React frontend (`frontend/src/`), its Vitest tests, 13 Playwright specs plus the performance and visual specs, the test and launch scripts, lockfiles, and the docs (`intent.md`, `spec.md` 2.0, `plan.md` 3.0, `STATUS.md`, `build_logs.log`, mockups).

**Outcome: PASS — READY FOR HUMAN APPROVAL.** I found no P0 or P1. Every mandatory check in REVIEW §13C was run by me on `b8442d5` and passed: `npm run lint`, `npm test` (388 backend, 106 frontend, 48 end-to-end), `npm run audit` (npm and pip-audit), and `npm run test:perf` (see F). The business rules, contracts, security boundary and transaction design match the spec, and the critical requirements have meaningful tests.

**Most significant findings (all P2, nonblocking):**

- **REV-001** Saving isn't blocked while the backend is unreachable on the pipeline board and the dashboard's follow-up checkboxes (REL-7 partly met). Both fail safely, rolling back with a message.
- **REV-002** `@dnd-kit/sortable` is an unused runtime dependency (ENG-5).
- **REV-003** The ≥90% coverage gate on `rules.py` and `services/` (spec 13.2) isn't enforced by any command. I measured it at 99–100%.
- **REV-004** The governing review policy `docs/REVIEW.md` is untracked, and the release notes are uncommitted.

**Main outstanding risks (accepted by the engineer before this review, not findings):** V-M02 hasn't been run on macOS or Linux, or on Windows with the network really off; V-M05 (someone new) hasn't been run; SC2–SC4 need two weeks of use. There's no CI.

---

## B. Findings summary

| Severity | Count | Blocking | IDs |
|---|---|---|---|
| P0 Critical | 0 | Yes | (none) |
| P1 Important | 0 | Yes, unless accepted in writing | (none) |
| P2 Minor | 4 | No: fix, or track in `docs/STATUS.md` | REV-001, REV-002, REV-003, REV-004 |

All four are confirmed by reading the code or the repository. None is a potential risk needing more checking.

---

## C. Detailed findings

```
REV-001  P2  Reliability
Location: frontend/src/pages/pipeline/PipelinePage.tsx:61-66;
          frontend/src/pages/dashboard/DashboardPage.tsx:22-26; frontend/src/pages/dashboard/FollowUps.tsx:28-35, 69-72
Requirement: REL-7 ("Data already on screen stays visible, but saving is blocked until it's back")
Issue: Every form, the delete dialog, the deal page's stage picker and the timeline's done toggles read
  useOffline() and disable saving while the backend can't be reached (e.g. ActivityForm.tsx:141,
  ConfirmDialog.tsx:86, DealForm.tsx:54). Two save paths don't: a board drop calls move.mutate(...)
  unconditionally, and the dashboard's follow-up checkbox calls update.mutateAsync(...) unconditionally.
Evidence: grep for useOffline in frontend/src finds no use in pages/pipeline/ or pages/dashboard/.
Failure scenario: the backend stops; the "Can't reach Accountable" banner shows; the user drags a card
  to Won or ticks a follow-up. The request is sent and fails after the proxy error, the card or tick is
  rolled back, and an error message shows.
Impact: Low. No data is lost or corrupted (R64 rollback and FollowUps' untick both work, and e2e
  pipeline.spec "R64 REL-8" covers the rollback), but the approved behavior is "blocked", and the user
  gets an action that visibly succeeds and then snaps back.
Recommendation: In PipelinePage, ignore drops (or disable dragging) and show the banner text while
  offline; in FollowUps, disable the checkboxes while offline. One Vitest case each.
Disposition: Open
```

```
REV-002  P2  Architecture (dependencies)
Location: frontend/package.json:30; frontend/vite.config.ts:34
Requirement: ENG-5 (a dependency must be needed); REVIEW §4 (dependencies are needed and recorded)
Issue: "@dnd-kit/sortable" ^10.0.0 is a runtime dependency and is pre-bundled in vite optimizeDeps, but
  nothing in frontend/src imports it. The board uses @dnd-kit/core's useDraggable/useDroppable with a
  custom coordinate getter (Board.tsx), as the Phase 3 hand-over states.
Evidence: grep -rn "@dnd-kit/sortable" frontend/src returns no matches.
Failure scenario: none at runtime. It adds a package to install, audit and keep updated, and misleads a
  maintainer into thinking the board is built on sortable.
Impact: Small, ongoing maintenance and supply-chain surface.
Recommendation: Remove it from frontend/package.json and the optimizeDeps list, refresh
  package-lock.json, and run npm test. Record the removal in plan §1.4's package list.
Disposition: Open
```

```
REV-003  P2  Testing
Location: pyproject.toml:26-29 (pytest addopts "-q"); scripts/run-tests.mjs:56 (backend command)
Requirement: spec 13.2 ("Coverage of rules.py and services/ is at least 90% of lines"); plan 4.6 row
  ENG-1–ENG-7 ("Clean lint. ≥90% on rules and services")
Issue: No command in the repository measures or enforces the threshold: `npm test` runs pytest without
  pytest-cov, and there's no --cov-fail-under anywhere. The build log's coverage figures were produced by
  ad hoc commands.
Evidence: I ran `npm test -- backend --cov=backend/app --cov-report=term`: rules.py 100%,
  services/__init__ 100%, dashboard 100%, deletes 100%, moves 100%, records 99%, timeline 100%
  (whole backend 98%). So the threshold is met today; it just isn't guarded.
Failure scenario: a later change adds untested branches to services/ and every check still passes.
Impact: A noncritical gap in a gate the spec and plan call mandatory.
Recommendation: Add `--cov=backend/app/rules.py`-style targets (or `--cov=app.rules --cov=app.services`)
  with `--cov-fail-under=90` to the backend step of run-tests.mjs or to pytest addopts.
Disposition: Open
```

```
REV-004  P2  Maintainability (docs and governance)
Location: docs/REVIEW.md (untracked); docs/STATUS.md:1, 106-128 and docs/build_logs.log:1319-1332 (uncommitted)
Requirement: ENG-9 ("docs/STATUS.md is updated when a piece of work is finished"); REVIEW §14 (evidence
  recorded in docs/build_logs.log); DEP-5 (release notes in docs/STATUS.md)
Issue: The approved policy this review is held to is not under version control, and the v0.1.0 release
  notes and the release log entry exist only in the working tree. The tag v0.1.0 points at b8442d5,
  whose STATUS.md still says checkpoint C5 and the tag are waiting on the engineer.
Evidence: `git status --short` shows "?? docs/REVIEW.md", " M docs/STATUS.md", " M docs/build_logs.log".
Failure scenario: a clean checkout of build-mvp or of the tag (or a merge of b8442d5 as it is) has no
  review policy and out-of-date release notes; a stash or clean loses them.
Impact: Documentation and governance only. No app behavior.
Recommendation: Commit docs/REVIEW.md, the STATUS.md and build_logs.log changes, and this report to
  build-mvp before the merge. Leave the existing tag where it is unless the engineer decides otherwise.
Disposition: Open
```

### Findings considered and dropped (challenge step)

| Candidate | Why it was dropped |
|---|---|
| `routers/health.py` opens a database connection itself, against ENG-1 ("routers don't touch the database") | Plan §3 lists `routers/health.py` with a dependency on `db.py` (T1.2), so it's an approved, documented exception, and it's read-only. |
| Won and Lost columns always drop a card at the top, so a row can't be reordered within them (R63) | The columns are defined as "the 5 most recent" (R60), ordered by recency, so a manual order there would have no meaning. Design choice, not a defect. |
| A read-then-write in `/move` can hit SQLite's `SQLITE_BUSY` without waiting, if a seed runs at the same moment | Reachable only with a concurrent CLI write in a single-user app, and it answers 503 `busy` with nothing changed (REL-6), which the UI handles. Not a credible defect. |
| Seed data is inserted directly rather than "through the services" (spec 7.1) | It goes through the data layer with Core only, in one transaction, and V-B11 checks that every deal's history fits. No behavior or risk difference. |
| A failed seed on first start leaves an empty, migrated database that isn't seeded on the next start | Needs an exception inside the deterministic seed after migration; nothing is lost, and `npm run seed` recovers. Speculative. |
| e2e runs fix the backend clock to 2026-11-21 (`ACCOUNTABLE_FIXED_NOW`) | Allowed by REVIEW §10 as test-only; `npm run dev` never sets it, and start-up logs a warning when it's set (`main.py:123-124`). |

---

## D. Requirement traceability

Chain: intent → spec (R/NFR/SEC/REL/OBS/DEP/ENG) → plan §4.6 → code → tests → evidence I produced. "Verified" means a test that I ran on `b8442d5` passed, or (for manual cases) the item is marked as such.

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| R1, DEP-3 One command | `package.json` predev/dev, `scripts/ensure-installed.mjs` | V-M02 on Windows only (build log T5.1, not re-run by me). Plan 4.6 still names `smoke.spec`, replaced by `start.spec.ts`. | Implemented but unverified (macOS, Linux) |
| R2, NFR-4 Offline | No outbound calls; fonts bundled; FastAPI docs disabled (`main.py:44`) | V-E00 guard in `e2e/fixtures.ts` on all 48 e2e tests (run, pass); V-M02 offline open | Implemented and verified (automated); manual offline run open |
| R3, REL-3 Persistence | WAL, FULL, transactions | V-E10 `persistence.spec.ts` (pass) | Implemented and verified |
| R4, R80–R84 Seed, commands | `seed.py`, `cli.py`, `main.prepare_database` | V-B11, V-B12, V-E09 (pass) | Implemented and verified |
| R5 Screen sizes | CSS | V-E12 `layout.spec.ts` (pass) | Implemented and verified |
| R6, NFR-1–NFR-3, NFR-13 | Lists unpaged, SQL aggregation, client-side search | V-P01 `npm run test:perf` (pass, see F) | Implemented and verified |
| R7 Clean console | — | V-E00 (pass) | Implemented and verified |
| R10–R13, R21, R22 Records and field rules | `schemas.py`, `services/records.py`, DB CHECKs in `db.py` | V-B02–V-B05, V-B08, V-S04–V-S06 (pass) | Implemented and verified |
| R14–R20, R24 Deal rules, spec 4.2 | `rules.py` (pure), `services/moves.change_stage` (one path for PATCH and /move) | V-B01, V-B05, V-B06 (pass), rules 100% covered | Implemented and verified |
| R23 Contact matches organization | `records._check_contact_matches` | V-B05, V-F05 (pass) | Implemented and verified |
| R30–R36 Deleting | FK rules SET NULL / CASCADE, `services/deletes.py`, `ConfirmDialog` | V-B07, V-F04, V-E02 (pass) | Implemented and verified |
| R40–R48 Tables and forms | `DataTable`, forms, pickers | V-F03, V-F05, V-F06, V-E02–V-E04 (pass) | Implemented and verified |
| R50–R56 Record pages, timelines | `services/timeline.py`, record pages | V-B09, V-E05, V-E08 (pass) | Implemented and verified |
| R60–R67 Pipeline | `pages/pipeline/*`, `services/moves.py`, `useMoveDeal` | V-B06, V-F07, V-F08, V-E06 incl. keyboard and rollback (pass) | Implemented and verified |
| R70–R79 Dashboard | `services/dashboard.py`, `pages/dashboard/*` | V-B10 incl. month boundary, V-F09, V-E01, V-E07 (pass) | Implemented and verified |
| NFR-5 Start-up ≤15 s | launcher | V-M02 Windows (build log), not re-run | Implemented but unverified |
| NFR-6, NFR-12 Portability, browsers | Node-only scripts, no shell syntax | Windows and Chrome only | Partial (macOS, Linux, other browsers not run) |
| NFR-7, R66 Keyboard | dnd-kit keyboard sensor, custom coordinate getter | V-E11, pipeline R66 test (pass) | Implemented and verified |
| NFR-8 / SC1 | — | V-M05 not run | Implemented but unverified |
| NFR-9 / SC5 Look | tokens, brand | V-M04 screenshots, engineer approval recorded | Implemented and verified (manual) |
| SEC-1–SEC-3 Local only, Host, Origin | `main.HOST`, `vite.config.ts:12-16`, `security.py` | V-S01–V-S03, V-S10 (pass) | Implemented and verified |
| SEC-5–SEC-7 Injection, schemes, bodies | Core only (text SQL only in PRAGMAs), `_website`, `WebsiteLink`, extra="forbid", 1 MB limit | V-S04–V-S06, V-S08, V-S09 (pass); no `dangerouslySetInnerHTML` (grep) | Implemented and verified |
| SEC-8 Logs | path templates, `hide_parameters=True`, no bodies | V-S07, `test_logging.py` (pass) | Implemented and verified |
| SEC-9 No secrets | none found in the diff | review | Implemented and verified |
| SEC-11 Audit | `npm run audit` | run by me, pass | Implemented and verified |
| REL-1, REL-2 Durability, atomic requests | PRAGMAs, `unit_of_work` per request | V-B02 (pass); V-M03 by hand (build log T4.3, not re-run) | Implemented and verified (automated part) |
| REL-4–REL-8, REL-12 | `client.ts` 10 s timeout, read retry 1 / write retry 0, offline banner, rollback, error boundary | V-F10, V-E06, persistence 503 test (pass) | Partial: REL-7 not applied on board and dashboard ticks (REV-001) |
| REL-9, DEP-4 Start-up failures, migrations | `main.run`, `db.upgrade_to_head` in one transaction | V-B13 failed migration and unreadable file (pass); "upgrade from previous version with data" waits for migration 0002 | Implemented and verified (as far as one migration allows) |
| REL-10 Commands beside a running app | WAL, busy timeout | V-B12, V-E09 (pass) | Implemented and verified |
| OBS-1–OBS-5 | `logging.py`, `errors.py`, `routers/health.py` | `test_logging.py`, V-B14 (pass) | Implemented and verified |
| DEP-1, DEP-2 Environments, config | `config.py` (only the DEP-2 vars, `ACCOUNTABLE_RELOAD`, test-only `ACCOUNTABLE_FIXED_NOW`) | `test_config.py` (pass) | Implemented and verified |
| DEP-5 Release | `package.json`/`pyproject.toml`/`config.py` at 0.1.0, tag `v0.1.0` | inspected | Implemented; release notes uncommitted (REV-004) |
| DEP-6, DEP-7 Rollback, upgrade | runbook in `STATUS.md` | inspected; matches the app | Implemented (procedural) |
| ENG-1–ENG-7 | lint rules, `src/api/` the only `fetch` | `npm run lint` (pass); coverage measured by me 99–100% | Implemented and verified; coverage gate not enforced (REV-003) |
| AC1 | as R1, R4 | V-E01 (pass), V-M02 partial | Implemented and verified (Windows) |
| AC2 | as R10–R48, R3 | V-E02–V-E04, V-E09, V-E10 (pass) | Implemented and verified |
| AC3 | as R44, R50–R51 | V-E05 (pass) | Implemented and verified |
| AC4 | as R15, R63 | V-E06 (pass) | Implemented and verified |
| AC5 | as R53–R55, R76 | V-E08 (pass) | Implemented and verified |
| AC6 | as R16–R17, R77 | V-E07 (pass) | Implemented and verified |
| AC7 | dashboard charts | V-E01 (pass), V-M04 | Implemented and verified |
| AC8 | REL-1 | V-M03 (build log only) | Implemented but unverified by this review |
| AC9 | — | V-M01 walkthrough and engineer approval (build log T5.5) | Implemented and verified (manual, engineer) |
| SC2–SC4 | — | V-M06 after release, by design | Not applicable yet |
| Out of scope (intent §5) | No sign-in, AI, integrations, import/export, dark mode, custom stages found in the diff | review | Not applicable (none added) |

---

## E. Architecture and extensibility assessment

- **Alignment.** The layers match spec 7.1 and ENG-1: routers only parse, open `unit_of_work` and call a service; services take the connection and the clock as arguments and don't import FastAPI; `rules.py` is pure (no clock reads, no I/O); `db.py` holds the only text SQL (the PRAGMAs, E-1); schema changes are in Alembic (`0001_initial.py`, with `test_ENG4_migration_and_table_definitions_agree`). In the frontend, `src/api/client.ts` is the only `fetch` and does the one snake/camel translation (ENG-6). The one documented exception is `routers/health.py` reading the schema version (plan T1.2).
- **ADRs.** ADR-002 (127.0.0.1, Host and Origin checks), ADR-003 (last write wins), ADR-004 (migrations on start-up), ADR-005 (no personal data in logs), ADR-006 (separate stage-change table), ADR-007 (lists in full), ADR-008 (fractional positions with renumbering), ADR-013 (local time), ADR-014, ADR-015 (`closed_at` drives months), ADR-017 (badge fills) are all followed in the code I read.
- **Modularity and cohesion.** One service per concern (records, moves, deletes, timeline, dashboard). Stage effects have a single code path (`moves.change_stage`) used by both `PATCH` and `/move`, which removes the main risk of the two routes drifting (RK-7).
- **Coupling and interfaces.** Request and response models are separate, unknown fields are refused, and every error uses one envelope. `records.py` imports `moves` lazily inside two functions to avoid a cycle; it's contained and commented.
- **Extensibility.** The injected clock and connection, SQLite confined to `db.py` and migrations, allowed hosts and origins built from `Settings`, and token-only colors make the likely next steps (Postgres or hosting, sign-in, more record types, dark mode) changes in configuration or new modules, not rewrites. ADR-013 (local time) and ADR-007 (unpaged lists) are the known, recorded constraints on hosting and on 10× volume.
- **Complexity.** No speculative layers, repositories or plugin systems. The one avoidable item is the unused `@dnd-kit/sortable` (REV-002).

---

## F. Test and CI evidence

All commands were run by me on Windows 11 in `C:\github\accountable`, on commit `b8442d5` with the uncommitted doc-only changes listed above, on 22 Nov 2026. PowerShell needs `npm.cmd`.

| Check | Command | Result | Source |
|---|---|---|---|
| Lint, format, types | `npm.cmd run lint` | **PASS**, exit 0. Ruff "All checks passed!", "47 files already formatted"; ESLint clean; Prettier "All matched files use Prettier code style!" (frontend and e2e/scripts); `tsc` both projects clean. | This review |
| Backend unit and integration | `npm.cmd test` (pytest step) | **PASS**: 388 passed, 1 warning (Starlette's deprecation of `httpx` in `TestClient`, harmless) | This review |
| Frontend unit and component | `npm.cmd test` (Vitest step) | **PASS**: 12 files, 106 tests | This review |
| End to end (installed Chrome) | `npm.cmd test` (Playwright step) | **PASS**: 48 passed in 2.0 min; `npm test` exit 0, "All tests passed: backend, frontend, e2e." | This review |
| Security cases V-S01–V-S10 | inside `npm test` (`test_security.py`, `security.spec.ts`) | **PASS** | This review |
| Coverage (spec 13.2) | `npm.cmd test -- backend --cov=backend/app --cov-report=term` | **PASS** against the threshold: rules 100%, services 99–100%, backend 98% (not enforced: REV-003) | This review |
| Dependency audit | `npm.cmd run audit` (`npm audit --audit-level=high` and `uv run python -m pip_audit`) | **PASS**, exit 0: "found 0 vulnerabilities"; "No known vulnerabilities found". The script already uses `python -m pip_audit`, so Application Control's block on `pip-audit.exe` didn't apply. | This review |
| Performance V-P01 | `npm.cmd run test:perf` | **PASS**, exit 0: 4 passed (3.0 min) at 2 × volume (200 organizations, 2,000 contacts, 1,000 deals, 10,000 activities). NFR-1 page p95 60–235 ms (worst: organization page 235 ms; limit 500). NFR-2 lists p95 ≤103 ms (activities, 10,000 rows; limit 300), other calls p95 ≤4 ms (limit 100). NFR-3 search and sort p95 36–51 ms (limit 100). | This review |
| CI / CD | (none) | **NOT APPLICABLE / UNVERIFIED**: the repository has no `.github/` or other pipeline, so there are no CI results or branch protection to check. Every result above is from local runs. | Repository |
| V-M01 walkthrough, V-M04 look, AC9/SC5 approval | manual | **UNVERIFIED by this review** (build log T5.2–T5.5 and the engineer's recorded approval) | `docs/build_logs.log` |
| V-M02 fresh clone and offline | manual | **UNVERIFIED** for this review; Windows run recorded by the build; macOS, Linux and Windows-with-network-off **NOT RUN** | `docs/build_logs.log` T5.1 |
| V-M03 crash test | manual | **UNVERIFIED** for this review (recorded in T4.3) | `docs/build_logs.log` |
| V-M05 someone new | manual | **NOT RUN** | `docs/STATUS.md` |
| V-B13 upgrade with data from a previous version | — | **NOT APPLICABLE** until migration 0002 exists | `docs/build_logs.log` |

I didn't install dependencies, run migrations against `backend/data/accountable.db`, or start the app against the real database. All test runs used the temporary databases that `scripts/run-tests.mjs` creates.

---

## G. Production readiness (local, single-user deployment)

| Area | Assessment | Release-blocking? |
|---|---|---|
| Security | Both servers bind 127.0.0.1 (`main.py:27,129-133`, `vite.config.ts:12`); Host allow-list and Origin check on changing methods (`security.py`); 415/413/422 enforced before the app; no CORS headers; Core with bound parameters; no `dangerouslySetInnerHTML`; links only for http/https with `noopener noreferrer`; no secrets; audit clean. Test ports 8001/5174 are always allowed, but only on 127.0.0.1 (documented, plan T1.3). | No |
| Reliability | One transaction per request; WAL + `synchronous=FULL` + `busy_timeout=5000`; migrations in one transaction; start-up failures print one line and exit 1; locked database → 503; 10 s client timeout; reads retried once, writes never; optimistic moves roll back; error boundary. REL-7 partly met (REV-001). | No |
| Performance | SQL aggregation for the dashboard and organization counts, two queries per timeline, no per-row queries found. V-P01 passed at 2 × volume, with the worst page at 235 ms p95 against 500 ms. | No |
| Deployment safety | `npm run dev` with lockfile-pinned installs only when lockfiles change; forward-only migrations; the app never resets an existing database (`prepare_database` seeds only when there was no schema). | No |
| Configuration | Only DEP-2's variables, `ACCOUNTABLE_RELOAD`, and the test-only `ACCOUNTABLE_FIXED_NOW` (warned in the log). Bad values stop start-up with a clear message. | No |
| Observability | One log line per request with ID, method, path template, status, duration; rotating file 5 MB × 3; `X-Request-ID` on every response and "Reference:" in the UI; health with schema and app version. | No |
| Rollback and recovery | Previous tag plus the user's copy of `backend/data/`; backup and restore steps in `STATUS.md` match the app. | No |
| Ownership | The engineer (product owner) owns the app; single user, no on-call by design (ADR-014). | No |

---

## H. Outstanding risks and required actions

**Mandatory fixes before approval:** none (no P0 or P1).

**Missing verification (known and accepted by the engineer at release, `docs/build_logs.log` lines 1316–1332):**
- V-M02 on macOS and Linux, and on Windows with the network really off (DoD item 5, NFR-6, AC1 portability).
- V-M05 (someone new answers the SC1 questions).
- V-M06 / SC2–SC4 after two weeks of use (by design).
- V-B13's "upgrade with data from the previous version", when migration 0002 is written.
- There is no CI, so nothing re-checks a later commit automatically; `npm test`, `npm run lint` and `npm run audit` must be re-run by hand on any new SHA.

**Nonblocking improvements:** REV-001 (block board drops and follow-up ticks while offline), REV-002 (drop `@dnd-kit/sortable`), REV-003 (enforce the coverage threshold), REV-004 (commit `REVIEW.md`, the release notes and this report). Also refresh plan §4.6's R1 row, which still names the removed `smoke.spec`.

**Decisions for the engineer:**
- Whether to fix REV-001 to REV-004 before the merge or track them in `docs/STATUS.md` "Next".
- Whether to merge with V-M02 (macOS, Linux, offline) and V-M05 still open, as was already accepted for the `v0.1.0` tag.
- The Phase 5 differences already listed in `STATUS.md` (source names on dashboard rows, Cerulean follow-up links, sample won/lost history, the Deals default sort, the pipeline "Add deal" button names) remain open as product decisions; none contradicts the approved spec.

---

## I. Final recommendation

**PASS — READY FOR HUMAN APPROVAL**

There are no open P0 or P1 findings. On the reviewed commit `b8442d5`, `npm run lint`, `npm test` (388 + 106 + 48), `npm run audit` and `npm run test:perf` were run by this review and passed; the business rules, API contracts, ADRs and the local-only security boundary are implemented as the approved spec describes and are covered by passing tests. The four P2 findings don't block; the open manual verifications were accepted by the engineer before this review and are listed in H.

Next actions: the engineer decides on REV-001 to REV-004 (fix now or track in `STATUS.md`), commits the governance docs and this report (REV-004), and then approves and merges `build-mvp` into `main` themselves. If any commit lands after `b8442d5`, re-run the four checks in section F first.

This is a recommendation, not an approval.
