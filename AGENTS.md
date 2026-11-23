# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

Read `docs/spec.md` first. It describes the whole product as it stands today, and it's the authority on how the product behaves.

- `docs/spec.md`: the product (requirements, contracts, data, architecture, decisions, tests)
- `docs/changes/<branch name>/`: one folder per change, named after its git branch, with the change's `intent.md` (why, and what success looks like) and `plan.md` (how it's built and verified)
- `docs/TECH_STACK.md`: the stack
- `docs/STANDARDS.md`: the coding standards; follow them in every change
- `docs/STATUS.md`: what's done so far, how to run the app, and what's next
- `docs/REVIEW.md`: how a change is reviewed before it merges

## Working on a change

- Find the current change from the branch name (`git branch --show-current`) and read only its folder, `docs/changes/<branch name>/`. Don't read other changes' folders: they're history, and `docs/spec.md` already includes what they changed.
- A new change starts by creating its folder with an `intent.md`, then a `plan.md`.
- Update `docs/spec.md` on the change's branch, so it describes the product with the change in it by the time the change merges.
- Update `docs/STATUS.md` when you finish a piece of work.

## Checking your work

- `npm test` runs every test: the backend unit and integration tests (pytest), the frontend unit tests (Vitest), and the end-to-end tests in the installed Google Chrome (Playwright). It starts the servers itself on test ports with a temporary database, so nothing else needs to be running, and it never touches `backend/data/accountable.db`. It exits nonzero if any test fails. Run it before you say a change works, and don't claim it passed unless you ran it.
- `npm test -- backend`, `npm test -- frontend` or `npm test -- e2e` runs one suite.
- `npm run check` is the quality gate: formatting (Prettier, ruff format), lint (ESLint with the TypeScript, React Hooks and accessibility rules; ruff), a complexity limit of 15 per function, types (tsc, ty), a secrets scan (gitleaks), and `npm test` with at least 80% unit test coverage. It runs every check, prints a summary and exits nonzero if any failed. Run it before you say a change is done, and fix what it finds without weakening a rule; if a rule doesn't suit the project, ask the engineer first.
- `npm run check:quick` runs the same without the end-to-end tests, for quick feedback while working. `npm run lint` runs only the checks that aren't tests.
- `npm run format` fixes the formatting.
- Record evidence for each task of the current change's `plan.md` in `docs/build_logs.log`.
