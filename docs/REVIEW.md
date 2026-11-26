# REVIEW.md: Code review policy

| | |
|---|---|
| Version | 1.1 (26 Nov 2026: the spec split into `docs/spec.md` and area files in `docs/specs/`). 1.0 (22 Nov 2026). |
| Owner | The engineer (the project owner) |
| Applies to | Every change to Accountable, whether written by a coding agent or by hand, before it merges into `main` |
| Status | Approved by the engineer, 22 Nov 2026 |

## 1. Purpose and principles

A review checks that a change is correct, matches the spec and the change's approved intent and plan, is secure, keeps the architecture, is reliable, and is proven by tests that were actually run.

- **Verify correctness, not just code quality.** The question is whether the change solves the approved problem correctly and safely. It isn't whether the reviewer would have written it differently.
- **Report defects and real risks,** not personal preferences.
- **Independence.** The review runs in a fresh session, or by another agent, that didn't write the change. The reviewer reads the code and tests itself, rather than relying on the implementing agent's account.
- **No self-approval.** The implementing agent never approves its own change. Only the engineer approves a merge or a release.
- **The reviewer doesn't change code.** It reports findings. Fixes are made afterwards, in the implementing session or another, and are then reviewed again.

## 2. Inputs and scope

Read these before reviewing:

| Input | What it gives |
|---|---|
| `docs/spec.md` | The product's summary, and the index of the area files: which file holds each section and each ID |
| `docs/specs/*.md` | The whole product, one file per area: acceptance and success criteria (AC1–AC9, SC1–SC5, section 1.4, `overview.md`), requirements (R, NFR, SEC, REL, OBS, DEP, ENG, in the file the index gives), contracts (section 5, `api.md`), the data design (section 6, `data.md`) and the decision log (section 16.3, `governance.md`). Read every area file the change touches, and any other its code paths reach. |
| `docs/changes/<branch name>/intent.md` | The change's approved scope and its own acceptance criteria |
| `docs/changes/<branch name>/plan.md` | The change's approved tasks, files, risks and verification cases (V IDs) |
| `AGENTS.md` | The repository's rules and checks |
| `docs/build_logs.log` and `docs/evidence/` | What was run, and its results |
| `docs/mockups/1-spec-reference/` | The visual reference, for UI changes |
| The diff | `git diff main...HEAD` on the branch under review, including the changed and related tests |

- Say which of these are missing, out of date or unapproved.
- Never assume a check passed because its evidence is missing.
- **Scope:** review the change and the behavior it touches, reading surrounding code only as needed to judge contracts, security and regressions. Don't ask for unrelated refactoring.

## 3. Pass 1: Functional correctness

Check that:

