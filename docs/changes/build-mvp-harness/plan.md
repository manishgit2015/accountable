# Plan: one quality gate for every change

Intent: `intent.md` in this folder. Evidence for each task goes in `docs/build_logs.log`.

## Tasks

| Task | What | Verified by |
|---|---|---|
| H1 | Tools: `eslint-plugin-jsx-a11y-x` (the maintained fork of `eslint-plugin-jsx-a11y`; the original doesn't support ESLint 10 yet) and `@vitest/coverage-v8` in the frontend; `ty` in the backend dev group; gitleaks as a system tool. The fork's `minimatch` is overridden to a version without the moderate advisory. | `npm audit` finds 0 vulnerabilities; `uv run ty --version` |
| H2 | Rules: jsx-a11y recommended on `.tsx`, `complexity: 15` in `frontend/eslint.config.js`; `C901` with `max-complexity = 15` in `pyproject.toml`; ty over `backend/`; `.gitleaks.toml` (default rules, the `.env` file and installed or generated folders allowed). | Each check runs in `npm run lint` |
| H3 | Fix what the rules find: ty's type errors (context manager return types, SQLAlchemy `Select` generics, Pydantic error types, test helpers), four React components over complexity 15 (form starting values and the shared `FormActions`, `Column` split into its header and closed-stage footer), and the draggable deal's role and tabIndex stated for the a11y rules. No behaviour change. | `npm run lint` passes; `npm test` passes |
| H4 | Coverage: pytest-cov with branches (`[tool.coverage]` in `pyproject.toml`) and Vitest v8 coverage over every source file (`vitest.config.ts`), both failing under 80%. `npm test -- --coverage` turns it on; `npm test -- unit` runs pytest and Vitest only. | Coverage report in the check output |
| H5 | Frontend unit tests for the pages, forms and components that only e2e tests covered, to reach 80% on every metric. Shared helpers in `frontend/src/test/app.tsx`. | Vitest coverage summary |
| H6 | `scripts/check.mjs` and the npm scripts `check`, `check:quick` and `lint` (static checks only). Every check runs even after a failure, then a summary prints and the exit code is 1 if any failed. | `npm run check` output |
| H7 | Docs: `AGENTS.md`, `docs/spec.md` (13.2, 15, 17.1), `docs/TECH_STACK.md`, `docs/STATUS.md`. | Read through |
| H8 | Hooks: lefthook pre-commit (`lefthook.yml`: format staged files, then ESLint, tsc, ruff check, ty, gitleaks on staged changes; no tests); Claude Code Stop hook running `npm run check:quick` that blocks once (`stop_hook_active`); Claude Code PreToolUse hook blocking `.env` edits by file tools and shell commands. | Commits refused on bad input; pipe tests of both scripts; live blocked shell write to `.env` |

## Decisions

- Coverage thresholds apply to lines, statements, functions and branches, the strictest reading of "80%".
- The frontend's coverage counts every file in `src/` except tests, test helpers and `main.tsx` (which only mounts the app), so untested pages count against it.
- gitleaks scans both the git history and the working tree. The `.env` file is allowed only while git ignores it, and the check fails if it stops being ignored.
