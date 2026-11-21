The project has not yet started. No code has been written.

## Done

- 2026-11-20: Clarified the MVP scope in `docs/intent.md`: delete behaviour, required fields, stage probabilities, Won/Lost handling, pipeline columns, dashboard chart range and organization timelines.
- 2026-11-20: Wrote `docs/spec.md` with the MVP requirements (R1–R84), the brand-based design and the technical design. The project owner accepted all ten decisions in its "Concerns and decisions" section. Added `npm run clear` to `docs/TECH_STACK.md`.

- 2026-11-20: Made three HTML mockups of the dashboard and pipeline in `docs/mockups/` (A: spec layout, B: hero and top navigation, C: focus rail), each with Playwright screenshots. `docs/mockups/README.md` compares them and lists the points they raise for the spec.

- 2026-11-20: The project owner chose mockup B (hero and top navigation). `docs/spec.md` was updated to match: the top bar layout, the hero dashboard, the donut of open value by stage, the pipeline cards and the capped Won and Lost columns. Mockup B was trimmed to MVP scope (no user name, avatar or global search) and re-screenshotted.

- 2026-11-21: Wrote `docs/plan.md`: the files that will change, ten phases of work (0 to 9), the risks and how we handle them, and the unit and end-to-end tests that prove each requirement. No code yet.

- 2026-11-21: Restructured `docs/intent.md` into 14 sections, from business context to approval, after interviewing the product owner. Assumptions and proposed targets are marked as such. The product owner approved it the same day.
- 2026-11-21: Rewrote `docs/spec.md` as version 2.0, in 18 sections across five areas, keeping the R1–R84 IDs. It adds architecture, the API and data contracts, security, failure handling, observability, deployment, engineering standards, an ADR log and a Definition of Done. The product owner approved it, including C-2: the pipeline's Won and Lost columns show only deals closed this calendar month. Mockup B's screenshot still labels those columns "12 months".
- 2026-11-21: Refreshed `docs/plan.md` against spec 2.0. It now uses the spec's IDs (AC/SC, V and ADR). It adds the files for migrations, errors, security, logging, the error boundary and performance, and the tests for them. The phases are updated (guard rails in phase 0, hardening and release in phases 8 and 9), and the risks now include IPv6 `localhost`, the Host and Origin checks, Alembic with SQLite, `closed_at`, and backing up WAL files.

## Next

- Phase 0 of `docs/plan.md`: skeleton and commands.
