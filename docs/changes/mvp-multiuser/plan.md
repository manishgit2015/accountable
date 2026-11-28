# Plan: mvp-multiuser

From `intent.md` (sign-in, search and a user menu, with the data on Supabase) and the spec as it describes the product with this change (`docs/spec.md` and its area files, mainly `users.md`, `search.md`, `look-and-feel.md`, `api.md`, `data.md`, `security.md`, `operations.md` and `testing.md`). The engineer approved it as written on 27 Nov 2026, with the proposals in Risks: search matches with Python's `casefold()`, sample records show "Added by Sample data" (R113), `pyjwt[crypto]` and `@supabase/supabase-js` are added, and migration `0002` runs on Supabase only in phase 8, after a backup. Phase 0 was already built.

Requirement and test IDs are the spec's: R90–R96 (theme), R100–R115 (sign-in, the user menu and who added each record), R120–R125 (search), SEC-13–SEC-18, DEP-8–DEP-11, REL-13, REL-14, NFR-14, NFR-15, AC10–AC15, and the V cases in `docs/specs/testing.md`.

## 1. Files that change

### Backend

| File | Change | Phase |
|---|---|---|
| `pyproject.toml`, `uv.lock` | `pyjwt[crypto]` as a direct dependency, to check Supabase's tokens (ADR-023) and sign the test tokens (ADR-025). It and `cryptography` are already installed through `supabase`, and ES256 works on this machine under Application Control. The engineer's own `supabase`, `flask` and `dotenv` stay as they are. | 1 |
| `backend/app/config.py` | `SUPABASE_URL` (needed on a real start, REL-9's message), the test keys parsed from `ACCOUNTABLE_TEST_AUTH_KEYS`, `ACCOUNTABLE_PUBLIC_URL`, `RENDER`, `PORT` | 1, 7 |
| `backend/app/auth.py` (new) | The token check (SEC-13): signing keys fetched from `SUPABASE_URL/auth/v1/.well-known/jwks.json`, cached for 10 minutes and fetched again for an unknown `kid`; issuer, audience `authenticated`, expiry with 60 s leeway; the person from `sub`, `email` and `user_metadata.name` only (SEC-14); in test mode, the test run's public key instead of Supabase's. A FastAPI dependency every router but health uses. Tokens are never logged (SEC-18). | 1 |
| `backend/app/people.py` (new) | R105's display name and initials; adding or updating the `users` row on each signed-in request (`last_seen_at`, R114) | 1 |
| `backend/app/routers/me.py` (new) | `GET /api/me` (section 5.3) | 1 |
| `backend/app/routers/test_auth.py` (new) | `POST /api/test/sign-in`, registered only in test mode (404 otherwise), for the fixed test people | 1 |
| `backend/app/errors.py` | 401 `unauthorized`, "Sign in to continue." | 1 |
| `backend/app/main.py` | Registers the new routers; `require_database()` also needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on a real start; serves the built frontend (section 7.4); binds `0.0.0.0:$PORT` only when `RENDER` is set, otherwise 127.0.0.1 (SEC-1) | 1, 7 |
| `backend/app/security.py` | Host and Origin also accept `ACCOUNTABLE_PUBLIC_URL` (SEC-2, SEC-3) | 7 |
| `backend/migrations/versions/0002_people.py` (new) | The `users` table; `created_by` and `updated_by` on organizations, contacts, deals and activities; `created_at` and `updated_at` on activities, filled from `occurred_at` for existing rows before becoming NOT NULL. Adds only, deletes no rows (E-8), works on SQLite (batch) and Postgres. | 2 |
| `backend/app/db.py` | The same tables and columns in the metadata | 2 |
| `backend/app/schemas.py` | `created_by` and `updated_by` as `{id, name}` or null in responses, refused in request bodies (R110); the search and `me` shapes | 2, 3 |
| `backend/app/services/records.py`, `moves.py`, `timeline.py`, `routers/*.py` | Every create and update sets `created_by`/`updated_by` from the person; reads join `users` for the names; timeline activities carry who added them (R112) | 2 |
| `backend/app/services/search.py`, `routers/search.py` (new) | `GET /api/search` (R121, R122, R125) | 3 |
| `backend/app/seed.py`, `perfdata.py` | Sample and performance rows leave `created_by` null (R113); activities get `created_at`/`updated_at` | 2 |
| `backend/tests/conftest.py` | A test key pair per session, test people, and a `client` that sends a test token, plus an unsigned client for the 401 tests; fails any test over 1 second (V-U01) | 1 |
| `backend/tests/test_auth.py`, `test_attribution.py`, `test_search.py` (new); `test_security.py`, `test_errors.py`, `test_migrations.py` and the existing API tests | See Proof | 1–3 |

### Frontend

| File | Change | Phase |
|---|---|---|
| `frontend/package.json`, `package-lock.json` | `@supabase/supabase-js`, for signing in and renewing the token in the browser (R102). Only its Auth client is used. | 4 |
| `frontend/vite.config.ts` | Passes `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and nothing else from the root `.env`, to the app (SEC-15); `VITE_TEST_SIGN_IN=1` in test mode; the new packages in `optimizeDeps` | 4 |
| `frontend/src/lib/session.ts` (new) | One place for the session: Supabase Auth in real use, `POST /api/test/sign-in` in test mode (no Supabase client is created then, so V-E00 holds); sign in, sign out, current token, ended-session event | 4 |
| `frontend/src/api/client.ts` | `Authorization: Bearer` on every request; a 401 ends the session and shows the sign-in screen (R108); `database_unavailable` in the codes | 4 |
| `frontend/src/pages/SignIn.tsx` (new) | The sign-in screen (section 3.9 Sign-in screen, R100, R103, R104), with the return to the page asked for | 4 |
| `frontend/src/App.tsx`, `main.tsx` | A guard that shows the sign-in screen until there's a session; the `/api/me` query | 4 |
| `frontend/src/components/UserMenu.tsx` (new), `ThemeToggle.tsx` (removed), `TopBar.tsx` | The user menu with the person, Light, Dark and System, and Sign out (R90, R106, R107, R109); the top bar's new layout | 5 |
| `frontend/src/lib/theme.ts`, `frontend/index.html` | System as a third choice that follows `prefers-color-scheme` and its change (R90–R93), in the inline script too | 5 |
| `frontend/src/components/GlobalSearch.tsx` (new), `TopBar.tsx` | The top-bar search (R120–R124) | 6 |
| `frontend/src/pages/organizations`, `contacts`, `deals`, `components/Timeline.tsx`, `api/types.ts`, `api/queries.ts` | "Added by … on …" and "Last changed by … on …" (R111, R113), the name in timelines (R112) | 6 |
| `frontend/src/styles/global.css` | Styles for the sign-in screen, the menu and the search list, with tokens only | 4–6 |
| `frontend/vitest.config.ts` | `testTimeout: 1000`, so a slow unit test fails (V-U01) | 1 |
| Frontend tests | `SignIn.test.tsx`, `UserMenu.test.tsx`, `GlobalSearch.test.tsx` (new); `theme.test.ts`, `client.test.ts`, `App.test.tsx`, `Timeline.test.tsx`; `ThemeToggle.test.tsx` removed | 4–6 |

### Tests, scripts and deployment

| File | Change | Phase |
|---|---|---|
| `scripts/run-tests.mjs` | Makes an ES256 key pair for each run (Node's `crypto`) and puts it in `ACCOUNTABLE_TEST_AUTH_KEYS` as a JWK set, replacing today's random marker | 1 |
| `playwright.config.ts` | Passes the test keys to the backend and `VITE_TEST_SIGN_IN=1` to the frontend | 4 |
| `e2e/fixtures.ts` | Signs in as a test person before each test (`priya@test.example`, and `sam@test.example` for V-E15), unless a test asks to start signed out | 4 |
| `e2e/auth.spec.ts`, `attribution.spec.ts`, `search.spec.ts` (new); `theme.spec.ts`; existing specs that look at the top bar (`layout.spec.ts`, `keyboard.spec.ts`) | See Proof | 4–6 |
| `e2e/visual/dark-mode.spec.ts` | Compares the six light-mode screens with the top bar masked, since R94 allows only the top bar to change | 5 |
| `scripts/check-bundle.mjs` (new), `scripts/check.mjs` | After `npm run build`, fails if the built frontend holds `DATABASE_URL`, `sb_secret_` or `service_role` (V-S16) | 7 |
| `scripts/ensure-installed.mjs` | Names any missing Supabase setting in `.env` (DEP-3) | 7 |
| `package.json` | `build`, `start` (DEP-9) and `dev:test` (DEP-1, for ui-check) | 7 |
| `render.yaml` (new) | One free web service: build, start with migrations, health check `/api/health`, the five settings listed without values (DEP-8) | 7 |
| `.claude/agents/ui-check.md` | Starts `npm run dev:test` and signs in as a test person (SEC-17) | 7 |
| Docs | `docs/STATUS.md` (install, run, sign-in, runbook), `docs/build_logs.log`, the spec where the work settles an assumption (R113, ADR-025's key format) | each phase |

## 2. Order of work

Each phase ends with its tests passing and `npm run check` run in the foreground, and its evidence in `docs/build_logs.log`. The engineer commits. *Found in phase 1:* once the API needs a token, the end-to-end tests fail until the browser sends one (phase 4), so phases 1 to 3 end on `npm run check:quick`, and phase 4 restores `npm run check`. The `users` row moves from phase 1 to phase 2, which adds its table. V-E14's sign-out step moves from phase 4 to phase 5, which builds the user menu that holds Sign out.

**Phase 0: the database (done, 836b584).** Real use on Postgres on Supabase from `DATABASE_URL`, and every test path refusing it (ADR-027, ADR-028, V-B18, V-B19). Its probes are in the build log.

**Phase 1: the token check, on the backend.**
1. V-U01 first, so every new test is held to 1 second: the pytest hook and Vitest's timeout, proved with a probe test that sleeps.
2. The test keys in `run-tests.mjs` and `conftest.py`.
3. `auth.py` and `people.py`, the `users` row, and `GET /api/me`.
4. `POST /api/test/sign-in` in test mode only.
5. Every router but health behind the dependency, and the existing API tests sent through the signed-in client.
6. 401 in the error format, and start-up refusing a real start without the Supabase settings.

**Phase 2: who added and changed each record, on the backend.**
1. Migration `0002_people`, tested on a SQLite database holding data and on an empty one.
2. Services and schemas set and return `created_by`/`updated_by`.
3. Timelines name who added each activity.
4. Sample and performance data leave the person empty.

**Phase 3: search, on the backend.** `GET /api/search`, with matching done the same way on both databases (see Risks).

**Phase 4: signing in, in the browser.**
1. `session.ts` and the Supabase client.
2. The bearer token and the 401 handling in `client.ts`.
3. The sign-in screen and the guard.
4. Playwright's test sign-in in `fixtures.ts`, so the 59 existing end-to-end tests pass signed in.
5. `auth.spec.ts`.

**Phase 5: the user menu and the System theme.**
1. `UserMenu` replaces `ThemeToggle`, with System in `theme.ts` and the inline script.
2. `theme.spec.ts` updated.
3. The light-mode comparison is rerun with the top bar masked.

**Phase 6: names and search, in the browser.** *Not done: the engineer left it out of this change on 27 Nov 2026, after phase 5. Spec 17.1 lists what's missing.* "Added by" and "Last changed by" on record pages, names in timelines, and `GlobalSearch` in the top bar, with `attribution.spec.ts` and `search.spec.ts`.

**Phase 7: build, start and Render.**
1. FastAPI serves the built frontend.
2. `npm run build` and `npm run start`.
3. `ACCOUNTABLE_PUBLIC_URL` in the Host and Origin checks.
4. `0.0.0.0:$PORT` only on Render.
5. `render.yaml`, `check-bundle.mjs` in `npm run check`, `ensure-installed.mjs`, `dev:test`, and the ui-check agent.

**Phase 8: verification by hand, then the docs.**
1. V-M04: every screen in both modes, by eye and with the ui-check agent.
2. V-M07: `npm run build` and `npm run start` against the team's Supabase, signed in as a real person, then the deployed onrender.com address once the engineer has created the Render service.
3. V-M08: on Supabase, migration `0002` on the data already there, then the search and name checks.
4. `docs/STATUS.md`'s install, run and runbook sections.
5. An independent review with the reviewer agent.

## 3. Risks

| Risk | What we do |
|---|---|
| **Migration `0002` runs on the team's data**, which is never deleted (E-8) | It only adds a table and columns, and fills `created_at`/`updated_at` from `occurred_at` before making them NOT NULL. It's tested on a SQLite database holding the sample data (V-B13) and run on Supabase only in phase 8, by the engineer's go-ahead, with a Supabase backup first. A failed migration rolls back (REL-9). |
| **Search must match the same on SQLite and Postgres (R125)**, but their `lower()` and `LIKE` differ for accents and non-ASCII letters | Proposed: the server reads the names with SQLAlchemy Core and matches with Python's `casefold()`, so both databases give the same answer. It costs reading every name per search (about 2,000 rows at 2× volume, NFR-13), which V-P01 times. The alternative is a stored, casefolded name column kept up to date on every write, which is faster but needs a migration and more code. *Approved, 27 Nov 2026.* |
| **R113 is an assumption:** whether sample records show "Added by Sample data" | The plan builds it that way, as the spec says. *Confirmed, 27 Nov 2026.* |
| **Supabase's signing keys:** a project may sign with ES256 keys (JWKS) or an older shared HS256 secret | The check supports JWKS only, as SEC-13 says. If the new project still signs with the legacy secret, phase 1's manual check fails clearly, and the engineer switches the project to signing keys in Supabase's dashboard. No secret goes in `.env` (SEC-9). |
| **New dependencies** (ENG-5): `pyjwt[crypto]` and `@supabase/supabase-js` | Both are the standard, well-supported choice. `cryptography` loads under Application Control (checked on 27 Nov 2026), and `npm run audit` runs after each is added. *Approved, 27 Nov 2026.* |
| **A test path reaching Supabase** once the frontend can talk to it | In test mode no Supabase client is created, and the sign-in goes through `/api/test/sign-in`. V-E00 fails any request outside localhost, and ADR-027's refusals stay. |
| **The 59 existing end-to-end tests** must now sign in | The fixture signs in once per test through the test endpoint, which takes about 10 ms, and stores the session in the browser before the page opens. |
| **R94's pixel comparison** will fail on the top bar | The comparison masks the top bar. The top bar itself is checked by eye (V-M04). |
| **Slow requests against Supabase:** each request now adds a `users` update | The update only runs when `last_seen_at` is over 5 minutes old, which still meets R114. Request times are timed against Supabase in V-M07. |
| **Binding `0.0.0.0` on Render** while SEC-1 keeps 127.0.0.1 locally | Only when `RENDER` is set, which only Render sets. V-S10 checks the local bind, and V-S15 checks the public URL in the Host and Origin checks. |
| **The token in `localStorage`** (SEC-18) | React's escaping, with no `dangerouslySetInnerHTML` (SEC-6), as the spec accepts. |
| **Unit tests over 1 second on CI** (NFR-15) | V-U01 runs from phase 1, and the network is never called in unit tests: the JWKS fetch is faked with a local key set. |

## 4. Proof

Each new test gets a probe: break the code the way it would really break, see the test fail, restore it and see it pass, and record that in `docs/build_logs.log`. Every test's name starts with the requirement it proves.

### Unit tests: backend (pytest)

| Test | Proves | Phase |
|---|---|---|
| V-U01 hook in `conftest.py` | A test over 1 second fails the run. Probe: a test that sleeps 1.1 s. | 1 |
| V-B15 `test_auth.py` | Every route but health refuses a missing, malformed, expired, wrongly signed or other-project token, or the wrong audience, with 401. Health needs none. The person comes from `sub`, `email` and `user_metadata.name`. Keys are cached and fetched again for an unknown `kid`, from a faked JWKS endpoint. Test sign-in is 404 without test mode, and 401 for other details. Start-up refuses a real start without `SUPABASE_URL` and refuses test mode with `DATABASE_URL`. | 1 |
| V-S11–V-S15 `test_security.py` | Section 10's sign-in cases: a body or header claiming a person, a test token without test mode, an edited payload. Host and Origin with `ACCOUNTABLE_PUBLIC_URL` (phase 7). | 1, 7 |
| V-B14 `test_errors.py` | 401 `unauthorized` with "Sign in to continue." | 1 |
| `test_people.py` (part of V-B15) | R105's name and initials: name, email only, one word, extra spaces. The `users` row is added, then updated with a new name. | 1 |
| V-B16 `test_attribution.py` | Each create sets both fields and each update sets `updated_by`, from the token. A body with either field is refused with 422. Sample data has none. A person removed from Supabase still shows their name. | 2 |
| V-B13 `test_migrations.py` | `0002` on a database holding the sample data: same row counts, activities' times filled, columns null. On an empty database: the head schema. | 2 |
| V-B17 `test_search.py` | Part of a name in any case, for each kind, including an accented name. R122's order. 5 items with the full total. `%` and `_` as plain characters. Under 2 or over 200 characters refused. | 3 |
| V-B12, V-B18, V-B19 (existing) | Still pass with sign-in in place | 1–3 |

### Unit tests: frontend (Vitest)

| Test | Proves | Phase |
|---|---|---|
| V-U01 in `vitest.config.ts` | A test over 1 second fails. Probe: a test that waits 1.1 s. | 1 |
| `client.test.ts` | The bearer token on every request. A 401 ends the session. `database_unavailable` shows its message. | 4 |
| V-F12 `SignIn.test.tsx` | The form. R103's two messages. The email kept and the password cleared. No sign-up or reset link. The return to the page asked for. | 4 |
| `session.test.ts` | Test mode uses `/api/test/sign-in` and creates no Supabase client. Real mode signs in, signs out and reads the token through a faked Supabase client. | 4 |
| V-F11 `theme.test.ts`, V-F12 `UserMenu.test.tsx` | Light by default. Light, Dark and System. System follows a faked `prefers-color-scheme` and its change. Blocked storage still works. The menu's name, email and initials. Keyboard use (R109). Sign out. | 5 |
| `Timeline.test.tsx`, record page tests | "Added by … on …", "Last changed by …", "Sample data", and the name after the time in timelines | 6 |
| V-F13 `GlobalSearch.test.tsx` | Nothing under 2 characters. One request after 200 ms. Groups and totals. The arrow keys and Enter. Escape twice. The no-match, searching and failure messages. | 6 |

### End-to-end tests (Playwright, in Chrome, signed in as test people)

| Test | Proves | Phase |
|---|---|---|
| V-E00 `fixtures.ts` (every test) | No console errors, and no request outside localhost, so none to Supabase | 4 |
| V-E14 `auth.spec.ts` | Signed out, every section and a record page show the sign-in screen, and the API answers 401. Wrong details show R103's message. Signing in lands on the page asked for. Signing out shows the sign-in screen. An ended session shows "Your session has ended. Sign in again." and returns to the page. | 4 |
| Existing 59 tests | Unchanged behaviour, signed in | 4 |
| V-E13 `theme.spec.ts` | The user menu on every section and a record page. Light, Dark and System. System follows an emulated `prefers-color-scheme` and its change without a reload. The menu's size and position, read from the rendered page. | 5 |
| V-E15 `attribution.spec.ts` | Two test people: one adds a deal and logs an activity, the other edits the deal. The deal page shows both names, the timeline shows the first, and a sample record shows "Sample data". | 6 |
| V-E16 `search.spec.ts` | Finds an organization, a contact and a deal by part of a name in another case, and opens each with the mouse and with the keyboard. `/` focuses the box. The no-match message. | 6 |
| R94 `e2e/visual/dark-mode.spec.ts` (by hand, before merging) | The six light-mode screens match the baselines with the top bar masked | 5 |

### Scripts and checks

| Check | Proves | Phase |
|---|---|---|
| V-S16 `check-bundle.mjs` in `npm run check` | No `DATABASE_URL`, `sb_secret_` or `service_role` in the built frontend. Probe: a planted string in a built file. | 7 |
| ADR-027's probes (repeated) | Every test path still refuses `DATABASE_URL` after the frontend and test keys change | 4, 7 |
| `npm run check`, foreground | Every phase | 1–8 |

### By hand

- **V-M04:** every screen in both modes, including the sign-in screen, the user menu and the search list. Screenshots and their script go in `docs/evidence/<date>-mvp-multiuser/`.
- **V-M07:** the built app against the team's Supabase, then on Render: sign in as a real person, use every section, search, check who added a record, sign out, and time the first load after a sleep.
- **V-M08:** on Supabase, migration `0002` on the data already there, with a backup first, then V-E16's searches and V-E15's names giving the same results as on SQLite.
