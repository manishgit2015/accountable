# Intent: one quality gate for every change

## Why

Lint, formatting, types and tests each have their own command today, and nothing checks complexity, backend types, secrets or coverage. An agent or a person can say a change works without having run all of them. The review found the coverage target had no command enforcing it (REV-003).

## What

- `npm run check` runs every check and fails if any of them fails:
  - Prettier and ESLint for the frontend, with the recommended TypeScript, React Hooks and accessibility rules
  - ruff format and ruff check for the backend
  - a cyclomatic complexity of at most 15 per function (ESLint `complexity`, ruff `C901`)
  - tsc for the frontend, ty for the backend
  - gitleaks across the repo (history and working tree), allowing the git-ignored `.env`
  - `npm test`, with unit test coverage of at least 80%
- `npm run check:quick` runs the same checks without the end-to-end tests.
- `npm run format` fixes the formatting.
- What the checks find is fixed in the code, without weakening any rule. A rule that doesn't suit the project is raised with the engineer first.
- `AGENTS.md` tells agents to run `npm run check`.

## Success looks like

- `npm run check` passes on this branch, and its output is shown to the engineer.
- Breaking any one check makes `npm run check` exit nonzero.
- No rule is switched off or loosened, and no `eslint-disable`, `noqa` or `type: ignore` is added to get a pass.
