# Plan: mvp-multiuser

Built in parts. This plan covers **part D, the database**, from the section "Part: the database" in `intent.md`. Later parts (sign-in, who added each record, search, the user menu, Render) add their own sections here.

## Part D: Supabase for real use, a local SQLite file for tests

### Files

| File | Change |
|---|---|
| `pyproject.toml`, `uv.lock` | Add `pg8000` and `python-dotenv` (ENG-5: pg8000 is the only Postgres driver here that is pure Python, so Application Control can't block it, and python-dotenv reads `.env` without our own parser) |
| `backend/app/config.py` | `Settings.database_url`, `Settings.test_mode`; `load_settings` reads `.env` only outside test mode; refuses `DATABASE_URL` in test mode, the default SQLite file in test mode, and a `DATABASE_URL` that isn't `postgresql://`; `require_database()` for a real start |
| `backend/app/db.py` | `engine_for(settings)`; the Postgres engine (pg8000, TLS without a certificate check (ADR-028), a pool of 5, 10 s timeout, 5 s `lock_timeout` as a connection option); `describe_database()` with the host only; `is_unreachable()` |
| `backend/app/main.py` | A real start needs `DATABASE_URL`; start-up uses `engine_for`; logs the database without secrets (OBS-4); clear one-line failures (REL-9); a warning in test mode |
| `backend/app/seed.py` | Loading sample data into a new database never deletes, and refuses a database that already has records (E-8) |
| `backend/app/errors.py` | A lost or unreachable database answers 503 `database_unavailable` (REL-13); a Postgres lock timeout answers 503 `busy` (REL-6) |
| `backend/app/cli.py` | seed and clear refuse when `DATABASE_URL` is set, before asking, exit 2 (R4, E-6) |
| `backend/app/perfdata.py`, `backend/migrations/env.py` | Use the same settings and engine; perfdata refuses `DATABASE_URL` |
| `scripts/run-tests.mjs` | Refuses to start when `DATABASE_URL` is set, or when `ACCOUNTABLE_TEST_DB` is a URL rather than a file; drops `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; sets `ACCOUNTABLE_TEST_AUTH_KEYS` to a random key for the run |
| `playwright.config.ts` | Refuses to start without test mode, or with `DATABASE_URL` |
| `backend/tests/conftest.py` | Refuses `DATABASE_URL`; sets test mode for direct `uv run pytest`; points `.env` at a missing file for every test |
| Tests | `test_database_choice.py` (new, V-B18) holds D1–D4's tests, and `test_perfdata.py` is adjusted. The run-tests and Playwright guards are proven by the D5 probes, recorded in the build log |
| Spec | `data.md` 6.1 and 6.3, `operations.md` DEP-1, DEP-2, runbook, `reliability.md` REL-9, `security.md` SEC-9, SEC-17, `testing.md` 13.2, V-B02, V-B12, `architecture.md` 7.1, `sample-data.md` R1, `governance.md` ADR-027, ADR-028, E-9; `docs/TECH_STACK.md`; `docs/STATUS.md` |

### Tasks

- **D1 Settings.** `load_settings` as above. Tests: test mode never reads `.env`; outside test mode `.env` is read and the environment wins; test mode with `DATABASE_URL` refuses; test mode with the default SQLite file refuses; a non-Postgres `DATABASE_URL` refuses; `require_database` names `.env` when it's missing.
- **D2 Engine.** `engine_for` builds the Postgres engine without connecting. Tests check the driver, host, pool size, overflow, pre-ping, TLS context (verifying, host name checked, CA loaded), timeout and `lock_timeout`, and that a missing CA file is a clear `ConfigError`. `describe_database` never contains the user or password.
- **D3 Start-up and errors.** A real start without `DATABASE_URL` stops with one line; an unreachable database stops with one line naming the host; new databases are seeded without deleting. While running, a lost connection answers 503 `database_unavailable`.
- **D4 Commands.** seed and clear refuse with `DATABASE_URL`, before asking, changing nothing.
- **D5 Test guards.** run-tests, Playwright and conftest as above. Probes: `DATABASE_URL=<the Supabase pooler URL from .env> npm test -- backend`, the same for `npm run check:quick`, `npm run test:perf`, the visual suite and `e2e`, and `ACCOUNTABLE_TEST_DB=postgresql://…`; each must exit nonzero before any connection. The value is passed by a script that reads it from `.env` and never prints it.
- **D6 First start on Supabase** (the engineer allowed it once). `npm run dev`, check the start-up lines (host, schema `0001`, sample data loaded), `GET /api/health` is ok, then stop. Check the tables in Supabase read-only.
- **D7 Spec, STATUS, build log; `npm run check` in the foreground.**

### Risks

- Supavisor (the session pooler) may not pass the `options` start-up parameter, so `lock_timeout` may not apply. D6 checks it read-only if a way exists without text SQL; otherwise it's recorded as open.
- The certificate isn't checked (ADR-028, the engineer's decision), so a man in the middle wouldn't be detected. Recorded in spec 16.2.
- `.env` holds `DATABASE_URL`, so on this computer `npm run seed` and `npm run clear` always refuse. That's intended (E-6).
