# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements and a design to build from. Where the intent leaves a choice open, the spec makes one and says so. The intent wins if the two ever disagree. The stack is in `docs/TECH_STACK.md`, and the look follows the brand skill (`.claude/skills/brand`).

## Concerns and decisions

Points the intent and brand left open. The project owner went through each one on 2026-11-20 and accepted every decision below.

1. **Brand text colors fail contrast at small sizes.** The brand puts white text on Cerulean (contrast 3.96:1) and Raspberry (3.62:1). Both pass for large or bold text (3:1) and fail for normal body text (4.5:1). *Decision:* white on Cerulean or Raspberry only for bold text of 14px or more (buttons, badges). For small text in those colors, use the darker text variants in [Color tokens](#color-tokens).
2. **Six stages, five brand colors.** The brand orders Sea Green, Marigold, Coral, Cerulean, Raspberry for side-by-side series, but the pipeline has six stages, and Won and Lost carry meaning. *Decision:* New is Sea Mist (neutral), Qualified Cerulean, Proposal Marigold, Negotiation Coral, Won Sea Green, Lost Raspberry. This breaks the brand's ordering rule so that green means won and red means lost.
3. **"How much value reaches each stage" needs stage history.** A Lost deal's current stage doesn't say how far it got. *Decision:* every deal records its stage changes, including the stage it was created at. The funnel counts each deal at every open stage up to the furthest one it reached, and Won deals count at every stage. Sample data includes this history.
4. **Reopening a won or lost deal.** Moving a deal to Won or Lost sets its close date to today. If it's dragged back to an open stage, that date becomes its expected close date, and the deal shows as late from tomorrow. *Decision:* keep the date as it is and let the user edit it. The contact stays a customer, as the intent says.
5. **Must a deal's main contact work at the deal's organization?** The intent doesn't say. *Decision:* yes. The main contact picker lists only that organization's contacts, and the backend refuses a mismatch when either field is set or changed. A deal left with no organization or contact after a delete is exempt until someone fills the gap.
6. **Stage changes are not activities.** Activities have the types note, call and email. *Decision:* stage changes are kept in a separate table, shown in the same timelines, and can't be edited or deleted. They're deleted with their deal.
7. **A new command is needed.** `docs/TECH_STACK.md` lists `npm run seed` but not the "empty the database" command the intent asks for. *Decision:* add `npm run clear`, now listed in `docs/TECH_STACK.md`. Both commands ask "Type yes to continue" and accept `--yes` for tests and scripts. They clear the tables inside a transaction rather than deleting the database file, so they also work on Windows while the app is running. The app shows the new data on its next refresh.
8. **One command on a fresh checkout.** `npm run dev` needs the root `node_modules` before it can run. *Decision:* a `predev` script runs `npm install` and `uv sync` when they're missing. The first run needs the internet; later runs don't. Fonts come from `@fontsource` packages, so nothing is fetched from Google Fonts at runtime.
9. **"Upcoming" follow-ups have no time limit in the intent.** *Decision:* Overdue (due before today), Today, and Next 7 days. Follow-ups due later are counted but not listed.
10. **Timelines follow the current main contact.** A contact's timeline shows activity on deals where they are the main contact *now*. If a deal's main contact changes, its history moves to the new contact. *Decision:* accept this, since it keeps the data model simple.

## Requirements

Requirement IDs (R1, R2 and so on) are used by the tests and in `docs/STATUS.md`.

### General

- **R1** One command, `npm run dev`, installs anything missing on its first run, starts the backend and frontend together, and prints the address to open (`http://localhost:5173`). It works on Mac, Linux and Windows, with Node 24+ and uv installed beforehand.
- **R2** After the first run, the app works with no internet connection. All fonts, icons and libraries ship with the app.
- **R3** Every change is saved to the SQLite database right away. It is still there after a browser refresh and after a restart.
- **R4** A new database is filled with sample data. `npm run seed` resets it to the sample data and `npm run clear` empties it, each after asking first.
- **R5** Light mode, for laptop and desktop screens 1280px wide or more. It stays usable down to 1024px.
- **R6** It stays quick with 1,000 contacts, 500 deals and 5,000 activities: each page shows within half a second, and searching and sorting respond to each key press.
- **R7** No errors in the browser console on any screen.

### Data

- **R10 Organization:** name (required), website, industry, notes.
- **R11 Contact:** name (required), organization (required), email, phone, job title, status (lead, qualified or customer; defaults to lead).
- **R12 Deal:** name, organization, main contact, stage, value in US dollars (a whole number of 0 or more) and close date are all required. Probability of close is a whole-number percentage from 0 to 100.
- **R13 Activity:** type (note, call or email), a contact *or* a deal (exactly one), description (required), when it happened (defaults to now), and an optional follow-up date with a done flag.
- **R14 Stage probabilities:** New 5%, Qualified 20%, Proposal 40%, Negotiation 70%, Won 100%, Lost 0%.
- **R15** When a deal's stage changes, its probability becomes the new stage's usual one. A probability changed by hand is kept until the next stage change. In the edit form, changing the stage fills in the new usual probability, which can be overwritten before saving.
- **R16** When a deal moves to Won or Lost, by any route, its close date becomes today (the computer's local date). It can be edited afterwards.
- **R17** When a deal moves to Won, its main contact's status becomes customer. Nothing changes it back.
- **R18** Every stage change, including the stage a deal was created at, is saved with its date and time and its from and to stages. The timeline shows it as, for example, "Moved from Proposal to Negotiation".
- **R19** A deal is *late* when it is in an open stage (New to Negotiation) and its close date is before today.
- **R20** Expected revenue is value × probability. *Open pipeline* means deals in New, Qualified, Proposal or Negotiation.

### Deleting

- **R30** Every delete asks first in a dialog that names the record and says what happens to the records linked to it, with counts. For example: "Delete Acme Ltd? Its 4 contacts and 3 deals will be kept, with no organization."
- **R31** Deleting an organization keeps its contacts and deals, with the organization cleared.
- **R32** Deleting a contact keeps their deals, with the main contact cleared, and deletes the activities logged on that contact.
- **R33** Deleting a deal deletes its activities and its stage changes.
- **R34** A cleared link shows as "None". A record with a cleared link can be saved while the link stays empty, but a new record still needs every required link (R11, R12).
- **R35** Won deals keep counting on the dashboard after their organization or contact is deleted.

### Tables (Organizations, Contacts, Deals)

- **R40** Each table has a search box that matches any text column, case-insensitively, as you type.
- **R41** Clicking a column heading sorts by it. Clicking again reverses the order. An arrow shows the current sort.
- **R42** Each table has an "Add" button that opens a form in a side panel. Each row has Edit and Delete in a row menu. Clicking a row opens the record's page.
- **R43** Tables show 25 rows per page, with page controls and a count ("Showing 1–25 of 312").
- **R44** Columns:
  - Organizations: Name, Industry, Website, Contacts, Open deals, Open value.
  - Contacts: Name, Organization, Job title, Email, Phone, Status. There's also a status filter (All, Lead, Qualified, Customer) shown as segmented buttons with counts.
  - Deals: Name, Organization, Main contact, Stage, Value, Probability, Expected revenue, Close date. Late deals show a Raspberry "Late" badge and their close date in Raspberry text.
- **R45** Forms check required fields before saving and say what's missing next to the field. The contact form's organization picker includes "Add organization". The deal form's organization and contact pickers include "Add organization" and "Add contact", so a record can be added without leaving the form.
- **R46** An empty table shows a short message and its Add button ("No contacts yet").

### Record pages

- **R50 Organization page:** its details (editable), a contacts list, a deals list, and a combined timeline of its contacts' activities, its deals' activities and its deals' stage changes, newest first.
- **R51 Contact page:** details, organization (a link), deals where they're the main contact, and a timeline. The timeline shows their own activities plus the activities and stage changes of those deals, newest first.
- **R52 Deal page:** details, stage (with a stage picker), organization and contact links, a late warning when it's late, and its timeline.
- **R53** Contact and deal pages have a "Log activity" form: type, description, when it happened, and an optional follow-up date. Activities in a timeline can be edited, deleted (after asking), and marked done when they have a follow-up.
- **R54** Each timeline entry shows an icon for its type, the description, the date and time, and, on organization and contact pages, which deal or contact it came from.

### Pipeline

- **R60** Six columns, New to Lost, each with a header showing the stage name, the number of deals, their total value and their expected revenue. Won and Lost are narrower and show compact rows (name, organization, value, close date). They list the 5 most recently closed deals, with "N more · Show all" to expand the column in place. Their count and value cover deals closed in the last 12 months.
- **R61** Above the board: the total value and expected revenue of the open pipeline (Won and Lost excluded), and a panel with a stacked bar of open value by stage, showing each stage's deal count, value and expected revenue.
- **R62** Open-stage cards show the organization's initials, the deal name, the organization and main contact, the value and close date, and a probability meter in the stage color with its percentage. Late deals show a Raspberry "Late" badge with the date in place of the plain date.
- **R63** Dragging a card to another column changes its stage (R15–R18). Dragging it within a column, or into a gap between two cards in another column, puts it exactly where it was dropped. The order is saved and stays after a refresh.
- **R64** Totals change the moment a card is dropped. If saving fails, the card goes back and an error message says so.
- **R65** Each column has an "Add deal" button that opens the deal form with that stage chosen. The new card goes to the top of the column.
- **R66** Clicking a card opens the deal's page. Dragging also works from the keyboard (dnd-kit's keyboard sensor).

### Dashboard

- **R70** Summary figures: Open pipeline value, Expected revenue, Won this month (value and count), and Win rate over the last 12 months (won ÷ (won + lost), by count).
- **R71 Line chart:** revenue won each month, for the last 12 months.
- **R72 Bar chart:** deals won each month, for the last 12 months, with deals lost shown beside them.
- **R73 Pipeline visual:** open value by stage, as a donut in stage colors with the total open value in the middle and each stage's value listed beside it.
- **R74 Funnel:** for each stage from New to Won, the value of the deals that reached it (Concern 3), with the percentage carried over from the stage before.
- **R75 Recent activity:** the 10 latest activities and stage changes, each linking to its record.
- **R76 Follow-ups:** grouped into Overdue, Today and Next 7 days, each with a checkbox to mark it done, plus a count of later ones. Marking one done removes it from the list straight away.
- **R77** Every figure is worked out from the data each time the dashboard loads. A deal won today counts in this month.
- **R78** With no data, each panel shows a short empty message instead of a blank chart.

### Sample data

- **R80** About 12 organizations across at least 6 industries, 40 contacts covering all three statuses, 45 deals at every stage, and 150 activities.
- **R81** Won and lost deals in every one of the last 12 months, open deals with close dates over the next 3 months, and at least 4 late deals.
- **R82** Follow-ups: some overdue, some due today, some in the next 7 days, some done.
- **R83** Every deal has a stage history that fits its current stage. Dates are relative to the day the data is generated, so the sample data always looks current.
- **R84** Names are realistic but made up, with no real companies.

## Design

### Layout

The chosen direction is mockup B, in `docs/mockups/b-hero-topnav/`. Its screenshots are the visual reference for the dashboard and pipeline.

- A floating top bar: a white rounded panel 16px below the top of the window, spanning the content width. It holds the Accountable wordmark (a Midnight square mark with a Sea Green "A"), then the tabs Dashboard, Pipeline, Deals, Contacts and Organizations, with "Add deal" on the right. The active tab is a Midnight pill with white text, and the others are in Muted ink. There is no line under the bar.
- There is no user name or avatar anywhere, since the MVP has no accounts.
- The content area has the page background `#F0F4F5`, a maximum width of 1440px, and a 32px gutter. Each page has a title (Instrument Sans 28px, semibold) with a short line of help or figures beside it.
- Content sits in white panels with 12px corners, no outline and a soft shadow (`0 1px 2px rgba(7,59,76,.06), 0 4px 16px rgba(7,59,76,.04)`). No single-edge borders and no rule along the top of the page.
- Forms open in a right-hand side panel 480px wide. Delete confirmations open in a centered dialog.

### Typography

| Use | Font | Size / weight |
|---|---|---|
| Page title | Instrument Sans | 28px / 600 |
| Panel heading | Instrument Sans | 16px / 600 |
| Body and table text | Instrument Sans | 14px / 400 |
| Labels and captions | Instrument Sans | 12px / 500, Muted ink |
| Money, percentages, counts, dates in tables | JetBrains Mono | 13–14px / 500, tabular figures |
| Big dashboard figures | JetBrains Mono | 32px / 600 |
| Dashboard greeting ("Good morning") | Instrument Serif | 34px italic, white on Midnight |
| Empty-state line | Instrument Serif | 20px italic |

Fonts load from `@fontsource/instrument-sans`, `@fontsource/instrument-serif` and `@fontsource/jetbrains-mono` (R2).

### Color tokens

All colors are CSS custom properties in one tokens file. The contrast figures are against white panels.

| Token | Value | Use |
|---|---|---|
| `--page` | `#F0F4F5` | Page background |
| `--panel` | `#FFFFFF` | Panels, cards, tables |
| `--ink` | `#073B4C` | Main text (12.1:1) |
| `--ink-muted` | `#5B7A85` | Secondary text, on white only (4.6:1) |
| `--sea-green` | `#06D6A0` | Primary fills, buttons (Midnight text) |
| `--sea-green-text` | `#047857` | Sea Green as text (5.5:1) |
| `--marigold` | `#FFC145` | Fills (Midnight text) |
| `--marigold-text` | `#8A5A00` | Marigold as text (5.9:1) |
| `--coral` | `#F78C6B` | Fills (Midnight text) |
| `--coral-text` | `#B54A2A` | Coral as text (5.3:1) |
| `--cerulean` | `#118AB2` | Information fills, links in bold (white bold text) |
| `--cerulean-text` | `#0E7194` | Links and info text (5.5:1) |
| `--raspberry` | `#EF476F` | Late and alert fills (white bold text) |
| `--raspberry-text` | `#D12E57` | Late dates, errors (5.0:1) |
| `--sea-mist` | `#CDD8DB` | Sidebar text, New stage, neutral fills |

Stage colors (Concern 2): New `--sea-mist`, Qualified `--cerulean`, Proposal `--marigold`, Negotiation `--coral`, Won `--sea-green`, Lost `--raspberry`. Contact status badges: Lead `--sea-mist`, Qualified `--cerulean`, Customer `--sea-green`.

Gradients are used at most once: a faint Sea Green fill under the revenue line. Nowhere else.

### Components

- **Buttons:** primary is a Sea Green fill with Midnight text, 8px corners, 36px high. Secondary is white with Midnight text and a soft shadow. Destructive is a Raspberry fill with white bold text, used only in delete dialogs.
- **Badges:** pill shaped, 12px/600, stage or status color fill. White text on Cerulean and Raspberry, Midnight text on the rest.
- **Tables:** header row in 12px/500 Muted ink, rows 48px high, a light `#F0F4F5` row hover, and numbers right-aligned in JetBrains Mono.
- **Pipeline cards:** white, 10px corners, 12px padding. A 30px rounded square with the organization's initials sits at the top left, beside the deal name (14px/600) and "organization · contact" in Muted ink. Below them come the value in JetBrains Mono and the close date or Late badge, then a 5px probability meter in the stage color with the percentage. A small colored dot by the column title gives the stage color; cards don't get colored edges. "Add deal" sits at the top of each open column as a dashed outline button. A dragged card lifts with a larger shadow, and the drop gap shows as a dashed Sea Mist placeholder.
- **Closed rows (Won and Lost columns):** white, 10px corners, one line each: the name (cut short with an ellipsis if needed) and organization on the left, the short value and date on the right.
- **Timeline:** a vertical list with a round icon per entry. Note, call and email use Cerulean icons on a light tint. Stage changes use the destination stage's color.

### Dashboard layout

Three rows on a 12-column grid:

1. **Hero panel**, full width: a Midnight panel with 16px corners. On the left (360px) are the greeting "Good morning", "Good afternoon" or "Good evening", then the date and a one-line summary ("2 follow-ups overdue, 3 deals running late"). Below them sit the four summary figures (R70) in a 2 × 2 grid, white JetBrains Mono at 28px with Sea Mist labels; Won this month is in Sea Green. On the right is the revenue won line chart (R71), with Sea Mist axis text and dark gridlines (`#0F4C60`). This is the one place a gradient is used, as the faint Sea Green fill under the line.
2. Funnel (R74), 5 columns; deals won and lost bar chart (R72), 4 columns; open value by stage donut (R73), 3 columns.
3. Follow-ups (R76), 6 columns; recent activity (R75), 6 columns.

Charts use Recharts, with chart text in Instrument Sans 12px Muted ink, light Sea Mist gridlines, no chart borders, and tooltips in white panels.

### Writing

- Short labels in plain business English: "Add deal", "Log activity", "Mark done". No exclamation marks.
- Money always shows its currency: `$12,500` in tables and cards, and `$1.2M` for big figures on dashboard tiles. Column headings say "Value (USD)".
- Dates: `12 Nov 2026` in tables, `12 Nov 2026, 14:30` in timelines, and "Today" or "Yesterday" for recent ones.
- Errors say what happened and what to do: "Couldn't save the deal. Check the app is still running and try again."

## Technical design

### Libraries

| Need | Library |
|---|---|
| Routing | React Router |
| Server data and caching | TanStack Query |
| Tables | TanStack Table |
| Forms and validation | React Hook Form with Zod |
| Charts | Recharts |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| UI primitives (dialog, menu, select) | Radix UI |
| Icons | lucide-react |
| Dates | date-fns |
| Backend | FastAPI, SQLAlchemy Core, Pydantic |
| Running both together | concurrently |

Tables load each list in full and search, sort and page in the browser. At 1,000 rows this is fast and keeps the API simple (R6).

### Database (SQLite, `backend/data/accountable.db`)

- `organizations`: id, name, website, industry, notes, created_at, updated_at
- `contacts`: id, organization_id (nullable, `ON DELETE SET NULL`), name, email, phone, job_title, status, created_at, updated_at
- `deals`: id, organization_id (nullable, `SET NULL`), contact_id (nullable, `SET NULL`), name, stage, value, probability, close_date, position (float), created_at, updated_at
- `activities`: id, type, contact_id (nullable, `CASCADE`), deal_id (nullable, `CASCADE`), description, occurred_at, follow_up_date (nullable), done (bool). A check constraint requires exactly one of contact_id or deal_id.
- `stage_changes`: id, deal_id (`CASCADE`), from_stage (nullable for creation), to_stage, changed_at

Foreign keys are switched on for every connection (`PRAGMA foreign_keys = ON`). The "required" rules for new records (R11, R12) are enforced in the API, so links cleared by a delete stay valid.

Pipeline order uses `position`. A card dropped between two others gets the midpoint of their positions. When the gap gets too small, that column is renumbered.

### API (JSON, under `/api`)

- `GET/POST /organizations`, `GET/PATCH/DELETE /organizations/{id}`, `GET /organizations/{id}/timeline`
- `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/{id}`, `GET /contacts/{id}/timeline`
- `GET/POST /deals`, `GET/PATCH/DELETE /deals/{id}`, `GET /deals/{id}/timeline`
- `POST /deals/{id}/move` with `{stage, before_id?, after_id?}`: changes the stage and position in one transaction, and applies R15–R18.
- `GET/POST /activities`, `PATCH/DELETE /activities/{id}`
- `GET /{type}/{id}/delete-impact`: the counts for the delete dialog (R30)
- `GET /dashboard`: every dashboard figure in one response (R70–R77)

A stage change made through `PATCH /deals/{id}` follows the same rules as `/move`. Validation errors return 422 with a message for each field, and the form shows them next to the fields.

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Installs what's missing (first run), starts both servers and prints the address |
| `npm test` | Runs Vitest, pytest and Playwright against a separate test database |
| `npm run seed` | Asks, then resets to sample data (`--yes` skips the question) |
| `npm run clear` | Asks, then empties every table (`--yes` skips the question) |

### Testing

- **Backend (pytest):** stage rules (R14–R18), delete behaviour (R31–R35), validation (R11, R12, R34), funnel and dashboard figures against known data, and move ordering.
- **Frontend (Vitest):** money and date formatting, late-deal logic, probability prefill in the deal form, and table search and sort.
- **End to end (Playwright with installed Chrome):** start the app, land on the dashboard, and do the full round for each record type (add, find, sort, edit, delete with its warning). Then drag across and within columns and reload, log a follow-up and see it on the dashboard, mark a deal won and check the dashboard figures and the contact's status, and fail the test on any console error.
- **By hand, before calling it done:** a full walkthrough in a real browser as a salesperson, every screen checked by eye, then the project owner's own review (intent success criterion 9).

## Out of scope

As listed in the intent: sign-in and multiple users, dark mode, phone layouts, AI, integrations, other currencies, reports beyond the dashboard, tags and custom fields, editable stages, and import or export.
