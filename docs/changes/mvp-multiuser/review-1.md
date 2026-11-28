# Review 1: mvp-multiuser

Reviewer: the reviewer subagent, 28 Nov 2026. This is a recommendation, not an approval.

## A. Summary

- **Branch and base:** `mvp-multiuser` against `main`. `main` is far behind: the branch also carries earlier merged-in work. I reviewed the multi-user change itself, `1dbd73c..HEAD` (157 files). That range starts at the intent commit's parent, after the dark-mode change.
- **Files read in full or in the relevant part:** `backend/app/{auth,config,db,errors,main,people,cli,perfdata,seed}.py`, `routers/{me,search,sign_in_for_tests}.py`, `services/{records,moves,timeline,dashboard,search}.py`, `migrations/env.py`, `migrations/versions/0002_people.py`, `backend/tests/test_auth.py`, `frontend/src/{lib/session.ts,api/client.ts,App.tsx,api/testSignIn.ts}`, `frontend/vite.config.ts`, `scripts/check-bundle.mjs`, `render.yaml`.
- **Spec and plan:** `docs/specs/{users,search,security,api,governance}.md` (R100–R125, SEC-13–SEC-18, ADR-021–ADR-028, section 17.1), and `plan.md` phases 0–8 and its risks. I did not read other changes' folders.
- **Inputs:** `intent.md` and `plan.md` are present. Phase 6 is not built. Spec 17.1 states this accurately (R111–R113, R120–R124, AC11, AC12), so the engineer's choice is documented and I raise no finding for it. `docs/build_logs.log` has 42 mentions of probes. I did not audit each probe. `docs/evidence/2026-11-28-mvp-multiuser/` holds V-M04's screenshots. I did not view them, because the visual suite was not run.
- **Overall status:** the backend and the tests are in good shape. One credible P1 on the new sign-in boundary (REV-001) blocks the merge. Migration 0002 and the Postgres paths have never been proven on Postgres, which is a known verification gap (V-M07 and V-M08).

## B. Findings

REV-001  P1  Security / Reliability
Location: backend/app/auth.py:75-85 (`TokenChecker._key` and `_refresh`)
Issue: every request whose token names an unknown `kid` makes the backend fetch Supabase's key set again, inside `self._lock`, with a 5-second timeout, with no limit on how often. `_fetched_at` is set only when a fetch succeeds. So while Supabase's key endpoint is slow or unreachable, `stale` stays true and every request, even one with a valid token, tries the fetch again.
Evidence: `if stale or kid not in self._keys: with contextlib.suppress(OSError, ValueError): self._refresh()`. The `kid` is read from the unverified header (`jwt.get_unverified_header(token)`), so anyone can choose it. They don't need to sign anything. `fetch_jwks` uses `urlopen(..., timeout=FETCH_TIMEOUT_S)` with `FETCH_TIMEOUT_S = 5`. The lock serializes the fetches, so N unsigned requests with random `kid`s hold the lock for up to N×5 s. Sync routes run in a threadpool of about 40, so signed-in people's requests queue behind the lock and the app stops answering. The tests (`test_auth.py:223-243`) cover a rotated key and an unreachable Supabase for one call each. None checks that repeated unknown-`kid` requests, or repeated failures, stay bounded.
Impact: on Render the app is public, and 401 is the only barrier. An unauthenticated caller can make the app unusable for the whole team, and can turn it into a stream of outbound requests to Supabase. If Supabase is down, valid cached tokens also stall for 5 s per request after the first 10 minutes. SEC-13 asks for a fetch for an unknown key, but not an unbounded one (REL-4 bounded timeouts, and spec 7 asks for no unbounded retries).
Recommendation: record the time of each attempt, successful or not. Refetch for an unknown `kid` at most once per short interval (for example 30–60 s), and don't hold the lock during the network call. Reject a `kid` that was already refused in that interval without fetching. Add tests for N unknown-`kid` tokens causing one fetch, and for repeated failure causing one attempt per interval.
Requirement: SEC-13, ADR-023, REL-4
Disposition: Open

