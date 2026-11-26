# Spec: Engineering standards

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The ENG standards. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 15. Engineering standards

| ID | Standard |
|---|---|
| ENG-1 | **Module boundaries** as in section 7.1. In the frontend, only `src/api/` calls `fetch`, and only `src/auth/` uses the Supabase Auth client. Pages use components and hooks, and colors come only from tokens in `styles/tokens.css`: no hex or `rgba()` colors elsewhere, including in chart props, and no per-component dark-mode rules. In the backend, routers don't touch the database, and services don't import FastAPI. |
| ENG-2 | **TypeScript** in strict mode, with no `any` except at typed boundaries (with a comment). Prettier, tsc and ESLint must pass, with typescript-eslint's strict rules (which include the recommended ones), React Hooks' recommended rules and the jsx-a11y recommended accessibility rules. |
| ENG-3 | **Python 3.12** with type hints on every public function. Ruff lint and format, and the ty type checker, must pass. |
| ENG-4 | **SQLAlchemy Core** only, with no raw SQL and no ORM, as `TECH_STACK.md` sets. The one exception is the connection `PRAGMA` statements in `db.py` (E-1), which a test checks are the only text SQL. Schema changes only through Alembic. Every query and migration works on both SQLite and Postgres (ADR-020). |
| ENG-5 | **Libraries:** the ones in section 7.1 and `TECH_STACK.md`. A new dependency needs a reason in the change description, and popular, maintained libraries come before custom code. |
| ENG-6 | **Naming:** API fields in `snake_case`, TypeScript in `camelCase`, with one translation in `src/api/`. Stage keys are lowercase (`new` … `lost`). |
| ENG-7 | **Tests** go with every change, named by requirement ID (section 13.2). `npm run check` must pass before every commit to the main branch. |
| ENG-11 | **Quality gate:** `npm run check` runs formatting, lint, a cyclomatic complexity limit of 15 per function (ESLint `complexity`, ruff `C901`), types, a gitleaks secrets scan of the git history and working tree (the git-ignored `.env` is allowed), and `npm test` with 80% unit coverage. It fails if any check fails. `npm run check:quick` leaves out the end-to-end tests, and `npm run format` fixes formatting. |
| ENG-8 | **UI copy** follows section 3.9 Writing. There's no text in code that a user sees and that breaks the tone rules. |
| ENG-9 | **Changes** are small, focused commits. `docs/STATUS.md` is updated when a piece of work is finished, and this spec is updated in the same change as the behavior it describes (section 17). |
| ENG-12 | **Agent helpers:** two project subagents in `.claude/agents/`, both on Sonnet. `reviewer` reviews a branch's change with `docs/REVIEW.md` and runs the checks in its section 13C, saves its report as `docs/changes/<branch>/review-<n>.md` and returns the findings ordered by severity; it changes no other file. `ui-check` opens each page of the app started in test mode (`npm run dev:test`, SEC-17), signed in as a test person, with the Playwright MCP server, screenshots it into `.playwright-mcp/` (git-ignored), and reports what's off-brand (the `brand` skill, section 3.9) or broken; it changes no code and no app data. |
| ENG-10 | **Decision boundary:** a coding agent doesn't invent business rules, permissions, security policies or architecture. Anything this spec doesn't settle is raised with the product owner first, recorded in the change's intent or plan, and then written into this spec. |
