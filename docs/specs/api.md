# Spec: API and interface contracts

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Conventions, errors, resources, the move endpoint, the dashboard and health endpoints, and the command-line interface. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 5. API and interface contracts

### 5.1 Conventions

- **Base path:** `/api`, served by the backend on `127.0.0.1` (SEC-1). The frontend reaches it through the Vite proxy, so it sees one origin.
- **Versioning:** the API is unversioned, because the bundled frontend is its only client (ADR-009). A breaking change after the API gets other clients would be released as `/api/v2`.
- **Format:** JSON in UTF-8. Requests with a body need `Content-Type: application/json`, or get 415. Bodies over 1 MB get 413.
- **Unknown fields** in a request body are refused with 422, so typos aren't silently dropped.
- **IDs** are positive whole numbers.
- **Dates and times:** dates are `YYYY-MM-DD`. Date-times are local times written like `2026-11-21T14:30:00`, with no time zone (ADR-013). Money is whole US dollars as a number.
- **Lists** return every row, unpaged (ADR-007).
- **Concurrency:** no version checks. The last write wins (ADR-003).
- **Request ID:** every response carries `X-Request-ID` (OBS-3).

### 5.2 Errors

Every error has the same body:

```json
{ "error": { "code": "validation_failed", "message": "Check the highlighted fields.", "fields": { "name": "Enter a name." }, "request_id": "9f2c…" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | The JSON is malformed |
| 403 | `forbidden_origin` | A changing request came from another origin, or the Host header isn't local (SEC-2, SEC-3) |
| 404 | `not_found` | No record has that ID |
| 409 | `stale_position` | A move refers to a card that's no longer where the request says |
| 413 | `too_large` | The body is over the limit |
| 415 | `unsupported_media_type` | The body isn't JSON |
| 422 | `validation_failed` | A field rule failed (R21, R23, R11, R12). `fields` lists each one. |
| 503 | `busy` | The database stayed locked past the timeout (REL-6) |
| 500 | `internal` | Anything unexpected. The message is generic, and details go only to the log. |

### 5.3 Resources

The organization, contact, deal and activity resources each have:

| Method and path | Request | Success |
|---|---|---|
| `GET /api/{resource}` | (none) | 200 with an array |
| `POST /api/{resource}` | The record's fields | 201 with the record |
| `GET /api/{resource}/{id}` | (none) | 200 with the record (not for activities) |
| `PATCH /api/{resource}/{id}` | Only the fields being changed | 200 with the record |
| `DELETE /api/{resource}/{id}` | (none) | 204 |

Organizations, contacts and deals also have:

| Method and path | Success |
|---|---|
| `GET /api/{resource}/{id}/timeline` | 200 with an array of entries, newest first |
| `GET /api/{resource}/{id}/delete-impact` | 200 with counts |

Record shapes in responses:

| Resource | Fields |
|---|---|
| Organization | `id`, `name`, `website`, `industry`, `notes`, `contact_count`, `open_deal_count`, `open_value`, `created_at`, `updated_at` |
| Contact | `id`, `organization_id` (or null), `organization_name` (or null), `name`, `email`, `phone`, `job_title`, `status`, `created_at`, `updated_at` |
| Deal | `id`, `organization_id`, `organization_name`, `contact_id`, `contact_name` (the last four may be null), `name`, `stage`, `value`, `probability`, `expected_revenue`, `close_date`, `is_late`, `position`, `closed_at` (or null), `created_at`, `updated_at` |
| Activity | `id`, `type`, `contact_id`, `deal_id` (exactly one is set), `description`, `occurred_at`, `follow_up_date` (or null), `done` |

Other shapes:

- **Timeline entry:** `kind` (`activity` or `stage_change`), `id`, `type` (the activity type, or null), `from_stage`, `to_stage`, `description`, `at`, `source` (`{kind, id, name}`, giving the deal or contact it came from).
- **Delete impact:** for example `{ "contacts_kept": 4, "deals_kept": 3, "activities_deleted": 0, "stage_changes_deleted": 0 }`. Only the keys that apply to that resource are present.

Rules for creating and changing records:

- `POST /api/deals` without `probability` uses the stage's usual one. It also creates the first stage change row.
- `PATCH` checks a link only when the link is in the request (R34).
- A stage change through `PATCH /api/deals/{id}` applies R15–R18 and puts the deal at the top of its new column (R67).

### 5.4 Move

`POST /api/deals/{id}/move` takes `{ "stage": "proposal", "before_id": 12, "after_id": 31 }`. `before_id` is the card above the drop point and `after_id` the card below. Either can be null at the ends of a column, and both are null for an empty column.

- Both must be in the target stage and next to each other in it. If they aren't, the move is refused with 409 `stale_position`.
- It changes the stage (if different) and the position in one transaction, applying R15–R18.
- It returns 200 with the moved deal, plus any deal that was renumbered.
- Sending the same move twice leaves the same end state, except that a second stage change row isn't added, because the stage no longer changes.

### 5.5 Dashboard and health

`GET /api/dashboard` returns:

```json
{
  "today": "2026-11-21",
  "summary": { "open_value": 0, "expected_revenue": 0, "won_this_month": { "value": 0, "count": 0 }, "win_rate": { "won": 0, "lost": 0, "percent": null } },
  "months": [ { "month": "2025-12", "revenue_won": 0, "won": 0, "lost": 0 } ],
  "funnel": [ { "stage": "new", "value": 0 } ],
  "open_by_stage": [ { "stage": "new", "count": 0, "value": 0, "expected": 0 } ],
  "follow_ups": { "overdue": [], "today": [], "next_7_days": [], "later_count": 0 },
  "recent": [],
  "counts": { "overdue_follow_ups": 0, "late_deals": 0 }
}
```

- `months` always has 12 entries, oldest first.
- `funnel` has the five stages from New to Won.
- `percent` is null when there are no closed deals.

`GET /api/health` returns `{ "status": "ok", "database": "ok", "schema_version": "…", "app_version": "0.1.0" }`. If the database can't be read, it returns 503 with `"database": "error"`.

### 5.6 Command-line interface

| Command | Behavior | Exit code |
|---|---|---|
| `npm run seed` | Asks "This replaces all data with the sample data. Type yes to continue:", then reseeds in one transaction | 0 when done, 1 when not confirmed, 2 on error |
| `npm run clear` | The same question ("This deletes all data…"), then empties every table in one transaction | 0, 1 or 2 |
| Either with `-- --yes` | Skips the question | As above |

Both print what they did, for example "Sample data loaded: 12 organizations, 40 contacts, 45 deals, 150 activities."
