# Spec: Observability, operations and deployment

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Logging, request IDs, health, the runbook, environments, configuration, first run, migrations, release, rollback and upgrading. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 12. Observability and operations

| ID | Requirement |
|---|---|
| OBS-1 | One log line per request, with time, request ID, method, path template, status and duration in milliseconds. Errors add the exception and stack trace. There's never any body or field value (SEC-8). |
| OBS-2 | Logs go to the terminal and to `backend/logs/accountable.log`, which rotates at 5 MB and keeps 3 files. The `logs/` folder is already ignored by git. The level is set by `ACCOUNTABLE_LOG_LEVEL` (default `INFO`). |
| OBS-3 | Every response has an `X-Request-ID`. The frontend's error messages show it as "Reference: 9f2c" so the log line can be found. |
| OBS-4 | Start-up logs the address, the database path, the schema version, and whether sample data was loaded |
| OBS-5 | `GET /api/health` (section 5.5) |
| OBS-6 | There are no metrics, traces or alerts, because it's a single-user local app with no one on call (ADR-014) |

### Runbook

These steps go in `docs/STATUS.md` when the app is built.

| Symptom | Action |
|---|---|
| "Port 8000 (or 5173) is already in use" | Close the other copy of Accountable, or the program using that port, and run `npm run dev` again |
| "uv not found" or "node not found" | Install them, following the documented steps |
| "Can't reach Accountable" in the browser | Check the terminal running `npm run dev`. Restart it if it stopped. |
| "Accountable is busy" | Wait a moment and try again. If it keeps happening, check nothing else has the database file open. |
| The database won't open | Stop the app, copy `backend/data/accountable.db` somewhere safe, and look in `backend/logs/accountable.log` for the error |
| Starting again from the sample data | `npm run seed` |
| Starting with real data | `npm run clear` |
| Backing up | Stop the app and copy the `backend/data/` folder, which holds the database and its `-wal` file |
| Restoring | Stop the app and put the copied files back |

## 14. Deployment and release design

| ID | Requirement |
|---|---|
| DEP-1 | **Environments.** *Local* is the user's or a developer's computer, using `npm run dev`, ports 8000 and 5173, and `backend/data/accountable.db`. *Test* is automated, using ports 8001 and 5174 and a temporary database. There's no shared or hosted environment. |
| DEP-2 | **Configuration**, all optional with defaults: `ACCOUNTABLE_DB` (the database path), `ACCOUNTABLE_API_PORT` (8000), `ACCOUNTABLE_WEB_PORT` (5173), `ACCOUNTABLE_LOG_LEVEL` (INFO) and `ACCOUNTABLE_RELOAD` (off, E-2). The test runs alone also set `ACCOUNTABLE_FIXED_NOW`, which fixes the backend clock; `npm run dev` never sets it, and start-up logs a warning when it is set. `ACCOUNTABLE_SCREENSHOTS=1`, read only by the visual suite, replaces the approved screenshots in `docs/changes/mvp-darkmode/`. There are no secrets. |
| DEP-3 | **First run.** `predev` runs `scripts/ensure-installed.mjs`, which checks for Node 24+ and uv with a clear message if either is missing, then runs `npm install` and `uv sync` only if they haven't been run. Then both servers start. |
| DEP-4 | **Migrations.** Alembic runs `upgrade head` on start-up, before serving requests. A new database is created by the migrations, then seeded. Migrations are forward-only, and every one is tested on a database holding data (V-B13). |
| DEP-5 | **Release.** The version is kept the same in `package.json`, `pyproject.toml` and `backend/app/config.py` (`APP_VERSION`, shown by health). A release is a git tag such as `v0.1.0` with notes in `docs/STATUS.md`, made only when the releasing change's definition of done (in its plan) is met and the product owner approves. The current release is `v0.1.0`. |
| DEP-6 | **Rollback.** For code, check out the previous tag. For data, migrations don't run backwards, so the runbook tells users to copy `backend/data/` before upgrading and to restore that copy to go back (section 12). The app doesn't make backups itself (section 1.3). |
| DEP-7 | **Upgrading** is pulling the new version and running `npm run dev`. Dependencies and migrations update by themselves. |
