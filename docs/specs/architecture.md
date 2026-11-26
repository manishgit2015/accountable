# Spec: Architecture and integrations

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Components, interactions, boundaries, runtime, and external dependencies. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 7. Solution architecture

### 7.1 Components

```
 Browser (React app)  ──HTTP──▶  Vite dev server 127.0.0.1:5173  ──proxy /api──▶  FastAPI 127.0.0.1:8000
                                                                                     │
                                          seed / clear CLI ──────────────────────────┤ shared db layer
                                                                                     ▼
                                                                         SQLite file (WAL)
```

| Component | Responsible for | Not responsible for |
|---|---|---|
| **React app** (`frontend/`) | Screens, forms, client-side checks for fast feedback, table search, sort and paging, optimistic pipeline moves with rollback, formatting | Anything authoritative: final validation, stage rules and dashboard figures all come from the API |
| **Vite dev server** | Serving the app and proxying `/api` to the backend, so the browser sees one origin | Business logic |
| **FastAPI routers** (`app/routers/`) | HTTP only: parsing, the error format, status codes, origin checks | SQL or business rules |
| **Services** (`app/services/`) | Use cases and transactions (one per request): CRUD, move, delete impact, timelines, dashboard | HTTP details |
| **Rules** (`app/rules.py`) | Pure functions: probabilities, late check, close-date and customer rules, positions | Input and output |
| **Data layer** (`app/db.py`) | Engine, connection settings, table definitions. SQLAlchemy Core only, no raw SQL. | Business logic |
| **Migrations** (`backend/migrations/`) | Alembic scripts, run on startup | Data seeding |
| **Seed and CLI** (`app/seed.py`, `app/cli.py`) | Sample data, and the reset and empty commands, through the services and data layer | Running the server |
| **Launcher** (`scripts/ensure-installed.mjs`, root `package.json`) | First-run installs, starting both servers, printing the address | App behavior |

### 7.2 Interactions

- Reads go through TanStack Query, which caches them and refetches when a window regains focus.
- After any save, the queries that depend on it are refetched: the list, the record, timelines and the dashboard.
- A pipeline drop updates the board's cache straight away, calls `/move`, and on failure puts the cache back as it was (R64).

### 7.3 Boundaries

- The browser only ever talks to `/api` on its own origin.
- Only the backend and the CLI touch the database file.
- No component makes outbound network calls at runtime (section 8).

### 7.4 Runtime

Accountable runs as the two development servers started by `npm run dev` (ADR-010). Uvicorn runs without reload by default; `ACCOUNTABLE_RELOAD=1` turns reload on for development (E-2). The default user command is `npm run dev`, as `TECH_STACK.md` sets.

## 8. Integration design

| Dependency | When | Protocol | Notes |
|---|---|---|---|
| npm registry, PyPI | First run only (`npm install`, `uv sync`) | HTTPS | Versions are pinned by `package-lock.json` and `uv.lock`. Nothing is fetched at runtime (R2). |
| Google Chrome | Tests only | Playwright | Uses the installed Chrome (`channel: "chrome"`) |
| Supabase, Render | Not used today | (none) | Named in `TECH_STACK.md` for later. Keeping database access behind `db.py` and the services keeps that move contained. |
| Email, calendar, phone | Not used today | (none) | Out of scope (section 1.3) |

There are no other external systems, no webhooks and no telemetry. The app makes no outbound calls at runtime, which V-E00 checks on every end-to-end test.
