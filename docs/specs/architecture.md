# Spec: Architecture and integrations

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Components, interactions, boundaries, runtime, and external dependencies. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 7. Solution architecture

### 7.1 Components

```
 Development (npm run dev)
 Browser (React app) ──HTTP──▶ Vite dev server 127.0.0.1:5173 ──proxy /api──▶ FastAPI 127.0.0.1:8000 ──TLS──▶ Postgres on Supabase
                                                                                                          (DATABASE_URL, required)
 seed / clear CLI ──▶ local SQLite file only (refuse when DATABASE_URL is set)
 Tests (npm test, check, test:perf, visual) ──▶ a temporary SQLite file only, in test mode (refuse DATABASE_URL)

 Hosted (Render, one web service)
 Browser (React app) ──HTTPS──▶ FastAPI on Render: the built page and /api ──TLS──▶ Postgres on Supabase (session pooler)

 Both
 Browser ──HTTPS──▶ Supabase Auth (sign in, renew the token; publishable key only)
 FastAPI ──HTTPS──▶ Supabase Auth's public signing keys (cached)
```

| Component | Responsible for | Not responsible for |
|---|---|---|
| **React app** (`frontend/`) | Screens, forms, client-side checks for fast feedback, table search, sort and paging, optimistic pipeline moves with rollback, formatting, the sign-in screen, the user menu, the top-bar search, and signing in through the Supabase Auth client with the publishable key | Anything authoritative: final validation, stage rules, search results, who did what and dashboard figures all come from the API |
| **Vite dev server** | In development only: serving the app and proxying `/api` to the backend, so the browser sees one origin | Business logic |
| **FastAPI routers** (`app/routers/`) | HTTP only: parsing, the error format, status codes, origin checks, and on Render serving the built page | SQL or business rules |
| **Auth** (`app/auth.py`) | Checking each request's token against Supabase's public signing keys, and turning it into the signed-in person, for every route but health (SEC-13, SEC-14) | Signing people in, which Supabase does |
| **Services** (`app/services/`) | Use cases and transactions (one per request): CRUD, move, delete impact, timelines, dashboard, search, and keeping the `users` table current | HTTP details |
| **Rules** (`app/rules.py`) | Pure functions: probabilities, late check, close-date and customer rules, positions | Input and output |
| **Data layer** (`app/db.py`) | The engine for SQLite or Postgres, connection settings, table definitions. SQLAlchemy Core only, no raw SQL. | Business logic |
| **Migrations** (`backend/migrations/`) | Alembic scripts, run on startup | Data seeding |
| **Seed and CLI** (`app/seed.py`, `app/cli.py`) | Sample data for a new database, and the reset and empty commands for a local one, through the services and data layer | Running the server |
| **Launcher** (`scripts/ensure-installed.mjs`, root `package.json`) | First-run installs, starting both servers, printing the address, and building and starting the app the way Render does (`npm run build`, `npm run start`) | App behavior |
| **Render service** (`render.yaml`) | How Render builds the app and starts it, as one web service (DEP-8) | Holding settings, which are entered in Render |

### 7.2 Interactions

- Reads go through TanStack Query, which caches them and refetches when a window regains focus.
- After any save, the queries that depend on it are refetched: the list, the record, timelines and the dashboard.
- A pipeline drop updates the board's cache straight away, calls `/move`, and on failure puts the cache back as it was (R64).
- Every API request carries the access token. The Supabase Auth client renews it before it runs out, and a 401 shows the sign-in screen (R108).
- A top-bar search cancels the one before it, so only the latest text's results are shown.

### 7.3 Boundaries

- The browser talks to `/api` on its own origin, and to Supabase Auth to sign in and renew its token, with the publishable key only.
- Only the backend and the CLI touch the database, and the CLI only a local SQLite file (R4).
- The only outbound calls at runtime are to Supabase: from the browser to Supabase Auth, and from the backend to Postgres and to Supabase Auth's public signing keys (section 8).

### 7.4 Runtime

In development, Accountable runs as the two development servers started by `npm run dev` (ADR-010). Uvicorn runs without reload by default; `ACCOUNTABLE_RELOAD=1` turns reload on for development (E-2).

Hosted, Render runs it as one web service (ADR-021): the frontend is built when deploying, and one uvicorn process serves the built page and `/api`, listening on `0.0.0.0` on the port Render gives it in `PORT` (SEC-1). Migrations run when it starts (DEP-4). `npm run build` then `npm run start` runs the same thing on this computer, on `127.0.0.1` (AC14).

## 8. Integration design

| Dependency | When | Protocol | Notes |
|---|---|---|---|
| npm registry, PyPI | First run and each Render build (`npm install`, `uv sync`) | HTTPS | Versions are pinned by `package-lock.json` and `uv.lock`. No packages are fetched at runtime. |
| Google Chrome | Tests only | Playwright | Uses the installed Chrome (`channel: "chrome"`) |
| Supabase Postgres | At runtime, when `DATABASE_URL` is set | Postgres over TLS, through the session pooler | The team's data (ADR-020). Never used by the tests (section 13.2). |
| Supabase Auth | At runtime | HTTPS | Signing in and renewing tokens from the browser, with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and the public signing keys the backend checks tokens with (ADR-023). Never used by the tests. |
| Render | Hosting | HTTPS | One web service on the free plan, described by `render.yaml`, at its onrender.com address (ADR-021, DEP-8) |
| Email, calendar, phone | Not used today | (none) | Out of scope (section 1.3) |

There are no other external systems, no webhooks and no telemetry. The only outbound calls at runtime are to Supabase. The end-to-end tests make none at all, which V-E00 checks on every test.
