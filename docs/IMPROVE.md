# Improving the harness

How the coding-agent harness (`AGENTS.md`, `docs/REVIEW.md`, the checks in `npm run check`, the hooks, and the skills in `.claude/skills/`) is improved from evidence. Run it after a review, or when a change needed human correction.

## Evidence

Use only what is recorded. Don't infer a failure or a recurrence that isn't in one of these:

- the latest review report, in the change's folder (`docs/changes/<branch name>/review-<n>.md`, REVIEW.md 12) or, for earlier changes, in `docs/reviews/`, and the state of each finding on the branch
- `docs/build_logs.log`: defects, failed checks, and the harness notes below
- human corrections: what the engineer changed, refused or asked for again
- check and hook output, and CI results if there ever is CI (there is none today)

## Harness notes

When a check, a hook or a review catches something the agent got wrong, add a line to the current task's build log entry:

`Harness note: <what went wrong> - caught by <check, hook, review, engineer or nothing> - <fixed how>`

Without these notes, a mistake that is caught and fixed leaves no trace, and the next cycle can't tell whether it recurs.

## Choosing a control

For each problem, pick the smallest control that would have stopped it, in this order:

1. a regression test, when the behavior can be tested
2. a deterministic check or hook, when the problem can be detected mechanically
3. a rule in `AGENTS.md` or `docs/REVIEW.md`, or a skill, when it needs judgment
4. a proposed change to `docs/STANDARDS.md` or the spec, when policy has to change

Prove each new control with the failure it targets (a probe that must fail, then pass once it's removed), and check that `npm run check` still passes. A problem seen once, and already caught by an existing check, usually needs no new control.

## Approval

The agent may change `AGENTS.md`, `docs/REVIEW.md`, checks, tests and hooks on a change branch. These need the engineer first: `docs/STANDARDS.md`, permission settings, new external services (such as CI), and any product fix. All harness changes are reviewed like code, and only the engineer merges.

## Output

A harness improvement report (issues, root causes, recurring patterns, applied and proposed improvements, files changed, verification evidence, remaining risks), and a build log entry with the same evidence. If nothing is justified, say so instead of adding rules.
