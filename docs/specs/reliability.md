# Spec: Reliability and failure handling

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The REL requirements. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 11. Reliability and failure handling

| ID | Requirement |
|---|---|
| REL-1 | **Durability:** every change the API reported as saved survives a crash or power cut (AC8): on SQLite through WAL and `synchronous = FULL`, and on Postgres through its own durable commits |
| REL-2 | **Atomic requests:** each request runs in one transaction, so a move, delete, seed or clear either happens fully or not at all |
| REL-3 | **Persistence:** data is still there after a refresh and a restart (R3) |
| REL-4 | **Timeouts:** the frontend gives up on a request after 10 s and shows the error message |
| REL-5 | **Retries and idempotency:** reads are retried once automatically, and changes are never retried automatically. Save buttons are disabled while saving, so double-clicks don't create twice. PATCH and the move endpoint are safe to repeat (section 5.4). A DELETE of something already gone returns 404, and the frontend treats that as done. |
| REL-6 | **Busy database:** if the database stays locked past `busy_timeout` (SQLite) or `lock_timeout` (Postgres), the API answers 503 `busy` and the UI says "Accountable is busy. Try again." |
| REL-7 | **Backend not reachable:** a banner says "Can't reach Accountable. Check your internet connection, and that Accountable is still running." Data already on screen stays visible, but saving is blocked until it's back. |
| REL-8 | **Optimistic moves:** a failed move puts the card and the totals back (R64) |
| REL-9 | **Start-up failures** stop the start-up with one clear line and a non-zero exit, and are never fixed silently: a port in use ("Port 8000 is already in use…"), an unreadable or damaged database file, a Postgres database in `DATABASE_URL` that can't be reached, a missing `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` ("SUPABASE_URL is missing. Add it to .env, or to Render's settings."), both `ACCOUNTABLE_TEST_AUTH_KEYS` and `DATABASE_URL` set (SEC-17), or a failed migration. A failed migration leaves the database as it was. The app never resets or reseeds an existing database by itself. |
| REL-10 | **Seed and clear while the app runs** both work, on a local database (R4). Running tabs show the new data on their next refetch or refresh. |
| REL-11 | **Concurrent edits:** the last write wins (ADR-003). The board reloads on a 409 `stale_position` (section 4.5). |
| REL-12 | **Rendering errors:** an error boundary on each page shows "Something went wrong on this page", with a reload button and the request ID if there is one, instead of a blank screen |
| REL-13 | **Database not reachable:** if Postgres can't be reached while the app runs, requests that need it answer 503 `database_unavailable` after the 10-second connect timeout, and the UI says "Accountable can't reach its database. Try again in a minute." The next request tries again, with a new connection. Health answers 503 too (section 5.5). |
| REL-14 | **Waking up on Render:** the free plan stops the service after 15 minutes without requests. The next page load waits while Render starts it again, which can take up to about a minute *[Assumption: Render's free plan]*. Requests made once the page has loaded aren't affected. |