- the change does what the spec says: the requirements in spec section 3 (`records.md`, `deals.md`, `pipeline.md`, `dashboard.md`, `sample-data.md`, `look-and-feel.md`), the stage effects in section 4.2 (`deals.md`), the field rules in R21 and the delete rules in R30–R36 (`records.md`), and the dashboard definitions in R70–R79 (`dashboard.md`)
- the acceptance criteria it touches still hold
- requests and responses match spec 5 (`api.md`) exactly (names, nullability, status codes, the error format)
- edge cases are handled (spec 4.5, `journeys.md`): cleared links, reopened deals, stale drops, month boundaries, empty data
- "today", "this month" and dates come from the one clock, in local time
- nothing outside the approved scope was added (the change's intent, and spec section 1.3, `overview.md`)
- every behavior in the code is described in the spec (`docs/spec.md` and the area files in `docs/specs/`): flag code that the spec doesn't describe (behavior, endpoints, fields, settings, commands), whether the fix is to add it to the spec in this change or to remove the code
- the change updated every area file its behavior, contracts, data, decisions or tests affect, and `docs/spec.md` when its summary, index or ID table changed: each section and ID still sits in the file the index names, and no area file describes the product as it was before the change

**Blocking:**
- wrong business behavior
- a broken acceptance criterion
- data loss or corruption
- a regression
- a contract that doesn't match spec 5
- an area file the change affects that still describes the product as it was before the change

## 4. Pass 2: Architecture and design

Check that:

- the boundaries in spec 7.1 (`architecture.md`) and ENG-1 (`engineering.md`) hold: routers do HTTP only, services hold the use cases and transactions, `rules.py` is pure, and only `src/api/` calls `fetch`
- SQL goes only through SQLAlchemy Core, with text SQL only for the PRAGMAs in `db.py` (E-1). Schema changes go only through Alembic migrations.
- new dependencies are popular, maintained, needed and recorded (ENG-5)
- the approved decisions (ADRs) are followed, and any change to one was approved
- abstractions have a current purpose, with no speculative layers (YAGNI)

**Blocking:**
- a broken boundary or a violated ADR
- an unapproved contract change
- a design that can't meet an NFR
- complexity that creates a real risk

## 5. Pass 3: Security and data protection

Accountable has no sign-in by design (spec section 1.3, SEC-4, in `overview.md` and `security.md`). Its protection is staying on one computer, so check that:

- both servers listen on `127.0.0.1` only, and the Host and Origin checks, body limit and JSON-only rule are intact (SEC-1–SEC-3, SEC-7)
- every input is validated on the server (R21), and unknown fields are refused
- there's no text SQL, no `dangerouslySetInnerHTML`, and links only for `http` and `https` (SEC-5, SEC-6)
- logs never contain request bodies or field values, and errors never show stack traces to the browser (SEC-8)
- no secrets are in the code, and no new outbound network calls are made at runtime (SEC-9, R2)
- dependency changes pass `npm run audit` (SEC-11)

Sign-in and permission checks aren't applicable until a change adds users. AI-specific checks aren't applicable until a change adds AI features.

**Blocking:**
- data exposure beyond the computer
- a weakened local-only boundary
- an injection path
- a disclosed secret
- personal data in logs

## 6. Pass 4: Reliability and resilience

Check that:

- each request runs in one transaction, and moves, deletes, seed and clear are all or nothing (REL-2)
- the durability settings are unchanged (REL-1 in `reliability.md`, spec 6.3 in `data.md`)
- timeouts are bounded (REL-4), reads are retried once at most, and changes are never retried automatically (REL-5)
- the failure paths in REL-6 to REL-12 still work: busy database, backend unreachable, rollback on a failed move, start-up failures, stale positions, error boundary
- an existing database is never deleted, reset or reseeded by the app itself (REL-9)

**Blocking:**
- an unbounded loop or retry
- an unhandled crash on a normal path
- inconsistent data
- unsafe recovery

## 7. Pass 5: Code quality and maintainability

Check that:

- code is clear, cohesive and named understandably, and follows the existing conventions
- the changed code and tests follow the coding standards in `docs/STANDARDS.md`
- duplication that would cost real maintenance is avoided
- error messages help the user without leaking details (spec 3.9 Writing, `look-and-feel.md`)
- the docs are updated where the change needs it: `docs/STATUS.md`, the build log, and the runbook
- there's no dead code

Style, formatting, types and the complexity limit are enforced by `npm run check` (Prettier, ESLint, tsc, Ruff, ty), so don't comment on them unless it fails. Do review whether a change got under the limit by splitting code sensibly, not by moving logic somewhere harder to follow.

## 8. Pass 6: Testing and verification

Check that the tests prove the behavior:

| Level | Expect |
|---|---|
| Unit | Business rules, validation, boundaries, error paths and stage effects (pytest for `rules.py` and schemas, Vitest for `lib/` and components) |
| Integration | API contracts, persistence, cascades, migrations, the security boundary and dependency failures (pytest with a temporary SQLite database) |
| End to end | The journeys in spec 4.1 (`journeys.md`), negative cases and regressions (Playwright in the installed Chrome) |
| Nonfunctional | Performance (`npm run test:perf`), security (V-S cases), recovery and keyboard use, where the change touches them |

Ask:

- Do the tests check behavior, or only implementation details?
- Could the code be wrong while every test passes?
- Are important negative cases missing?
- When a rule applies at several entry points (every save path while offline, REL-7; deleting from a table row and from the record's own page, R30), is each entry point implemented and tested, not just the first one? Both earlier escapes were this shape (REV-001, and the R30 defect in the Phase 5 walkthrough).
- Would each new test fail if the behavior broke the way it really would (the browser API itself throwing, a rendered size or color, an empty file being scanned), or only if a stubbed method did? Is the probe that proved it recorded in the build log? Four of the mvp-darkmode change's escapes were this shape.
- Were any assertions or acceptance criteria weakened?
- Are new tests named by requirement ID (ENG-7)?

**Evidence rules:**
- Generated test code isn't proof.
- Report each check as one of: run and passed, run and failed, not run, or couldn't be verified.
- Missing evidence for a required check is a verification gap.

## 9. Pass 7: Performance and resource use

Where the change touches lists, timelines, the dashboard or the board, check that:

- it still meets NFR-1 to NFR-3 at the target volume in NFR-1 (`npm run test:perf`)
- queries are bounded (no query per row), and aggregation happens in SQL
- connections and other resources are closed

Raise a concern only with code evidence, a measurement or a concrete failure scenario. Never make up results.

## 10. Pass 8: Production readiness

Accountable runs locally on one computer, so check only what applies:

- **Configuration:** only the variables in DEP-2 (plus `ACCOUNTABLE_RELOAD`, and the test-only `ACCOUNTABLE_FIXED_NOW`). There are no secrets.
- **Migrations:** forward-only, tested on a database holding data (V-B13), and a failure leaves the database unchanged (DEP-4, REL-9).
- **Observability:** errors are logged with the request ID, health still answers (OBS-1–OBS-5), and no personal data is in the logs.
- **Operations:** the runbook, backup and restore steps in `docs/STATUS.md` still match the app. Rollback is the previous tag plus the user's copy of `backend/data/` (DEP-6).

Metrics, tracing, alerts and feature flags aren't applicable (ADR-014).

## 11. Severity

| Severity | Examples | Decision |
|---|---|---|
| **P0, Critical** | Data loss or corruption. The app reachable from other computers. An injection that works. A secret or personal data leaked. | Blocks the merge |
| **P1, Important** | A functional defect or regression. A contract or ADR broken. A required security or reliability control missing. A critical requirement with no test. A rule in `AGENTS.md` broken. | Blocks the merge until it's fixed, or the engineer accepts it in writing |
| **P2, Minor** | A local maintainability problem, avoidable complexity with a real cost, a noncritical test gap, or a missing doc line | Doesn't block. Fix it or track it in `docs/STATUS.md`. |
| **P3, Nit** | Naming, formatting or style preferences | Leave out |

- Report every credible P0 and P1.
- Report at most five P2s, choosing the most useful.
- Never invent findings to fill a quota, or drop a blocking one to keep the report short.

## 12. Workflow

1. Find the branch, its base (`main`) and the changed files.
2. Read the inputs in section 2.
3. Read the whole diff and the code paths it touches.
4. Do every pass that applies (sections 3 to 10).
5. Check that each changed requirement maps to code and a test (plan section 4.6).
6. Run the checks yourself, in section 13C's order, and record their real results.
7. Write up each finding with its evidence and severity.
8. Report without changing application code. Save the report in the change's folder as `docs/changes/<branch name>/review-<n>.md` (1 for the first review, 2 for the re-review, and so on), so `docs/IMPROVE.md` has it as evidence.
9. After fixes, review the affected changes again.

## 13. Report format

### A. Summary

- Branch and base, and the files reviewed
- The spec and plan sections it relates to
- The evidence inspected
- The overall status

### B. Findings

One block per finding:

```
REV-001  P1  Functional
Location: backend/app/services/moves.py:40-58
Issue: what is wrong
Evidence: the code, a failing test, or the requirement it contradicts
Impact: why it matters
Recommendation: the fix
Requirement: R16
Disposition: Open | Fixed | Accepted by the engineer | Not applicable
```

### C. Verification status

Run each command and give its real result: passed, failed, not run, or couldn't be verified.

| Check | Command |
|---|---|
| The quality gate: formatting, lint, complexity, types, secrets (gitleaks), all tests, and the coverage thresholds (80% overall, 90% of lines in `rules.py` and `services/`) | `npm run check` (its summary names each check) |
| Security | `npm run audit`, plus the V-S cases inside `npm test` |
| Performance | `npm run test:perf`, when the change touches lists, timelines, the dashboard or the board |
| Visual comparisons | `node scripts/run-tests.mjs visual`, when the change touches styles or has baselines in its folder. It isn't part of `npm run check`, because its screenshots depend on the machine. |

### D. Outstanding risks

Unresolved risks, and any evidence that's missing.

### E. Decision

One of:

- **PASS: ready for the engineer's approval.** No P0 or P1, and the evidence is enough.
- **CHANGES REQUIRED.** A P0 or P1 is open, or a mandatory check failed.
- **BLOCKED: insufficient evidence.** A required check or inspection couldn't be done.

The reviewer's decision is a recommendation, not approval.

## 14. Merge criteria

A change can go to the engineer for approval when:

- no P0 or P1 is open, unless the engineer accepted it in writing
- the acceptance criteria it touches hold
- `npm run check` and `npm run audit` pass, and were run on the commit being merged
- the contracts and ADRs are kept, or their changes were approved
- the evidence is recorded in `docs/build_logs.log`

Only the engineer merges, pushes, tags or releases. The reviewer and the implementing agent never do.
