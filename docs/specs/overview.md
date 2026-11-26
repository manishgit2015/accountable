# Spec: Overview and traceability

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Purpose, product context, scope, success measures and acceptance criteria, references, markers and IDs, and the requirements traceability table. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 1. Overview

### 1.1 Purpose of this spec

This spec describes Accountable as it stands today: what it does, how its parts fit together, how it behaves when things go wrong, and how each requirement is proven. It's the single description of the product. Code that isn't described here, or that behaves differently from what's written here, is a defect in one or the other.

Each change to Accountable has its own folder, `docs/changes/<branch name>/`, with the change's `intent.md` and `plan.md`. A change updates this spec on its branch, so that when it merges, this spec describes the product with the change in it (section 17). The change folders are the history of why things are as they are; this spec is how they are.

### 1.2 Product context and problem

Accountable is a business management system for a small business. Today it's a sales CRM for one salesperson. It's meant to grow into a full Business OS, including ERP, with sign-in and several people sharing the same data (section 16.5).

**The problem it solves.** A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies it deals with, who its contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next. So:

- follow-ups are forgotten or done late, because nothing reminds anyone *[Assumption]*
- how sales are going, and what's likely to close, can't be seen without piecing it together by hand *[Assumption]*
- what happened with a customer depends on one person's memory or inbox *[Assumption]*

No single place holds companies, people, deals and their history together, and no figures are worked out from that data. There are no baseline numbers, such as time spent on admin or follow-ups missed.

**The outcome it aims for.** One salesperson manages all their companies, contacts, deals and follow-ups in one place on their own computer. They know at a glance how sales are going and what needs doing next, and they stop relying on spreadsheets, inboxes and memory. It should feel like a private Salesforce that does the everyday CRM essentials really well: sharp, modern, professional and a pleasure to use.

**Users and stakeholders.**

| Who | Role |
|---|---|
| One salesperson | The only user. They use it every day on their own computer with their own real data, starting from the sample data to look around, then clearing it and typing in their own records. |
| The rest of the sales team | Affected later, when several users are added (not in the product today) |
| The business's owner or managers | Benefit from seeing sales figures once the team uses it *[Assumption]* |
| Product owner | The project owner. Owns every product decision, approves each change, and has the final say, including on how it looks. |

### 1.3 Scope of the product today

- **In:** a sales CRM for one salesperson on their own computer. It has five sections (Dashboard, Organizations, Contacts, Deals, Pipeline), four kinds of record (organization, contact, deal, activity), sample data with reset and empty commands, and a desktop layout that follows the brand, in a light mode (the default) and a dark mode chosen with a toggle (section 3.10).
- **Not in the product today** (a change may add one, through its own intent):
  - sign-in, user accounts or several users
  - a phone layout
  - following the device's own light or dark setting
  - AI features
  - email, calendar or phone integrations
  - currencies other than US dollars
  - reports beyond the dashboard
  - tags or custom fields
  - changing the pipeline stages
  - importing or exporting data, including backups made by the app

### 1.4 Success measures and acceptance criteria

These were first set for the MVP (`docs/changes/mvp/intent.md`) and still describe what the product must do. Test names refer to them, so the IDs are stable.

**Success measures** (outcomes, checked in use):

- **SC1** Someone new to Accountable, with only the sample data and no instructions, can find which companies we deal with, who our contacts are, what's in the pipeline, what happened last with a customer and what needs doing next, each within a couple of clicks of the dashboard.
- **SC2** The salesperson uses Accountable as their only record of companies, contacts, deals and follow-ups for 2 weeks of normal work, without going back to a spreadsheet.
- **SC3** In those 2 weeks, every follow-up the salesperson logs is either marked done or shown as overdue on the dashboard, so none is lost unnoticed.
- **SC4** The salesperson can say how sales are going this month, and what's expected from the open pipeline, from the dashboard alone, in under a minute.
- **SC5** The product owner rates every screen as sharp, modern, professional and on brand, and the dashboard as visually stunning.

**Acceptance criteria** (must always hold):