REV-002  P2  Verification / Production readiness
Location: backend/migrations/versions/0002_people.py; docs/changes/mvp-multiuser/plan.md:110-111
Issue: no test runs migration 0002 or any of the new SQL on Postgres. Tests use SQLite only (ADR-027). The Postgres paths are the `upsert_user` dialect branch, `literal_execute` in the dashboard (V-B19), the batch `alter_column(nullable=False)` and `create_foreign_key`, and the `activities` backfill. `render.yaml` starts the app with `python -m app.main`, which runs `upgrade_to_head` at every start. The first Render deploy therefore applies 0002 to the team's data with nothing but the engineer's backup to rely on. V-M07 and V-M08 are not done.
Evidence: the plan lists V-M08 as "migration 0002 on the data already there, with a backup first". It is still open. The migration is additive and Postgres DDL is transactional, so a failure should leave the database unchanged, but that is untested.
Impact: if 0002 fails on Postgres, the deployed app will not start. If it succeeds with a wrong result, the data is not rolled back and nothing catches it. E-8 forbids deleting the team's data, and the migration is built to avoid it, but it is not proven.
Recommendation: before the Render deploy, run V-M08 on a copy or a scratch Postgres (a local container or a second Supabase project) loaded with `0001` data, then on Supabase after a backup. Record the result in the build log. Don't merge to a deploy branch until then.
Requirement: DEP-4, REL-9, E-8, V-M07, V-M08
Disposition: Open

REV-003  P2  Reliability
Location: backend/app/main.py:129-141 (`prepare_database`)
Issue: migrating and loading the sample data are two separate transactions. Sample data loads only when `before is None`. If the process stops, or the seed fails, after migration 0001 has committed, the next start sees `before is not None` and never loads the sample data. The database stays empty, and the first-start behavior of R4 is lost. Two instances starting at the same time (Render overlapping deploys) can both read `before is None` and both migrate.
Evidence: `before, after = upgrade_to_head(engine)` commits inside `upgrade_to_head`. `load_sample_data` then runs in a new `transaction(engine)`.
Impact: low and recoverable. No data is lost, and an empty team database can be filled by hand. But `NotEmptyError` shows the intent to make first start safe, and this edge isn't covered.
Recommendation: document it in the runbook, or seed inside the migrating connection. A start-up lock is not needed for a team this size.
Requirement: R4, DEP-4, REL-9
Disposition: Open

## C. Verification status

| Check | Command | Result |
|---|---|---|
| Quality gate | `npm run check` | Run, passed: all 16 checks (Prettier, ESLint, tsc, ruff, ty, gitleaks, change folder, no skipped tests, frontend build, built-bundle secret scan, all tests with the coverage gates). Backend, core coverage, frontend and 67 end-to-end tests passed. |
| Security | `npm run audit` | Run, passed: 0 npm vulnerabilities, no known Python vulnerabilities. The V-S cases are inside `npm test`, which passed. |
| Performance | `npm run test:perf` | Run, passed: perfdata and 4 perf tests. The Deals search key press measured p95 45 ms against the 100 ms threshold. |
| Visual comparisons | `node scripts/run-tests.mjs visual` | Not run. The change touches styles, but the visual suite depends on the machine. V-M04's screenshots are in `docs/evidence/2026-11-28-mvp-multiuser/`, and I did not view them. |
| Against Supabase / Render | V-M07, V-M08 | Not run, as instructed. Couldn't be verified. |

## D. Outstanding risks

- Migration 0002 and every Postgres-only path (REV-002) have no run on Postgres. V-M07 and V-M08 are open, and `npm run check` cannot reach Supabase by design.
- TLS to Supabase does not check the server's certificate (ADR-028, spec 16.2, the engineer's recorded choice). The password is encrypted, but a man in the middle is not detected. Accepted by the engineer, so I raise no finding.
- Phase 6 is missing. Success criteria 3 and 4 of the first section are not met, and spec 17.1 and `intent.md` say so.
- List order by `lower(name)` uses the database's collation. SQLite and Postgres may order accented or mixed-case names differently. R125 promises sameness only for search, which is done in Python, so this is not a finding.
- Render listens on `0.0.0.0` when `RENDER` is set, outside test mode (SEC-1 is changed for Render only). Host and Origin checks add the public address. I found nothing wrong, but nobody has run it on Render.

## E. Decision

**CHANGES REQUIRED.** REV-001 (P1) is open: an unauthenticated request can make the app stop answering. REV-002 and REV-003 are P2 and don't block. After REV-001 is fixed, review it again, and run V-M08 before the first deploy.
