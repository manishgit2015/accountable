# Spec: Accountable

This is the summary of the whole product and the index of its spec. The detail lives in one file per area in `docs/specs/`. Together, this file and the area files are the spec: the single description of the product, and the authority on how it behaves (section 1.1). "This spec" in any of them means the whole set.

## Summary

Accountable is a business management system for a small business. Today it's a sales CRM for one salesperson on their own computer, meant to grow into a full Business OS with several people sharing the same data (sections 1.2 and 16.5).

- **What it does:** five sections (Dashboard, Organizations, Contacts, Deals, Pipeline) over four kinds of record (organization, contact, deal, activity). Deals move through six stages, New to Won and Lost, on a drag-and-drop pipeline. The dashboard works out sales figures, charts and follow-ups from the data. It comes with sample data and reset and empty commands, and follows the brand in a light mode (the default) and a dark mode chosen with a toggle (section 1.3).
- **How it runs:** `npm run dev` starts a React app and a FastAPI backend on `127.0.0.1` only, with one local SQLite file. There's no sign-in, and nothing leaves the computer at runtime (sections 7, 8 and 10).
- **How it's proven:** the acceptance criteria AC1–AC9 and success measures SC1–SC5 (section 1.4), each requirement traced to its verification cases (sections 2 and 13).

## Index

Section numbers and IDs are the same as before the spec was split, so a reference such as "spec 5.6", "section 3.9" or "R21" anywhere in the repository still points to the same text: find the section below, then open its file.

| Area | Section | File |
|---|---|---|
| **A. Product and traceability** | 1. Overview: purpose, context, scope, success measures and acceptance criteria, references, markers and IDs | [`specs/overview.md`](specs/overview.md) |
| | 2. Requirements traceability | [`specs/overview.md`](specs/overview.md) |
| **B. Functional design** (3. Functional requirements, 4. User journeys and workflows) | 3.1 Records and validation | [`specs/records.md`](specs/records.md) |
| | 3.2 Deal rules | [`specs/deals.md`](specs/deals.md) |
| | 3.3 Deleting, 3.4 Tables, 3.5 Record pages | [`specs/records.md`](specs/records.md) |
| | 3.6 Pipeline | [`specs/pipeline.md`](specs/pipeline.md) |
| | 3.7 Dashboard | [`specs/dashboard.md`](specs/dashboard.md) |
| | 3.8 Sample data and commands | [`specs/sample-data.md`](specs/sample-data.md) |
| | 3.9 Look and feel, 3.10 Light and dark mode (with Writing) | [`specs/look-and-feel.md`](specs/look-and-feel.md) |
| | 4.1 Journeys | [`specs/journeys.md`](specs/journeys.md) |
| | 4.2 Deal stage states | [`specs/deals.md`](specs/deals.md) |
| | 4.3 Follow-up states, 4.4 Contact status | [`specs/records.md`](specs/records.md) |
| | 4.5 Edge cases | [`specs/journeys.md`](specs/journeys.md) |
| | 5. API and interface contracts | [`specs/api.md`](specs/api.md) |
| | 6. Data design | [`specs/data.md`](specs/data.md) |
| **C. Technical architecture** | 7. Solution architecture, 8. Integration design | [`specs/architecture.md`](specs/architecture.md) |
| | 9. Nonfunctional requirements | [`specs/nonfunctional.md`](specs/nonfunctional.md) |
| | 10. Security and privacy | [`specs/security.md`](specs/security.md) |
| | 11. Reliability and failure handling | [`specs/reliability.md`](specs/reliability.md) |
| **D. Engineering quality** | 12. Observability and operations (with the runbook) | [`specs/operations.md`](specs/operations.md) |
| | 13. Testing and verification strategy | [`specs/testing.md`](specs/testing.md) |
| | 14. Deployment and release design | [`specs/operations.md`](specs/operations.md) |
| | 15. Engineering standards | [`specs/engineering.md`](specs/engineering.md) |
| **E. Governance** | 16. Assumptions, risks and decisions, 17. Changing this spec (with known gaps), 18. Ownership | [`specs/governance.md`](specs/governance.md) |

### Where each ID lives

| IDs | File |
|---|---|
| AC1–AC9, SC1–SC5 | `specs/overview.md` |
| R10–R13, R21, R22, R30–R36, R40–R48, R50–R56 | `specs/records.md` |
| R14–R20, R23, R24 | `specs/deals.md` |
| R60–R67 | `specs/pipeline.md` |
| R70–R79 | `specs/dashboard.md` |
| R1, R4, R80–R84 | `specs/sample-data.md` |
| R90–R95 | `specs/look-and-feel.md` |
| WF-1–WF-10 | `specs/journeys.md` |
| NFR-1–NFR-13 (with R2, R5, R6, R7, and R1's portability measure) | `specs/nonfunctional.md` |
| SEC-1–SEC-12 | `specs/security.md` |
| REL-1–REL-12 (with R3) | `specs/reliability.md` |
| OBS-1–OBS-6, DEP-1–DEP-7 | `specs/operations.md` |
| V cases | `specs/testing.md` |
| ENG-1–ENG-12 | `specs/engineering.md` |
| A, ADR, E, D and C IDs, and the known gaps | `specs/governance.md` |

## Keeping the spec current

- A change reads this file first, then only the area files it touches.
- A change updates, on its branch, every area file it affects, and this file too when the summary, the index or the list of IDs changes (section 17).
- A new section goes in the area file it belongs to, keeping the numbering, and gets a row in the index. A new area gets its own file in `docs/specs/` and a row in the index.
