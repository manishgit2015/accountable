# Harness improvement report: mvp-multiuser

Following `docs/IMPROVE.md`, after review 1 (`review-1.md`). 28 Nov 2026.

## Evidence used

Only what is recorded:

- `review-1.md`: REV-001 (P1), REV-002 and REV-003 (P2). REV-001 and REV-003 are fixed in a7935a6; REV-002 is open.
- `docs/build_logs.log`: this change's entries, from part D (27 Nov) to the review fixes (28 Nov), with their probes and defects.
- Check and hook output: the Stop hook's `check:quick` failure on 28 Nov (Prettier on `frontend/dist`, a test reading the real build), `npm run check` and the pre-commit hook.
- The engineer's corrections and requests: they reported the dashboard's 500 on Supabase (Postgres error 42803), replaced the CA-verified TLS decision with unverified TLS, left phase 6 out, and found `.env` missing two settings that the new first-run check caught.

There is no CI.

## Issues found in this change

| # | Issue | Caught by | Fixed |
|---|---|---|---|
| 1 | SQLite batch migration with foreign keys on: dropping the old `deals` copy deleted every activity | the agent's V-B13 test (data loss stopped before it reached any database) | foreign keys off for migrations, link check before commit |
| 2 | Alembic commits its own transaction, so the post-migration check couldn't roll back | the agent's rollback test | the app opens the transaction itself |
| 3 | Dashboard GROUP BY with separately bound `substr` arguments: fine on SQLite, error 42803 on Postgres | **the engineer, in real use** | literal values, test V-B19 |
| 4 | `users` row read then written: concurrent first requests gave 503 on SQLite (500 on Postgres) | the e2e run's V-E00 (once, intermittently) | one upsert, a two-thread test |
| 5 | With the built page served, an unknown `/api` POST answered 405, not 404 | the Stop hook (a test reading the real `frontend/dist`) | the route takes every method; tests isolated from the real build |
| 6 | The bundle check matched the bare `sb_secret_` in Supabase's own client | the check itself | the check matches a key, not the prefix |
| 7 | REV-001: unauthenticated token headers could trigger unlimited, lock-holding fetches | the independent review | limited to one fetch per 30 s, outside the lock |
| 8 | REV-003: migrations and the first sample data load in separate transactions | the independent review | one transaction |
| 9 | Tests that passed while the code was broken: A8 (test key in real use), P4 (users cache), S1 (`lower()` vs `casefold()`), S3 (search order) | the agent's probes, before any review | each test strengthened, and its probe re-run |
| 10 | Probes that failed for the wrong reason: A2 (a bad keyword argument), P4 (a syntax error), S1 for REV-003 (a missing import) | the agent, reading the failure | each probe rewritten, and re-run |
| 11 | Code edited through Python or shell strings with its escapes mangled (`\n` became a line break, `\r` and `\1` control characters), five times: `test_cli.py`, `check-bundle.mjs` twice, `ensure-installed.mjs`, and a probe script | the next test, Prettier or the parser each time | rewritten with the Edit or Write tool |
| 12 | Files written with CRLF on Windows by Python's `write_text` | git's warning | converted to LF |
| 13 | A unit test near the 1-second limit under coverage and machine load (perfdata at 2x) | V-U01, the new limit | the test does less work, still proving the doubling |
| 14 | No `Harness note:` lines were written in this change's build log entries | nothing, until this cycle | written below, in this cycle's build log entry |

## Root causes and recurring patterns

1. **Postgres is never exercised automatically (issues 3 and REV-002).** The tests run only on SQLite (ADR-027 keeps them off Supabase, rightly). Twice in this change a difference only Postgres shows got past every test: once to the engineer in real use, once to the review. Spec 16.2 already names this risk, and V-M08 by hand is the only check. This is the pattern most likely to recur, since every new query can differ.
2. **Weak tests exposed by probes (issue 9, four times).** The AGENTS.md probe rule from the last cycle worked: every one was caught before review. No new control is needed.
3. **Probes that prove nothing (issue 10, three times).** A probe that breaks the code in a way that crashes, or that removes a name the code needs, makes the test fail for the wrong reason. Each was caught only because the agent read the failure.
4. **Editing code through strings (issues 11 and 12, six times).** AGENTS.md "On Windows" already says inline shell strings lose backslashes and that longer scripts belong in files. The agent kept writing code through Python heredocs anyway. Each time, an existing check caught the result, but it cost a cycle every time.
5. **Harness notes not kept (issue 14).** AGENTS.md points to IMPROVE.md for them, but nothing at the moment of the catch reminds the agent, so none were written in a long change.

Seen once and already caught by an existing check or test, so no new control: issues 1, 2, 4, 5, 6, 12 and 13, and REV-001 and REV-003 (caught by the review, which is the control for them). Each has its own regression test.

## Improvements applied (on this branch, uncommitted)

All three are rules in `AGENTS.md`, since each needs judgment: none can be detected mechanically without false alarms (issue 11's results were already caught by the parsers and Prettier).

1. **Probes:** a probe counts only when its test fails for the reason it targets. Read the failure, and change only the behavior under test, not names or syntax the code needs (pattern 3).
2. **Editing code:** change code that holds backslash escapes (`\n`, `\r`, regular expressions) with the file edit tools, never by writing it through a Python or shell string. Check the file afterwards (pattern 4).
3. **Harness notes:** when a check, hook, probe or review catches your mistake, add the `Harness note:` line to the build log entry at once, in IMPROVE.md's format (pattern 5).

## Improvements proposed (for the engineer)

1. **An automatic Postgres check (pattern 1).** Run the backend tests, or at least the API's queries and the migrations, against a local, throwaway Postgres as well as SQLite. For example, a Postgres started by the test runner, and never Supabase, so ADR-027 holds. This needs the engineer: it's a new tool or service on every machine that runs `npm run check` (`docs/IMPROVE.md`, Approval). It would have caught issue 3, the GROUP BY error, before the engineer did, and it would turn REV-002 into a test. Until then, V-M08 by hand before each release stays the control.
2. **A second Supabase project for development**, already an open question in spec 16.5. It would let V-M07 and V-M08 run without touching the team's data.

## Files changed

- `AGENTS.md`: the three rules above.
- `docs/changes/mvp-multiuser/improve-1.md`: this report.
- `docs/build_logs.log`: this cycle's entry, with the harness notes for issues 1 to 14.

## Verification

- The three rules are judgment rules, so they can't be probed mechanically. Their evidence is the recorded recurrences above. The next cycle checks whether issues 10, 11 and 14 recur.
- `npm run check`, in the foreground after the change: passed, all 16 checks (538 backend, 283 frontend, 67 e2e).

## Remaining risks

- Postgres-only behavior stays untested until proposal 1 is decided or V-M08 is run (REV-002 is open).
- TLS to Supabase isn't certificate-verified (ADR-028, accepted by the engineer).
- `render.yaml` hasn't run on Render (V-M07).
