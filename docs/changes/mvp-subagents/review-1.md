# Review 1

**This reviews commit ca5db24 "Deploy: harness improved" (Edward Donner, 5 Nov 2026), not the mvp-subagents branch.** The commit is not on this branch and was not checked out. It was read with `git show ca5db24` (base `ca5db24^`), with every input read as it was at that commit. The engineer chose to save this report here.

## A. Summary

- Change: ca5db24, base ca5db24^. Its change folder is `docs/changes/invoices/` (the commit's own STATUS section is "Invoices: harness improved").
- Files reviewed (7, all read in full): `docs/IMPROVE.md`, `docs/STATUS.md`, `docs/specs/architecture.md`, `docs/specs/testing.md`, `frontend/vite.config.ts`, `scripts/checks.mjs`, `scripts/vite-watch.test.mjs` (new).
- What it does: the test runs' Vite servers watch no files (`ACCOUNTABLE_VITE_WATCH=off` gives `server.watch: null`), so a file saved mid-run can't reload a page mid-test. It adds a unit test for this, spec text, and two Seen once entries and one new search step in IMPROVE.md.
- Inputs at the commit:
  - Present: `docs/REVIEW.md`, `docs/spec.md` and `docs/specs/*`, `AGENTS.md`, `docs/STANDARDS.md`, `docs/changes/invoices/intent.md` and `plan.md`, `docs/STATUS.md`.
  - **Missing: `docs/build_logs.log` and `docs/evidence/` don't exist at that commit.**
  - The only record of the checks is the commit's own STATUS text.
- `docs/REVIEW.md` at that commit is a 21-line policy with five passes (bugs, security, matches spec and plan, described by the spec, follows STANDARDS) and two severities (Important, nit). It has no sections 13A to 13E, no P0 to P2 and no check list. I followed its passes and mapped the severities to this report's format: Important is P0 or P1, a nit is P2.
- Overall status: nothing blocking. Two minor findings.

## B. Findings

REV-001  P2  Matches the spec and plan
- Location: `scripts/checks.mjs:233`, `scripts/vite-watch.test.mjs`
- Issue: the new test serves a folder with the app's Vite config and `ACCOUNTABLE_VITE_WATCH` set by the test itself. It proves the config honours the variable. Nothing proves that `startRun` in `checks.mjs` sets it, or that the e2e servers receive it.
- Evidence: the test calls `vi.stubEnv("ACCOUNTABLE_VITE_WATCH", watch)`. Deleting the `ACCOUNTABLE_VITE_WATCH: "off"` line in `checks.mjs` leaves this test green. `testing.md` claims "the run sets `ACCOUNTABLE_VITE_WATCH=off`". The probe recorded in STATUS removed the setting from a copy of the config, not from `checks.mjs`.
- Impact: the actual fix could be dropped silently, and the mid-run reload flake would come back.
- Recommendation: add a check that the env `startRun` builds contains `ACCOUNTABLE_VITE_WATCH=off`, for example in `test-plan.test.mjs` or `test-runs.test.mjs`, or export the env builder and assert on it.
- Requirement: `docs/specs/testing.md`, the new bullet.
- Disposition: Open

REV-002  P2  Described by the spec
- Location: `docs/specs/testing.md:115`, `e2e/helpers.ts:249-255`
- Issue: the spec says the tests' Vite servers, "copies included", watch no files. The copies started by `copyEnv` get this only because they spread `process.env` from the run. A test that starts a copy outside `npm run check`, such as `npm run e2e` run directly, relies on the same inheritance. Neither the spec nor any test says or checks so.
- Evidence: `copyEnv` sets `ACCOUNTABLE_VITE_CACHE` explicitly but not `ACCOUNTABLE_VITE_WATCH`, and no test covers a copy.
- Impact: low. It is true today, but a change to `copyEnv` that stops spreading `process.env` would break the claim unnoticed. This is the same gap as REV-001.
- Recommendation: set it in `copyEnv` as well, or have the test from REV-001 cover copies.
- Requirement: `docs/specs/testing.md`, "copies included".
- Disposition: Open

No P0 or P1 findings. The code is small and correct: `watch: null` is only spread when the variable is `off`, so `npm run dev` is unchanged. The test cleans up its temporary folders and servers. The spec, `architecture.md`'s file list and the STATUS text agree with the code. No secrets, and nothing reads `.env`.

## C. Verification status

None of these could be verified. They run on this working tree (mvp-subagents), which doesn't contain ca5db24, and I was told not to check the commit out.

| Check | Command | Result |
|---|---|---|
| Quality gate | `npm run check` | Couldn't be verified (wrong tree). The commit's STATUS says it "passes: 4,939 tests in 6m 26s", and says the new `vite-watch.test.mjs` failed with the setting removed from a copy of the config and passed 10 of 10 with it. These are the author's claims, with no build log or evidence file to back them. |
| Audit | `npm run audit` | Couldn't be verified (wrong tree). The commit records nothing. |
| Speed tests | `npm run test:perf` | Not run. Not called for: the change touches no runtime code path. |
| Visual suite | `node scripts/run-tests.mjs visual` | Not run. Not called for: no UI change. |

## D. Outstanding risks

- No build log or evidence at that commit, so the probes and the 4,939-test run rest on STATUS text alone.
- The commit's STATUS still lists the Invoices review's nits and the unread part of that review as open. The commit says the merge needs a manual keep of both sides (`bills`, `quotes`) in IMPROVE.md, AGENTS.md and `testing.md`. That merge conflict risk is outside this diff.
- With `watch: null`, the tests' servers never see a changed file. That is intended, but a test that depends on HMR or a changed file would pass or fail for the wrong reason. None exists now.

## E. Decision

PASS. This is a recommendation only, and the engineer decides. There are two P2 notes, and neither blocks the change. Several checks couldn't be verified here (section C).
