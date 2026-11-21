The MVP is being built from `docs/plan.md`. Phase 1 (foundation) is done.

## Done

- 2026-11-20: Clarified the MVP scope in `docs/intent.md`: delete behaviour, required fields, stage probabilities, Won/Lost handling, pipeline columns, dashboard chart range and organization timelines.
- 2026-11-20: Wrote `docs/spec.md` with the MVP requirements (R1–R84), the brand-based design and the technical design. The project owner accepted all ten decisions in its "Concerns and decisions" section. Added `npm run clear` to `docs/TECH_STACK.md`.

- 2026-11-20: Made three HTML mockups of the dashboard and pipeline in `docs/mockups/` (A: spec layout, B: hero and top navigation, C: focus rail), each with Playwright screenshots. `docs/mockups/README.md` compares them and lists the points they raise for the spec.

- 2026-11-20: The project owner chose mockup B (hero and top navigation). `docs/spec.md` was updated to match: the top bar layout, the hero dashboard, the donut of open value by stage, the pipeline cards and the capped Won and Lost columns. Mockup B was trimmed to MVP scope (no user name, avatar or global search) and re-screenshotted.

- 2026-11-21: Wrote `docs/plan.md`: the files that will change, ten phases of work (0 to 9), the risks and how we handle them, and the unit and end-to-end tests that prove each requirement. No code yet.

- 2026-11-21: Restructured `docs/intent.md` into 14 sections, from business context to approval, after interviewing the product owner. Assumptions and proposed targets are marked as such. The product owner approved it the same day.
- 2026-11-21: Rewrote `docs/spec.md` as version 2.0, in 18 sections across five areas, keeping the R1–R84 IDs. It adds architecture, the API and data contracts, security, failure handling, observability, deployment, engineering standards, an ADR log and a Definition of Done. The product owner approved it, including C-2: the pipeline's Won and Lost columns show only deals closed this calendar month. Mockup B's screenshot still labels those columns "12 months".
- 2026-11-21: Refreshed `docs/plan.md` against spec 2.0. It now uses the spec's IDs (AC/SC, V and ADR). It adds the files for migrations, errors, security, logging, the error boundary and performance, and the tests for them. The phases are updated (guard rails in phase 0, hardening and release in phases 8 and 9), and the risks now include IPv6 `localhost`, the Host and Origin checks, Alembic with SQLite, `closed_at`, and backing up WAL files.
- 2026-11-21: The earlier mockups (A, B and C) were removed. Made two new mockups of the dashboard and pipeline that follow spec 2.0 and the brand: `docs/mockups/1-spec-reference/` and `docs/mockups/2-lanes-and-tiles/`, each with Playwright screenshots and no console errors. `docs/mockups/README.md` compares them and lists the points they raise for the spec: the badge contrast rule, and the visual reference path in spec 3.9 and the plan.

- 2026-11-21: The product owner chose mockup 1 (`docs/mockups/1-spec-reference/`) as the visual reference. `docs/spec.md` (references, 3.9, NFR-9, V-M04, ADR-012) and `docs/plan.md` now point to it. 
- 2026-11-21: Settled the badge contrast contradiction (ADR-017). Badges stay at 12px, and those with white text use the darker `--raspberry-text` or `--cerulean-text` fill. The spec's section 3.9 and both mockups were updated, and the screenshots re-taken.
- 2026-11-21: Rewrote `docs/plan.md` as version 3.0, a draft awaiting engineer approval:
  - a repository baseline and file-level inventory
  - 30 tasks in six phases, each with objective, files, steps, constraints, verification, evidence, exit and escalation
  - optional parallel streams
  - a 24-item risk register
  - proof with commands and requirement-to-test traceability

  Five decisions (E-1 to E-5) need the engineer's answer before work starts. No application code has been written.
- 2026-11-21: The engineer approved `docs/plan.md`, with E-1 to E-4 as recommended and E-5 changed: the build log is a separate file, `docs/build_logs.log`, tracked through one exception line in `.gitignore`. Phase 0 is done (checkpoint C0). Node 24.16, uv 0.11 and Chrome 157 are present and the ports are free. Python 3.12 isn't installed, and uv downloads it on the first `uv sync`. Evidence is in `docs/build_logs.log`.

- 2026-11-21: Phase 1 is done (checkpoint C1, on Windows). `npm run dev` installs what's missing and starts the empty app at `http://127.0.0.1:5173`. `npm test` (pytest, Vitest, Playwright on a temporary database) and `npm run lint` pass. The backend has config with an injectable clock, logging, the error format, the Host, Origin, size and JSON checks, the schema by Alembic migration `0001_initial`, the business rules and the API contract. The frontend has the top bar, tokens, bundled fonts, an error boundary and the API client. The engineer approved six extra frontend dev packages, the dashboard item shapes, and `closed_at` for deals created closed (plan 1.4 and `docs/build_logs.log`). On this machine, PowerShell blocks `npm.ps1`, so type `npm.cmd run dev` there.
- 2026-11-21: Verification run after checkpoint C1. Everything passed: `npm test` (238 backend, 12 frontend, 1 e2e), `npm run lint`, backend coverage 93% (`rules.py` 100%), an ad hoc frontend build, `npm audit` and `pip-audit`. A failing test in any suite makes `npm test` exit 1. Windows Application Control blocks `pip-audit.exe`, so use `uv run python -m pip_audit`. `AGENTS.md` now documents `npm test`. Outputs are in `docs/evidence/2026-11-21-verification/`.

## Next

- Phase 2 of `docs/plan.md` (T2.1 to T2.8): core backend services, API, seed, commands and dashboard, ending at checkpoint C2.
