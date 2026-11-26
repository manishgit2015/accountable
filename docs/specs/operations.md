# Spec: Observability, operations and deployment

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Logging, request IDs, health, the runbook, environments, configuration, first run, migrations, release, rollback and upgrading. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 12. Observability and operations

| ID | Requirement |
|---|---|
| OBS-1 | One log line per request, with time, request ID, method, path template, status and duration in milliseconds. Errors add the exception and stack trace. There's never any body or field value, token, email or name (SEC-8, SEC-18). |
| OBS-2 | Logs go to the terminal and to `backend/logs/accountable.log`, which rotates at 5 MB and keeps 3 files. The `logs/` folder is already ignored by git. On Render (where `RENDER` is set), they go to the standard output only, where Render keeps them, because its disk doesn't last between deploys. The level is set by `ACCOUNTABLE_LOG_LEVEL` (default `INFO`). |
| OBS-3 | Every response has an `X-Request-ID`. The frontend's error messages show it as "Reference: 9f2c" so the log line can be found. |
| OBS-4 | Start-up logs the address, the database (the SQLite path, or the Postgres host without the user or password), the schema version, and whether sample data was loaded |
| OBS-5 | `GET /api/health` (section 5.5) |
| OBS-6 | There are no metrics, traces or alerts, because it's a small team's app with no one on call (ADR-014). Render's own dashboard shows whether the service is up. |

### Runbook

These steps go in `docs/STATUS.md` when the app is built.

