This project will use the following high level technical stack:

1. Node.js 26, the current LTS (24 or later works) / TypeScript for the frontend, using React and Vite, in `frontend/`
2. Python 3.12 for the backend using uv, with FastAPI, in `backend/`, with `pyproject.toml` and `uv.lock` at the repo root

The frontend gets its data from the backend's JSON API. The backend keeps the data in Postgres on Supabase (the pg8000 driver), using SQLAlchemy Core with no raw SQL, and fills it with the sample data when the database is new. The tests use temporary SQLite files instead.

Prefer popular, well-supported libraries to custom code, such as for the data tables, the charts and the drag-and-drop pipeline. Don't hand-roll what a mature library does well.

Supabase provides the database, and sign-in (being built), and the app will be deployed to Render.

Commands are npm scripts in a `package.json` at the repo root, with `frontend/` as an npm workspace, so they work the same on Mac, Linux and Windows:

- `npm run dev` starts the backend and the frontend together
- `npm test` runs all the tests and fails if any test fails
- `npm run check` runs every quality check (formatting, lint, complexity, types, secrets, and the tests with coverage) and fails if any fails; `npm run check:quick` skips the end-to-end tests
- `npm run format` fixes the formatting
- `npm run seed` resets the database to the sample data
- `npm run clear` empties the database, to start with real data

Both `seed` and `clear` ask before wiping anything, and accept `--yes` to skip the question.

`docs/STATUS.md` says how to run the app. `README.md` is the course's own guide, so leave it as it is.

Testing will cover:

1. Unit tests for the frontend, using Vitest
2. Unit tests for the backend, using pytest
3. End-to-end tests of the whole app in a browser, in `e2e/`, using Playwright Test (`@playwright/test`) with the installed Google Chrome. They start the app themselves, so `npm test` needs nothing else running.

The tests use a database of their own, so running them never changes your data.

Quality tools: Prettier, ESLint (typescript-eslint, React Hooks, jsx-a11y via `eslint-plugin-jsx-a11y-x`) and tsc for the frontend; ruff and ty for the backend; Vitest's v8 coverage and pytest-cov; lefthook for the git pre-commit hook; and gitleaks for secrets, installed on the machine (`winget install Gitleaks.Gitleaks` on Windows, `brew install gitleaks` on macOS).
