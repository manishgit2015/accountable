# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/intent.md`: what we're building
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

Update `docs/STATUS.md` when you finish a piece of work

## Checking your work

- `npm test` runs every test: the backend unit and integration tests (pytest), the frontend unit tests (Vitest), and the end-to-end tests in the installed Google Chrome (Playwright). It starts the servers itself on test ports with a temporary database, so nothing else needs to be running, and it never touches `backend/data/accountable.db`. It exits nonzero if any test fails. Run it before you say a change works, and don't claim it passed unless you ran it.
- `npm test -- backend`, `npm test -- frontend` or `npm test -- e2e` runs one suite.
- `npm run lint` checks lint, formatting and types for the backend, frontend and scripts.
- Record evidence for each task of `docs/plan.md` in `docs/build_logs.log`.
