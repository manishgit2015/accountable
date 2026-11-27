# Spec: Data design

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Tables, indexes, connection settings, positions, lifecycle and data classification. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 6. Data design

### 6.1 Entities

All tables live in one database. Every start for real use, `npm run dev` as well as the hosted app, uses Postgres on Supabase from `DATABASE_URL`, and refuses to start without it (ADR-027). A SQLite file is used only by the tests, each on a temporary file (section 13.2), and by `npm run seed` and `npm run clear`, whose file defaults to `backend/data/accountable.db` and can be changed with `ACCOUNTABLE_DB` (R4). The same table definitions, through SQLAlchemy Core, serve both (ADR-020). The types below are SQLite's: on Postgres, SQLAlchemy uses the matching types, and the values stored are the same.

| Table | Columns and constraints |
|---|---|
| `organizations` | `id` INTEGER PRIMARY KEY, `name` TEXT NOT NULL, `website`, `industry`, `notes` TEXT NULL, `created_at`, `updated_at` TEXT NOT NULL |
| `contacts` | `id`, `organization_id` → organizations ON DELETE SET NULL, `name` NOT NULL, `email`, `phone`, `job_title` NULL, `status` NOT NULL CHECK in (lead, qualified, customer) DEFAULT lead, timestamps |
| `deals` | `id`, `organization_id` → organizations SET NULL, `contact_id` → contacts SET NULL, `name` NOT NULL, `stage` NOT NULL CHECK in the six stages, `value` INTEGER NOT NULL CHECK 0–1,000,000,000, `probability` INTEGER NOT NULL CHECK 0–100, `close_date` TEXT NOT NULL, `position` REAL NOT NULL, `closed_at` TEXT NULL, timestamps |
| `activities` | `id`, `type` CHECK in (note, call, email), `contact_id` → contacts ON DELETE CASCADE, `deal_id` → deals CASCADE, `description` NOT NULL, `occurred_at` NOT NULL, `follow_up_date` NULL, `done` INTEGER NOT NULL DEFAULT 0. CHECK that exactly one of `contact_id` and `deal_id` is set. |
| `stage_changes` | `id`, `deal_id` → deals CASCADE, `from_stage` NULL, `to_stage` NOT NULL, `changed_at` NOT NULL |
| `users` | `id` TEXT PRIMARY KEY (the person's Supabase user ID), `email` TEXT NOT NULL, `name` TEXT NULL (their display name), `last_seen_at` TEXT NOT NULL. Never deleted, so records keep their names after someone leaves (R114, ADR-022). |
| `alembic_version` | Managed by Alembic (ADR-004) |

`organizations`, `contacts`, `deals` and `activities` also have `created_by` and `updated_by`, TEXT NULL → users (no delete rule, since users are never deleted), null for sample data (R110, R113). `activities` also has `created_at` and `updated_at`, TEXT NOT NULL.

`closed_at` is the date and time a deal last moved to Won or Lost, and is null while it's open. The month-by-month figures and the "last 12 months" windows use it, not `close_date`, because a user can edit `close_date` afterwards (R16). Approved 21 Nov 2026 (C-3). The rejected alternative was grouping by `close_date`, where an edited date moves the deal to another month.

### 6.2 Indexes

- Every foreign key column
- `deals(stage, position)`
- `deals(closed_at)`
- `activities(occurred_at)`
- `activities(follow_up_date, done)`
- `stage_changes(deal_id, changed_at)`

### 6.3 Connection settings

Every SQLite connection sets:

- `PRAGMA foreign_keys = ON`
- `journal_mode = WAL`
- `synchronous = FULL`, so committed writes survive a power cut (REL-1)
- `busy_timeout = 5000`

Postgres connections go through Supabase's session pooler (a `pooler.supabase.com` address on port 5432) with the pg8000 driver (E-9), over TLS that encrypts the connection without checking the server's certificate, so no CA file is needed (ADR-028), from a pool of at most 5 connections (no overflow, each checked before use so a dropped one is replaced, REL-13), with a 10-second timeout and a 5-second `lock_timeout` set as a connection option rather than text SQL (E-1), so a locked row answers 503 `busy` as on SQLite (REL-6). Any query string in `DATABASE_URL`, such as `sslmode`, is ignored, since the backend sets TLS itself. Postgres commits are durable by default (REL-1).

### 6.4 Positions

- A new deal, or one whose stage changed outside the board, gets a position 1.0 below the column's current smallest, so it lands at the top.
- A drop between two cards gets their midpoint.
- When two neighbors are within 1e-6 of each other, the column is renumbered 1.0, 2.0, 3.0 and so on in the same transaction before the midpoint is taken.

### 6.5 Lifecycle

| Event | Effect |
|---|---|
| Create | `created_at` and `updated_at` are set to now, and `created_by` and `updated_by` to the signed-in person. A deal also gets its first stage change row. |
| Update | `updated_at` is set to now and `updated_by` to the signed-in person. A stage change follows section 4.2. |
| Any signed-in request | The person's `users` row is added, or updated when their email or name has changed, and `last_seen_at` is kept to the day (ADR-022) |
| Delete | R31–R33, through the foreign key rules, in one transaction |
| Seed | On a local SQLite database only (R4): every table but `users` is cleared and the sample data inserted, in one transaction. A new database, SQLite or Postgres, is seeded on its first start. |
| Clear | On a local SQLite database only (R4): every table but `users` is cleared in one transaction. The schema stays. |
| Upgrade | Alembic migrations run on startup, before the app serves requests (DEP-4) |

### 6.6 Data classification

Contact names, emails and phones, and the team's names and emails, are personal data. For the hosted app they're stored in Postgres on Supabase, in the region its project was created in. They travel only between the browser, the backend and Supabase, over HTTPS or TLS (section 8), and are never logged (SEC-8). Which privacy rules apply is still open (A-2, section 16.5).
