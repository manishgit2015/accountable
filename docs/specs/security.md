# Spec: Security and privacy

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The SEC requirements and the negative security cases. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 10. Security and privacy

Accountable is on the web, so everyone signs in (section 3.11), every API route but health checks the token, the person comes only from the token, and the browser holds no secret. On this computer it still listens on `127.0.0.1` only.

| ID | Requirement |
|---|---|
| SEC-1 | On this computer, both development servers, and `npm run start`, listen on `127.0.0.1` only, never `0.0.0.0` (ADR-002). The Vite proxy targets `http://127.0.0.1:8000` by address, not by `localhost`. On Render, the one service listens on `0.0.0.0` on `PORT`, and is reached only through Render's HTTPS address. |
| SEC-2 | The backend refuses any request whose `Host` header isn't `127.0.0.1` or `localhost` on the API or web port, or, on Render, the host of `ACCOUNTABLE_PUBLIC_URL` (DEP-2), with 403. This guards against DNS rebinding. Vite's own allowed-hosts check stays at its local-only default. |
| SEC-3 | A changing request (POST, PATCH, DELETE) whose `Origin` header isn't the app's own (`http://127.0.0.1:5173` or `http://localhost:5173`, the test ports, or on Render `ACCOUNTABLE_PUBLIC_URL`) is refused with 403. No CORS headers are sent, so other websites can't read responses. |
| SEC-4 | Authentication is Supabase Auth with an email and password (R102). There's no authorization beyond being signed in: everyone can do everything (R115). There's no sign-up, so only people added in Supabase's dashboard can sign in (SEC-16). |
| SEC-5 | Every query goes through SQLAlchemy Core with bound parameters. There's no raw SQL or string-built queries; the only text SQL is the connection `PRAGMA` statements in `db.py` (E-1). |
| SEC-6 | User text is always shown as text. React escaping is used, with no `dangerouslySetInnerHTML`. Websites become links only for `http` and `https`, open in a new tab with `rel="noopener noreferrer"`, and any other scheme is refused on save (R21). |
| SEC-7 | Inputs are checked on the server (R21), and unknown fields and oversized bodies are refused (section 5.1) |
| SEC-8 | Logs never contain request or response bodies, or any field value. Paths are logged as templates with IDs, such as `/api/contacts/{id}` (ADR-005). |
| SEC-9 | The one secret is the database password inside `DATABASE_URL`. It's kept in the git-ignored `.env` on this computer and entered in Render's settings for the hosted app, never in `render.yaml`, the code or the frontend. `SUPABASE_PUBLISHABLE_KEY` is meant for browsers and isn't secret. No Supabase secret key or service role key is used anywhere. The tests need no secrets (AC15). |
| SEC-10 | The hosted data is in Postgres on Supabase, encrypted at rest by Supabase *[Assumption]*. A local database is the plain SQLite file, protected only by the computer's user account *[Assumption]*, and encrypting it isn't in scope. |
| SEC-11 | Dependencies are pinned by lockfiles. `npm audit --audit-level=high` and `pip-audit` run before a release, and high or critical findings block it. |
| SEC-12 | Deleting removes the data from the database at once (R36). The space is reclaimed on the next checkpoint (SQLite) or vacuum (Postgres). Which privacy rules apply for real business use is an open question (section 16.5). |
| SEC-13 | **Token check.** Every API route but `GET /api/health` needs `Authorization: Bearer <token>`. The token must be a JWT signed with one of the Supabase project's current signing keys, which the backend fetches from `SUPABASE_URL` and caches for at most 10 minutes, fetching again when a token names a key it doesn't know. Its issuer must be `SUPABASE_URL/auth/v1`, its audience `authenticated`, and it must not have expired (with 60 seconds' leeway for clock drift). Anything else gets 401 `unauthorized` (ADR-023). |
| SEC-14 | **The person comes from the token only:** their ID from `sub`, and their email and name from the token's `email` and `user_metadata.name`. Nothing in the body, the query or any other header can say who's making a request (R110). |
| SEC-15 | **Only the publishable key reaches the browser.** The built frontend holds `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and nothing else from `.env`: never `DATABASE_URL`, a secret key (`sb_secret_…`) or a service role key. A test checks the built files (V-S16). |
| SEC-16 | **No sign-up.** The app has no sign-up, password reset or magic link screen, and makes no such call to Supabase. The Supabase project has "Allow new users to sign up" turned off, so sign-ups made around the app fail too (DEP-10). |
| SEC-17 | **Test sign-in.** The tests and ui-check sign in with tokens signed by a key made for each test run, never a real password or Supabase (ADR-025). The backend trusts that key only when `ACCOUNTABLE_TEST_AUTH_KEYS` is set, which only the test runs and `npm run dev:test` set. Start-up refuses to start with both it and `DATABASE_URL` set, logs a warning whenever it's set, and Render never sets it. The test sign-in endpoint (section 5.3) exists only while it's set. |
| SEC-18 | **Tokens are never logged or stored by the backend.** The browser keeps its session as the Supabase Auth client does by default, in `localStorage`, so SEC-6's escaping is also what keeps the token from other scripts. |

### Negative security cases

| Case | Expected |
|---|---|
| Opening the development app from another computer at this computer's network address | The connection is refused (SEC-1) |
| Any API request but health with no `Authorization` header | 401 `unauthorized`, and nothing is read or changed (SEC-13) |
| A token that has expired, is signed with another key, or comes from another Supabase project | 401 (SEC-13) |
| A token with its payload edited to another person's `sub` | 401: the signature no longer matches (SEC-13) |
| A request body with `created_by`, or a header such as `X-User-Id` | 422 for the body field. The header is ignored, and the person stays the token's (SEC-14). |
| The built frontend searched for `DATABASE_URL`, `sb_secret_` and `service_role` | None found (SEC-15) |
| A test sign-in token sent to an app started without `ACCOUNTABLE_TEST_AUTH_KEYS` | 401, and the test sign-in endpoint answers 404 (SEC-17) |
| A request with `Host: evil.example` | 403 (SEC-2) |
| A cross-site form or fetch POST with `Origin: https://evil.example` | 403, and nothing is changed (SEC-3) |
| A name of `<script>alert(1)</script>` | Saved and shown as plain text. No script runs. |
| A website of `javascript:alert(1)` | 422 with a message next to the field |
| A name of `'; DROP TABLE deals; --` | Saved and shown as text, and the tables are intact |
| A 2 MB body | 413 |
| An unknown field `{"is_admin": true}` | 422 |
| A crash | A 500 with a generic message. No stack trace reaches the browser, and the log has it with the request ID. |
