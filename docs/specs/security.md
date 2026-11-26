# Spec: Security and privacy

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The SEC requirements and the negative security cases. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 10. Security and privacy

Accountable has no sign-in by design (section 1.3), so its protection is to stay on one computer.

| ID | Requirement |
|---|---|
| SEC-1 | Both servers listen on `127.0.0.1` only, never `0.0.0.0` (ADR-002). The Vite proxy targets `http://127.0.0.1:8000` by address, not by `localhost`. |
| SEC-2 | The backend refuses any request whose `Host` header isn't `127.0.0.1` or `localhost` on the API or web port, with 403. This guards against DNS rebinding. Vite's own allowed-hosts check stays at its local-only default. |
| SEC-3 | A changing request (POST, PATCH, DELETE) whose `Origin` header isn't the app's own (`http://127.0.0.1:5173` or `http://localhost:5173`, or the test ports) is refused with 403. No CORS headers are sent, so other websites can't read responses. |
| SEC-4 | There's no authentication or authorization, by design. *[Assumption A-1: only the salesperson can use the computer.]* |
| SEC-5 | Every query goes through SQLAlchemy Core with bound parameters. There's no raw SQL or string-built queries; the only text SQL is the connection `PRAGMA` statements in `db.py` (E-1). |
| SEC-6 | User text is always shown as text. React escaping is used, with no `dangerouslySetInnerHTML`. Websites become links only for `http` and `https`, open in a new tab with `rel="noopener noreferrer"`, and any other scheme is refused on save (R21). |
| SEC-7 | Inputs are checked on the server (R21), and unknown fields and oversized bodies are refused (section 5.1) |
| SEC-8 | Logs never contain request or response bodies, or any field value. Paths are logged as templates with IDs, such as `/api/contacts/{id}` (ADR-005). |
| SEC-9 | Accountable has no secrets. `.env` files are already ignored by git, and none are needed. |
| SEC-10 | Data at rest is the plain SQLite file, protected only by the computer's user account *[Assumption]*. Encrypting it isn't in scope. |
| SEC-11 | Dependencies are pinned by lockfiles. `npm audit --audit-level=high` and `pip-audit` run before a release, and high or critical findings block it. |
| SEC-12 | Deleting removes the data from the database at once (R36). The space is reclaimed on the next checkpoint. Which privacy rules apply for real business use is an open question (section 16.5). |

### Negative security cases

| Case | Expected |
|---|---|
| Opening the app from another computer at this computer's network address | The connection is refused (SEC-1) |
| A request with `Host: evil.example` | 403 (SEC-2) |
| A cross-site form or fetch POST with `Origin: https://evil.example` | 403, and nothing is changed (SEC-3) |
| A name of `<script>alert(1)</script>` | Saved and shown as plain text. No script runs. |
| A website of `javascript:alert(1)` | 422 with a message next to the field |
| A name of `'; DROP TABLE deals; --` | Saved and shown as text, and the tables are intact |
| A 2 MB body | 413 |
| An unknown field `{"is_admin": true}` | 422 |
| A crash | A 500 with a generic message. No stack trace reaches the browser, and the log has it with the request ID. |