| Symptom | Action |
|---|---|
| "Port 8000 (or 5173) is already in use" | Close the other copy of Accountable, or the program using that port, and run `npm run dev` again |
| "uv not found" or "node not found" | Install them, following the documented steps |
| "Can't reach Accountable" in the browser | Check the terminal running `npm run dev`. Restart it if it stopped. |
| "Accountable is busy" | Wait a moment and try again. If it keeps happening, check nothing else has the database file open. |
| The database won't open | Stop the app, copy `backend/data/accountable.db` somewhere safe, and look in `backend/logs/accountable.log` for the error |
| Starting again from the sample data (local database) | `npm run seed` |
| Starting with real data (local database) | `npm run clear` |
| Backing up (local database) | Stop the app and copy the `backend/data/` folder, which holds the database and its `-wal` file |
| Restoring (local database) | Stop the app and put the copied files back |
| Nobody can sign in | Check `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Render's settings (or `.env`), and Supabase's status page. Look for 401s in the log. |
| Someone needs access | In Supabase's dashboard, Authentication → Users → Add user, with their email, a password and "Auto Confirm User", then their display name as `name` in the user metadata (DEP-10) |
| Someone leaves | Delete them in Supabase's dashboard. Their records stay, with their name (R114). |
| The hosted app is slow to open | The free plan was asleep: wait up to a minute (REL-14) |
| "Accountable can't reach its database" | Check Supabase's dashboard: a free project is paused after a week without use, and needs restoring there |
| A deploy failed | Read the deploy's log in Render's dashboard. The previous version keeps running until a deploy succeeds. |
| The sample data on Supabase | It stays. Once data is loaded into Supabase, nobody deletes its records: no `npm run clear` (R4), no emptying or truncating tables in Supabase's dashboard or its SQL editor, and no reseeding (E-8). |

## 14. Deployment and release design

| ID | Requirement |
|---|---|
| DEP-1 | **Environments.** *Local* is a developer's computer, using `npm run dev`, ports 8000 and 5173, and `backend/data/accountable.db`, or the Postgres database in `DATABASE_URL`, with sign-in through Supabase. *Test* is automated, using ports 8001 and 5174, a temporary SQLite database, test sign-in (SEC-17) and no network; `npm run dev:test` starts the app the same way for ui-check. *Production* is one Render web service on the free plan, with Postgres and Auth on Supabase. There's no staging environment, so a developer whose `DATABASE_URL` is the team's works on the team's data *[Assumption]*. |
| DEP-2 | **Configuration.** Needed for sign-in: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, in `.env` on this computer and in Render's settings for the hosted app. The frontend is given these two, and nothing else, when it's built or served (SEC-15). Optional: `DATABASE_URL` (the Postgres session pooler address; without it, the SQLite file), `ACCOUNTABLE_DB` (the SQLite path), `ACCOUNTABLE_API_PORT` (8000), `ACCOUNTABLE_WEB_PORT` (5173), `ACCOUNTABLE_LOG_LEVEL` (INFO) and `ACCOUNTABLE_RELOAD` (off, E-2). On Render: `PORT` (set by Render), `RENDER` (set by Render), `ACCOUNTABLE_PUBLIC_URL` (the service's own address, such as `https://accountable.onrender.com`, for SEC-2 and SEC-3) and `TZ` (the team's time zone, such as `Europe/London`, ADR-026). The test runs alone also set `ACCOUNTABLE_FIXED_NOW`, which fixes the backend clock, and `ACCOUNTABLE_TEST_AUTH_KEYS` (SEC-17); `npm run dev` never sets either, and start-up logs a warning when one is set. `ACCOUNTABLE_SCREENSHOTS=1`, read only by the visual suite, replaces the approved screenshots in `docs/changes/mvp-darkmode/`. The only secret is the database password in `DATABASE_URL` (SEC-9). |
| DEP-3 | **First run.** `predev` runs `scripts/ensure-installed.mjs`, which checks for Node 24+ and uv with a clear message if either is missing, then runs `npm install` and `uv sync` only if they haven't been run, and says which Supabase setting is missing from `.env` if one is. Then both servers start. |
| DEP-4 | **Migrations.** Alembic runs `upgrade head` on start-up, before serving requests. A new database is created by the migrations, then seeded, on Postgres as on SQLite: the first start on an empty Supabase database creates the tables and loads the sample data. Every migration works on both, never deletes rows from a database holding data (E-8), is forward-only, and is tested on a SQLite database holding data (V-B13), and checked on Postgres by hand before release (V-M08). |
| DEP-5 | **Release.** The version is kept the same in `package.json`, `pyproject.toml` and `backend/app/config.py` (`APP_VERSION`, shown by health). A release is a git tag such as `v0.1.0` with notes in `docs/STATUS.md`, made only when the releasing change's definition of done (in its plan) is met and the product owner approves. The current release is `v0.1.0`. The change `mvp-multiuser` is to be released as `v0.2.0`. |
| DEP-6 | **Rollback.** For code, check out the previous tag, or redeploy the previous version in Render's dashboard. For data, migrations don't run backwards: on a local database, the runbook tells users to copy `backend/data/` before upgrading and to restore that copy to go back (section 12); for the hosted data, the way back is restoring a Supabase backup *[Assumption: the free plan's backups are limited, section 16.2]*. The app doesn't make backups itself (section 1.3). |
| DEP-7 | **Upgrading.** Locally, pull the new version and run `npm run dev`. Hosted, Render deploys each push to the branch it follows (DEP-8). Dependencies and migrations update by themselves. |
| DEP-8 | **`render.yaml`** describes one web service on the free plan. Its build installs the npm and Python packages and builds the frontend. Its start runs the migrations, then uvicorn serving the built page and `/api` on `0.0.0.0:$PORT` (section 7.4). Its health check is `/api/health`. It lists `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ACCOUNTABLE_PUBLIC_URL` and `TZ` without values (`sync: false`), so they're entered in Render and never written in the file. |
| DEP-9 | **Running it the way Render does.** `npm run build` builds the frontend, and `npm run start` runs the migrations and one uvicorn process serving the built page and `/api`, on `127.0.0.1` and port 8000, with the settings in `.env` (AC14). |
| DEP-10 | **Adding people.** Whoever runs Accountable adds each person in Supabase's dashboard (runbook), and keeps "Allow new users to sign up" turned off in Authentication's settings (SEC-16). `uv run course/check_supabase.py` checks that sign-ups are off. |
| DEP-11 | **The hosted database** is the Supabase project's Postgres, reached through its session pooler. It starts empty, and the first start loads the sample data (DEP-4). Once data is loaded, its records are never deleted from it by a command, a migration, a script or by hand in Supabase's dashboard, and it's never reseeded (E-8). Moving data from a local SQLite file isn't supported (section 1.3). |
