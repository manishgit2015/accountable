# Intent: sign-in, search and a user menu

## Problem

Accountable runs on one computer for one person. A team can't share it, nobody signs in, and there's no quick way to find a record.

## Proposed outcome

A small team shares one Accountable on the web. Everyone signs in and works on the same organizations, contacts and deals, and each record shows who added it. A search box in the top bar finds any organization, contact or deal. A menu under your initials holds the theme, light, dark or system, and signing out.

## Constraints

- The data lives in Postgres on Supabase, still through SQLAlchemy Core. The tests keep their own SQLite databases.
- Sign-in uses Supabase Auth with an email and password. The browser holds only the publishable key. The backend checks the token on every request and takes the user from it, never from the request.
- There's no sign-up page. People are added in Supabase's dashboard.
- The settings live in .env as DATABASE_URL, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
- Each organization, contact, deal and activity records who added it and who last changed it.
- The end-to-end tests and ui-check sign in without anyone's real password and never touch Supabase. CI needs no secrets.
- Search ignores case and works the same on SQLite and Postgres.
- The theme moves from the dark mode button into the menu. System follows the device's setting.
- Accountable now needs an internet connection, for Supabase. The tests still run without one.
- The app deploys to Render's free plan as one web service: FastAPI serves the built frontend and the API, migrations run when it starts, and it answers at its onrender.com address. A render.yaml describes it, with the Supabase settings entered in Render, not written in the file.
- Every unit test, old and new, runs in under a second on this computer, because CI runs on a much slower machine.
- No new dependencies unless the plan makes the case for one.

## Decisions (the engineer, 26 Nov 2026)

- **The folder** is `docs/changes/mvp-multiuser/`, named after the branch.
- **How a person is shown:** by their display name, set in Supabase's dashboard as user metadata, or by their email when no name is set. The initials on the menu come from the name, or from the email's first letter when there's no name. "Who added it" and "who last changed it" show the same.
- **`npm run seed` and `npm run clear` are local only.** They refuse to run against Supabase, and still work on a local SQLite file, so nobody can replace or wipe the team's shared data from the command line. Supabase gets the sample data the way a new database does today (R4): the first start on an empty database loads it.
- *Assumption, to confirm in the plan:* sample records show "Sample data" as who added them.

## Not in this change

- Roles and permissions: everyone can do everything.
- Moving the data in the local SQLite file to Supabase. Supabase starts with the sample data.
- Signing in with Google, magic links or a password reset.

## Success criteria

1. npm run check passes and never touches Supabase, with or without the settings in .env.
2. Signed out, every page shows the sign-in screen and every API route refuses. Signed in, everything works as before.
3. Every record and activity shows who added it.
4. Search finds an organization, a contact and a deal by part of a name, in any case.
5. The menu's theme choice is remembered, and System follows the device's setting.
6. The built app runs on this computer the way Render runs it, signed in against Supabase.

## Part: the database (Supabase for real use, a local SQLite file for tests)

Added 27 Nov 2026, with the engineer's answers. Its plan is `plan.md` in this folder. Sign-in, search and the user menu come in later parts.

**Problem.** Nothing reads `DATABASE_URL` yet: `config.py` reads only `ACCOUNTABLE_DB`, `db.py` builds only a SQLite engine, and the app never reads `.env`. The tests are safe today only because of that. Once the app reads `.env`, a test run could reach the team's data unless every test path refuses to.

**Outcome.** Every start for real use (`npm run dev`, and later `npm run start` and Render) connects to the team's Postgres on Supabase from `DATABASE_URL`. Every test and validation path (`npm test`, `npm run check`, `npm run check:quick`, `npm run test:perf`, the visual suite and the Stop hook's checks) uses only a temporary local SQLite file, and refuses to start if it's pointed at Supabase.

**Decisions (the engineer, 27 Nov 2026)**

- **This is part of `mvp-multiuser`**, not a change of its own.
- **Any start that isn't a test needs Supabase.** `npm run dev` refuses to start without `DATABASE_URL`, with no fallback to the SQLite file. SQLite stays for the tests, and for `npm run seed` and `npm run clear`, which work only on a local SQLite file (E-6).
- **"Started for real use" means started without test mode.** Test mode is `ACCOUNTABLE_TEST_AUTH_KEYS` being set (SEC-17), which only the test runs set. In test mode the app never reads `.env` and refuses `DATABASE_URL`. Sign-in itself comes in a later part.
- **The settings come from `.env`** on this computer (and from Render's settings later). A variable already set in the environment wins over `.env`.
- **The driver is pg8000.** It's pure Python, so Windows Application Control has no DLL to block. `python-dotenv` reads `.env`. The engineer's own uncommitted additions to `pyproject.toml` (`supabase`, `flask`, `dotenv`) are left as they are.
- **TLS without a certificate check** (changed by the engineer later on 27 Nov 2026): the connection is encrypted, no CA file is needed, and the database password is the protection. *Replaced:* TLS is verified against Supabase's CA certificate. The engineer downloads it to `backend/certs/supabase-ca.crt` (it's public, not a secret). The backend checks the certificate and the host name, and refuses to connect otherwise.
- **When Supabase can't be reached:** start-up stops with one clear line (REL-9). While the app runs, requests answer 503 `database_unavailable` (REL-13).
- **First start on Supabase:** the agent may start the app against Supabase once, which creates the tables and loads the sample data into the empty database (R4, DEP-4). After that, nothing deletes its records (E-8).

**Success criteria**

1. With `DATABASE_URL` in `.env`, `npm run dev` connects to Supabase over TLS, and logs the Postgres host without the user or password.
2. A probe that points a test run at the Supabase URL fails before any connection is made, for each test path.
3. `npm run seed` and `npm run clear` refuse when `DATABASE_URL` is set, before asking.
4. `npm run check` passes, run in the foreground.