- **AC1** Someone non-technical can start Accountable with the one documented command, open it in a browser and land on the dashboard, with sample data on every screen.
- **AC2** Organizations, contacts (leads, qualified contacts and customers) and deals can each be added, found by searching, sorted, edited and deleted from their tables. Every change is still there after a refresh and after a restart. Deleting asks first, and the linked records end up as the warning said. The reset command brings back the sample data, and the empty command leaves an empty app that still works on every screen.
- **AC3** Contacts can be filtered by status, and each record's page shows the records it's linked to. An organization's page shows the combined timeline of its contacts and deals.
- **AC4** Dragging a deal to another column on the pipeline changes its stage and its probability of close, and the deals list shows both. A card dropped anywhere in a column, including higher or lower in its own column, stays there after a refresh. The board's and the columns' totals and expected revenue change as soon as the card moves. A deal added in a column starts at that stage, and late deals stand out.
- **AC5** An activity or follow-up logged on a contact or deal appears in its timeline, newest first, and so does an entry for each change of stage. Anything on a deal also appears on its main contact's timeline. Follow-ups show on the dashboard as upcoming or overdue until they're marked done.
- **AC6** The dashboard's figures match the data, and they reflect a deal marked won or a new follow-up. A deal marked won counts in the month it was won, and its main contact becomes a customer.
- **AC7** The dashboard has a line chart, a bar chart and a visual of the pipeline.
- **AC8** Data survives a restart of the app and of the computer, including an unexpected shutdown.
- **AC9** Before a change is called done, it has been used end to end in a real browser, the way a salesperson would, covering every section and action it touches, with each screen checked by eye and no errors in the console. Then the product owner uses it and has the final say, including on how it looks. Passing tests is necessary, but it isn't enough.

### 1.5 References

| Document | Role |
|---|---|
| `docs/TECH_STACK.md` | The stack. A constraint on the product (ADR-001). |
| `.claude/skills/brand` | Fonts, colors, light and dark surfaces, and tone |
| `docs/mockups/1-spec-reference/` | The visual reference for the dashboard and pipeline (mockup 1) |
| `docs/REVIEW.md` | How a change is reviewed before it merges |
| `docs/STATUS.md` | What's done, how to run and operate the app, and what's next |
| `docs/changes/<branch name>/` | Each change's intent and plan. `docs/changes/mvp/` is the first release. |
| Architecture decisions | ADR-001 to ADR-019 and E-1 to E-5, in section 16.3 |

### 1.6 Markers and IDs

- Everything in this spec is approved behavior, unless it's marked *[Assumption]* (believed true but not confirmed).
- Requirement IDs are stable, and an ID is never reused for something else. New requirements fill unused numbers. The prefixes are R (functional), NFR (nonfunctional), SEC (security), REL (reliability), OBS (observability), DEP (deployment), ENG (engineering standards), WF (workflows), V (verification cases), AC and SC (section 1.4), ADR and E (decisions), A (assumptions) and C (resolved ambiguities).

## 2. Requirements traceability

Each row runs from a product area to its requirements, the verification that proves them (section 13.3), and the criteria in section 1.4 they serve.

| Area | Requirements | Verification | Criteria |
|---|---|---|---|
| Dashboard | R70–R79 | V-B10, V-F09, V-E07, V-E01 | AC6, AC7 |
| Organizations | R10, R44, R50 | V-B03, V-B09, V-E02, V-E05 | AC2, AC3 |
| Contacts | R11, R44, R51 | V-B04, V-B09, V-F06, V-E03, V-E05 | AC2, AC3 |
| Deals | R12, R19, R44, R52 | V-B05, V-F05, V-E04, V-E05 | AC2, AC4 |
| Pipeline | R60–R67 | V-B06, V-F07, V-F08, V-E06 | AC4 |
| Tables | R40–R48 | V-F03, V-E02–V-E04 | AC2 |
| Activities and follow-ups | R13, R53–R56, R76 | V-B08, V-F09, V-E08 | AC5 |
| The four kinds of record | R10–R13, R21, R22 | V-B02–V-B05, V-B08 | AC2 |
| Sample data | R80–R84 | V-B11, V-E01 | AC1 |
| Stages and probability | R14, R15 | V-B01, V-B06, V-F05 | AC4 |
| Winning and losing | R16, R17, R18 | V-B01, V-B06, V-E07 | AC6 |
| Required information | R11, R12, R34 | V-B04, V-B05, V-F05, V-F06 | AC2 |
| Deleting | R30–R36 | V-B07, V-F04, V-E02 | AC2 |
| Commands and data | R1, R4, DEP-1–DEP-7 | V-B12, V-E09, V-M02 | AC1, AC2 |
| Performance | R6, NFR-1–NFR-3, NFR-13 | V-P01 | (none) |
| Availability (offline) | R2, NFR-4 | V-E00 (every e2e test), V-M02 | AC1 |
| Reliability and persistence | R3, REL-1–REL-12 | V-B13, V-E10, V-M03 | AC2, AC8 |
| Security | SEC-1–SEC-12 | V-S01–V-S10 | (none) |
| Accessibility | NFR-7 | V-E11, V-M04 | (none) |
| Usability | NFR-8 | V-M05 | SC1 |
| Look and feel | NFR-9, section 3.9 | V-M04 | SC5 |
| Light and dark mode | R90–R95, section 3.9, NFR-7, ENG-1 | V-F11, V-E13, V-M04 | SC5 |
| Portability | R1, NFR-6 | V-M02 | AC1 |
| Business outcomes | (measured in use) | V-M06 | SC2, SC3, SC4 |
| End-to-end use | (all of the above) | V-M01 | AC9 |
