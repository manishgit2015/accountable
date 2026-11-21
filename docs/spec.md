# Spec: the Accountable MVP

## Area A: Context and traceability

## 1. Overview and references

### Purpose

This spec turns the approved intent into a design to build from. It's meant to be precise enough that two engineers, or two coding agents, would build broadly the same thing. It says what the MVP does, how its parts fit together, how it behaves when things go wrong, and how each requirement is proven.

### Scope

The scope is exactly the approved intent's (`docs/intent.md`, section 5):

- **In scope:** a sales CRM for one salesperson on their own computer. It has five sections (Dashboard, Organizations, Contacts, Deals, Pipeline), four kinds of record (organization, contact, deal, activity), sample data with reset and empty commands, and a light-mode desktop layout that follows the brand.
- **Out of scope:**
  - sign-in, user accounts or several users
  - dark mode or a phone layout
  - AI features
  - email, calendar or phone integrations
  - currencies other than US dollars
  - reports beyond the dashboard
  - tags or custom fields
  - changing the pipeline stages
  - importing or exporting data, including backups made by the app

Nothing in this spec widens that scope. Where the intent leaves a choice open, this spec makes one and marks it (see "Markers" below). The intent wins if the two ever disagree.

### Version

| | |
|---|---|
| Version | 2.0 (draft). Restructures 1.x into 18 sections and adds architecture, security, reliability, operations and governance. |
| Date | 21 Nov 2026 |
| Status | Approved 21 Nov 2026 (section 18) |

### References

| Document | Role |
|---|---|
| `docs/intent.md` | The approved intent (approved 21 Nov 2026). Section numbers below are written as "intent §5", and its success and acceptance criteria as SC1–SC5 and AC1–AC9. |
| `docs/TECH_STACK.md` | The stack. This is a constraint from the intent (§8). |
| `.claude/skills/brand` | Fonts, colors, surfaces and tone |
| `docs/mockups/1-spec-reference/` | The approved visual reference for the dashboard and pipeline (mockup 1, approved 21 Nov 2026). It replaces mockup B, which set the layout and has been removed. |
| `docs/plan.md` | The build plan. It needs refreshing to match this version (section 18). |
| Architecture decisions | ADR-001 to ADR-017, in section 16.3. There are no separate ADR files yet. |

### Markers and IDs

- **Unmarked** statements are approved by the product owner, either through the intent or through a decision recorded in section 16.3.
- *[Assumption]* means believed true but not confirmed.
- *(threshold approved 21 Nov 2026)* means a number drafted by the architect and approved by the product owner on that date.
- *(approved 21 Nov 2026)* means a design decision proposed by the architect and approved by the product owner on that date.
- *[Unapproved]* means a design decision proposed here and not yet approved.
- Requirement IDs are stable. R1–R84 keep the numbers they had in version 1.x, and new ones fill unused numbers. The other prefixes are NFR (nonfunctional), SEC (security), REL (reliability), OBS (observability), DEP (deployment), ENG (engineering standards), WF (workflows), V (verification cases) and ADR (decisions). An ID is never reused for something else.

## 2. Requirements traceability

Each row runs from the approved intent to the requirements here, then to the verification that proves them. The V IDs are defined in section 13.3.

| Intent | Requirements | Verification | Acceptance or success criterion |
|---|---|---|---|
| §6 Dashboard | R70–R79 | V-B10, V-F09, V-E07, V-E01 | AC6, AC7 |
| §6 Organizations | R10, R44, R50 | V-B03, V-B09, V-E02, V-E05 | AC2, AC3 |
| §6 Contacts | R11, R44, R51 | V-B04, V-B09, V-F06, V-E03, V-E05 | AC2, AC3 |
| §6 Deals | R12, R19, R44, R52 | V-B05, V-F05, V-E04, V-E05 | AC2, AC4 |
| §6 Pipeline | R60–R67 | V-B06, V-F07, V-F08, V-E06 | AC4 |
| §6 Tables | R40–R48 | V-F03, V-E02–V-E04 | AC2 |
| §6 Activities and follow-ups | R13, R53–R56, R76 | V-B08, V-F09, V-E08 | AC5 |
| §6 The four kinds of record | R10–R13, R21, R22 | V-B02–V-B05, V-B08 | AC2 |
| §6 Sample data | R80–R84 | V-B11, V-E01 | AC1 |
| §9 Stages and probability | R14, R15 | V-B01, V-B06, V-F05 | AC4 |
| §9 Winning and losing | R16, R17, R18 | V-B01, V-B06, V-E07 | AC6 |
| §9 Required information | R11, R12, R34 | V-B04, V-B05, V-F05, V-F06 | AC2 |
| §9 Deleting | R30–R35 | V-B07, V-F04, V-E02 | AC2 |
| §9 Commands and data | R1, R4, DEP-1–DEP-6 | V-B12, V-E09, V-M02 | AC1, AC2 |
| §7 Performance | R6, NFR-1–NFR-3 | V-P01 | (none) |
| §7 Availability (offline) | R2, NFR-4 | V-E00 (every e2e test), V-M02 | AC1 |
| §7 Reliability and persistence | R3, REL-1–REL-3 | V-B13, V-E10, V-M03 | AC2, AC8 |
| §7 Security | SEC-1–SEC-12 | V-S01–V-S10 | (none) |
| §7 Accessibility | NFR-7 | V-E11, V-M04 | (none) |
| §7 Usability | NFR-8 | V-M05 | SC1 |
| §7 Look and feel | NFR-9, section 3.9 | V-M04 | SC5 |
| §7 Portability | R1, NFR-6 | V-M02 | AC1 |
| §10 Business outcomes | (measured in use) | V-M06 | SC2, SC3, SC4 |
| §11 End-to-end use | (all of the above) | V-M01 | AC9 |

## Area B: Functional design

## 3. Functional requirements

### 3.1 Records and validation

- **R10 Organization:** name (required), website, industry, notes.
- **R11 Contact:** name (required), organization (required on create, including for leads), email, phone, job title, and status (lead, qualified or customer; defaults to lead).
- **R12 Deal:** name, organization, main contact, stage, value in US dollars (a whole number) and close date are all required on create. Probability of close is a whole-number percentage.
- **R13 Activity:** type (note, call or email), and a contact *or* a deal (exactly one). Description is required. "When it happened" defaults to now and may be in the future, for planned activity. There's an optional follow-up date and a done flag, which starts as not done.
- **R21 Field rules** *(threshold approved 21 Nov 2026)*. Text is trimmed before it's checked, and a value that's blank after trimming counts as empty.

  | Field | Rule |
  |---|---|
  | Names | 1–200 characters |
  | Email | Up to 254 characters, and must have the shape `name@domain.tld` when given |
  | Phone | Up to 40 characters, made only of digits, spaces and `+ ( ) - .` |
  | Website | Up to 2,048 characters. Must start with `http://` or `https://`, or be a bare domain, which is saved with `https://` in front. Any other scheme (for example `javascript:`) is refused. |
  | Industry, job title | Up to 100 characters each |
  | Notes, description | Up to 5,000 characters each |
  | Value | 0 to 1,000,000,000 |
  | Probability | 0 to 100 |
  | Dates | Real calendar dates in `YYYY-MM-DD` form |

- **R22 Duplicates are allowed.** Two organizations or contacts may share a name, because the intent sets no rule against it *(approved 21 Nov 2026)*. The alternative is to warn when a new name matches an existing one: it catches typos, but adds a step to every add.

### 3.2 Deal rules

- **R14 Stage probabilities:** New 5%, Qualified 20%, Proposal 40%, Negotiation 70%, Won 100%, Lost 0%.
- **R15** When a deal's stage changes, by any route, its probability becomes the new stage's usual one. A probability set by hand is kept until the next stage change. In the edit form, changing the stage fills in the new usual probability, which can be overwritten before saving. If one save changes both stage and probability, the probability sent is kept.
- **R16** When a deal moves to Won or Lost, by any route, its close date becomes today (the computer's local date). It can be edited afterwards.
- **R17** When a deal moves to Won, its main contact's status becomes customer if it isn't already. Nothing changes it back. A deal with no main contact changes no contact.
- **R18** Every stage change is saved with its local date and time and its from and to stages. That includes the stage a deal was created at, saved with no from stage. Saving a deal with its stage unchanged adds no row. The timeline shows a change as "Moved from Proposal to Negotiation", and creation as "Created at New".
- **R19** A deal is *late* when it's in an open stage (New to Negotiation) and its close date is before today.
- **R20** Expected revenue is value × probability ÷ 100, rounded to the nearest dollar for display. The open pipeline means deals in New, Qualified, Proposal or Negotiation.
- **R23** The main contact must belong to the deal's organization. This is checked whenever either is set or changed. A link already cleared by a delete is exempt until someone fills it in.
- **R24** Any stage can move to any other stage, including from Won or Lost back to an open stage. Reopening keeps the close date and the contact's customer status.

### 3.3 Deleting

- **R30** Every delete asks first, in a dialog that names the record and says what happens to its linked records, with counts. For example: "Delete Acme Ltd? Its 4 contacts and 3 deals will be kept, with no organization." The counts come from the server when the dialog opens.
- **R31** Deleting an organization keeps its contacts and deals, with the organization cleared.
- **R32** Deleting a contact keeps their deals, with the main contact cleared, and deletes the activities logged on that contact.
- **R33** Deleting a deal deletes its activities and its stage changes.
- **R34** A cleared link shows as "None". A record with a cleared link can be saved while the link stays empty, but a new record still needs every required link (R11, R12).
- **R35** Won deals keep counting on the dashboard after their organization or contact is deleted.
- **R36** Deleting is permanent. There's no undo or trash, because the intent asks for none and backups are the user's job.

### 3.4 Tables (Organizations, Contacts, Deals)

- **R40** Each table has a search box that matches any text column, ignoring case, and updates as you type.
- **R41** Clicking a column heading sorts by it. Clicking again reverses the order, and an arrow shows the current sort.
- **R42** Each table has an "Add" button that opens a form in a side panel. Each row has Edit and Delete in a row menu, and clicking a row opens the record's page.
- **R43** Tables show 25 rows per page, with page controls and a count ("Showing 1–25 of 312").
- **R44** Columns:
  - **Organizations:** Name, Industry, Website, Contacts, Open deals, Open value.
  - **Contacts:** Name, Organization, Job title, Email, Phone, Status. A status filter (All, Lead, Qualified, Customer) appears as segmented buttons with counts.
  - **Deals:** Name, Organization, Main contact, Stage, Value, Probability, Expected revenue, Close date. Late deals show a Raspberry "Late" badge and their close date in Raspberry text.
- **R45** Forms check fields before saving and say what's wrong next to each field. The contact form's organization picker includes "Add organization". The deal form's organization and contact pickers include "Add organization" and "Add contact", so a record can be added without leaving the form. The server checks the same rules (R21, R23) whatever the form does.
- **R46** An empty table shows a short message and its Add button, for example "No contacts yet".
- **R47** Default sort *(approved 21 Nov 2026)*: organizations and contacts by name A–Z, and deals by close date with the soonest first. Search and sort reset when the page is left.
- **R48** A save that the server refuses keeps the form open with what was typed, and shows the server's messages next to the fields.

### 3.5 Record pages

- **R50 Organization page:** its details (editable), a contacts list, a deals list, and one timeline combining its contacts' activities, its deals' activities and its deals' stage changes, newest first.
- **R51 Contact page:** details, organization (as a link, or "None"), deals where they're the main contact, and a timeline. The timeline shows their own activities plus the activities and stage changes of those deals, newest first.
- **R52 Deal page:** details, stage (with a stage picker), organization and contact links, a late warning when it's late, and its timeline.
- **R53** Contact and deal pages have a "Log activity" form with type, description, when it happened, and an optional follow-up date.
- **R54** Each timeline entry shows an icon for its type, the description, the date and time, and, on organization and contact pages, which deal or contact it came from.
- **R55** Activities in a timeline can be edited and deleted (after asking). Ones with a follow-up can be marked done or not done. Stage change entries can't be edited or deleted.
- **R56** A record page for an ID that doesn't exist, or that was deleted in another tab, shows "This organization no longer exists" (or contact, or deal), with a link back to the list.

### 3.6 Pipeline

- **R60** Six columns, New to Lost, each with a header showing the stage name, the number of deals, their total value and their expected revenue. Won and Lost are narrower and show compact rows (name, organization, value, close date). They hold only deals closed this calendar month (by `closed_at`, local time). They list the 5 most recent, with "N more · Show all" to expand the column in place, and their count and value cover this month only. Deals closed in earlier months stay in the Deals table and on the dashboard, but leave the board (C-2, approved 21 Nov 2026).
- **R61** Above the board: the total value and expected revenue of the open pipeline (Won and Lost excluded), and a panel with a stacked bar of open value by stage, showing each stage's deal count, value and expected revenue.
- **R62** Open-stage cards show the organization's initials, the deal name, the organization and main contact, the value and close date, and a probability meter in the stage color with its percentage. Late deals show a Raspberry "Late" badge with the date in place of the plain date.
- **R63** Dragging a card to another column changes its stage (R15–R18). Dragging it within a column, or into a gap between two cards in another column, puts it exactly where it was dropped. The order is saved and survives a refresh.
- **R64** Totals change the moment a card is dropped. If the save fails, the card goes back, the totals are restored, and an error message says so.
- **R65** Each open column has an "Add deal" button that opens the deal form with that stage chosen. The new card goes to the top of its column.
- **R66** Clicking a card opens the deal's page. Dragging also works from the keyboard: focus a card, press Space to lift it, use the arrow keys to move it, Space to drop and Escape to cancel.
- **R67** A deal whose stage changes anywhere else (its edit form or its page) goes to the top of its new column.

### 3.7 Dashboard

- **R70** Summary figures: open pipeline value, expected revenue, won this month (value and count), and win rate over the last 12 months (won ÷ (won + lost), by count). With no closed deals, the win rate shows "None yet".
- **R71 Line chart:** revenue won each month for the last 12 months, the current month included.
- **R72 Bar chart:** deals won each month for the last 12 months, with deals lost shown beside them.
- **R73 Pipeline visual:** open value by stage, as a donut in stage colors with the total open value in the middle and each stage's value listed beside it.
- **R74 Funnel:** for each stage from New to Won, the value of the deals that reached it, with the percentage carried over from the stage before. It counts deals created in the last 12 months. A deal counts at every open stage up to the furthest one its history reached, and a won deal counts at every stage (C-1, approved 21 Nov 2026).
- **R75 Recent activity:** the 10 latest activities and stage changes, each linking to its record.
- **R76 Follow-ups:** open follow-ups grouped into Overdue (due before today), Today and Next 7 days, each with a checkbox to mark it done, plus a count of those due later. Marking one done removes it from the list straight away.
- **R77** Every figure is worked out from the data each time the dashboard loads. A deal won today counts in this month. Months are calendar months in local time.
- **R78** With no data, each panel shows a short empty message instead of a blank chart, and the figures show $0 or "None yet".
- **R79** The greeting is "Good morning" before 12:00, "Good afternoon" from 12:00 to 17:59, and "Good evening" from 18:00, by local time. A one-line summary beside it counts the overdue follow-ups and late deals ("2 follow-ups overdue, 3 deals running late"), or says "Nothing overdue".

### 3.8 Sample data and commands

- **R1** One command, `npm run dev`, installs anything missing on its first run, starts the app and prints the address to open (`http://127.0.0.1:5173`, rather than `localhost`, which some systems resolve to the IPv6 address the servers don't listen on). It works on Mac, Linux and Windows, with Node 24 or later and uv installed beforehand.
- **R4** A new database is filled with sample data. `npm run seed` resets it to the sample data and `npm run clear` empties it. Both ask "Type yes to continue" and do nothing unless the answer is `yes`, and `--yes` skips the question.
- **R80** About 12 organizations across at least 6 industries, 40 contacts covering all three statuses, 45 deals at every stage, and 150 activities.
- **R81** Won and lost deals in every one of the last 12 months, open deals with close dates over the next 3 months, and at least 4 late deals.
- **R82** Follow-ups that are overdue, due today, due in the next 7 days, due later, and done.
- **R83** Every deal has a stage history that starts with its creation and ends at its current stage. Dates are relative to the day the data is generated, so the sample data always looks current.
- **R84** Names are realistic but made up, with no real companies.

### 3.9 Look and feel

The look follows the brand guidelines and mockup 1, as detailed below. These rules are verified by eye (V-M04).

#### Layout

- A floating top bar: a white rounded panel 16px below the top of the window, spanning the content width. It holds the Accountable wordmark (a Midnight square mark with a Sea Green "A"), the tabs Dashboard, Pipeline, Deals, Contacts and Organizations, and "Add deal" on the right. The active tab is a Midnight pill with white text, and the others are in Muted ink. There's no line under the bar.
- There's no user name or avatar anywhere.
- The content area has the page background `#F0F4F5`, a maximum width of 1440px and a 32px gutter. Each page has a title (Instrument Sans 28px, semibold).
- Content sits in white panels with 12px corners, no outline and a soft shadow (`0 1px 2px rgba(7,59,76,.06), 0 4px 16px rgba(7,59,76,.04)`). There are no single-edge borders and no rule along the top of the page.
- Forms open in a right-hand side panel 480px wide. Delete confirmations open in a centered dialog.

#### Typography

| Use | Font | Size and weight |
|---|---|---|
| Page title | Instrument Sans | 28px / 600 |
| Panel heading | Instrument Sans | 16px / 600 |
| Body and table text | Instrument Sans | 14px / 400 |
| Labels and captions | Instrument Sans | 12px / 500, Muted ink |
| Money, percentages, counts and dates | JetBrains Mono | 13–14px / 500, tabular figures |
| Big dashboard figures | JetBrains Mono | 28–32px / 600 |
| Dashboard greeting | Instrument Serif | 34px italic, white on Midnight |
| Empty-state line | Instrument Serif | 20px italic |

Fonts are bundled from `@fontsource/instrument-sans`, `@fontsource/instrument-serif` and `@fontsource/jetbrains-mono`.

#### Color tokens

All colors are CSS custom properties in one tokens file, and components use only tokens. Contrast figures are against white.

| Token | Value | Use |
|---|---|---|
| `--page` | `#F0F4F5` | Page background |
| `--panel` | `#FFFFFF` | Panels, cards, tables |
| `--ink` | `#073B4C` | Main text (12.1:1) |
| `--ink-muted` | `#5B7A85` | Secondary text, on white only (4.6:1) |
| `--sea-green` | `#06D6A0` | Primary fills and buttons, with Midnight text |
| `--sea-green-text` | `#047857` | Sea Green as text (5.5:1) |
| `--marigold` | `#FFC145` | Fills, with Midnight text |
| `--marigold-text` | `#8A5A00` | Marigold as text (5.9:1) |
| `--coral` | `#F78C6B` | Fills, with Midnight text |
| `--coral-text` | `#B54A2A` | Coral as text (5.3:1) |
| `--cerulean` | `#118AB2` | Information fills, with bold white text |
| `--cerulean-text` | `#0E7194` | Links and information text (5.5:1) |
| `--raspberry` | `#EF476F` | Late and alert fills, with bold white text |
| `--raspberry-text` | `#D12E57` | Late dates and errors (5.0:1) |
| `--sea-mist` | `#CDD8DB` | New stage and neutral fills |

- **Stage colors:** New Sea Mist, Qualified Cerulean, Proposal Marigold, Negotiation Coral, Won Sea Green, Lost Raspberry.
- **Contact status:** Lead Sea Mist, Qualified Cerulean, Customer Sea Green.
- White text on Cerulean or Raspberry is used only for bold text of 14px or more. Anything smaller with white text, such as badges, uses the darker `--cerulean-text` (5.5:1) or `--raspberry-text` (5.0:1) as its fill instead (ADR-017).
- The only gradient is the faint Sea Green fill under the revenue line.

#### Components

- **Buttons:** primary is a Sea Green fill with Midnight text, 8px corners and 36px high. Secondary is white with a soft shadow. Destructive is a Raspberry fill with bold white text, used only in delete dialogs.
- **Badges:** pill shaped, 12px/600. New, Proposal, Negotiation, Won, Lead and Customer badges are filled with their stage or status color, with Midnight text. Qualified (stage and status) badges are filled with `--cerulean-text`, and Late and Lost badges with `--raspberry-text`, both with white text (ADR-017).
- **Tables:** header row in 12px/500 Muted ink, rows 48px high, a `#F0F4F5` row hover, and numbers right-aligned in JetBrains Mono.
- **Pipeline cards:** white, 10px corners and 12px padding. A 30px rounded square with the organization's initials sits beside the name (14px/600) and "organization · contact" in Muted ink. Below them come the value and the date or Late badge, then a 5px probability meter in the stage color with the percentage. "Add deal" is a dashed outline button at the top of each open column. A dragged card lifts with a larger shadow, and the drop gap is a dashed Sea Mist placeholder.
- **Closed rows:** white and 10px corners. Each is one line: the name (shortened with an ellipsis) and organization on the left, the short value and date on the right.
- **Timeline:** round icons. Note, call and email use Cerulean on a light tint, and stage changes use the destination stage's color.

#### Dashboard layout (12-column grid)

1. **Hero panel**, full width: Midnight with 16px corners. On the left (360px) are the greeting (R79), the date, the summary line, and the four figures (R70) in a 2 × 2 grid. They're in white JetBrains Mono with Sea Mist labels, and won this month is in Sea Green. On the right is the revenue line chart (R71), with Sea Mist axis text and `#0F4C60` gridlines.
2. Funnel (R74), 5 columns; won and lost bars (R72), 4 columns; donut (R73), 3 columns.
3. Follow-ups (R76), 6 columns; recent activity (R75), 6 columns.

Charts have no borders, their text is Instrument Sans 12px, and their tooltips sit in white panels.

#### Writing

- Short labels in plain business English, such as "Add deal", "Log activity" and "Mark done". No exclamation marks.
- Money always shows its currency: `$12,500` in tables and cards, and `$1.2M` for large figures. Column headings say "Value (USD)".
- Dates appear as `12 Nov 2026` in tables and `12 Nov 2026, 14:30` in timelines, with "Today" and "Yesterday" for recent ones.
- Errors say what happened and what to do, for example "Couldn't save the deal. Check the app is still running and try again."

## 4. User journeys and workflows

### 4.1 Journeys

| ID | Journey | Steps | End state |
|---|---|---|---|
| WF-1 | First run | Install Node and uv (documented), clone, run `npm run dev`, open the printed address | The dashboard shows sample data (AC1) |
| WF-2 | Explore, then start for real | Browse every section on the sample data, stop the app, run `npm run clear`, type `yes`, start again | Every screen shows its empty state and works (AC2) |
| WF-3 | Add a lead | Contacts → Add contact → organization picker → "Add organization" → save the organization → back in the contact form with it chosen → status Lead → save | The contact is in the table and on the organization's page |
| WF-4 | Add and work a deal | Pipeline → "Add deal" in Qualified → pick organization and contact → save → the card is at the top of Qualified → drag it to Proposal | Stage and probability are updated, totals move, and the timeline shows "Moved from Qualified to Proposal" |
| WF-5 | Log and finish a follow-up | Contact page → Log activity → Call, description, follow-up date tomorrow → save → Dashboard → Next 7 days → tick it | The timeline shows the call, and the dashboard list no longer does (AC5) |
| WF-6 | Win a deal | Drag a card to Won | Close date is today, probability 100%, contact becomes customer, won this month and the revenue chart rise, and recent activity shows the move (AC6) |
| WF-7 | Reopen a deal | Drag a Won row back to Negotiation | Probability 70%, close date unchanged (so it may show Late), contact stays customer |
| WF-8 | Delete with links | Organizations → row menu → Delete → the dialog gives the counts → confirm | The organization is gone, and its contacts and deals show "None" (AC2) |
| WF-9 | Reset | `npm run seed`, type `yes` | The sample data is back, and the running app shows it on refresh |
| WF-10 | Recover after a crash | Power is lost while using the app, then the computer and app are started again | Every change the app showed as saved is there (AC8) |

### 4.2 Deal stage states

Any stage can move to any other (R24). These are the effects of each kind of move:

| Move | Probability | Close date | Main contact | Stage change row |
|---|---|---|---|---|
| Created at a stage | That stage's usual one, unless set in the form | As entered (required) | Unchanged | From none to the stage |
| Open → another open stage | The new stage's usual one | Unchanged | Unchanged | Yes |
| Any → Won | 100% | Today | Becomes customer | Yes |
| Any → Lost | 0% | Today | Unchanged | Yes |
| Won or Lost → open stage | The new stage's usual one | Unchanged | Unchanged (stays customer) | Yes |
| Same stage, new place in the column | Unchanged | Unchanged | Unchanged | No |
| Saved with no stage change | As sent | As sent | Unchanged | No |

### 4.3 Follow-up states

An activity's follow-up is one of three things:

- **None:** there's no follow-up date.
- **Open:** it has a date and isn't done. It shows as Overdue, Today, Next 7 days or Later, worked out from today's date each time.
- **Done:** it's no longer listed on the dashboard. Unticking it in the timeline makes it open again.

### 4.4 Contact status

Lead, qualified and customer can each be set by hand to any other. The only automatic change is to customer, when one of their deals is won (R17).

### 4.5 Edge cases

| Case | Behavior |
|---|---|
| A deal's organization is changed so the main contact no longer matches | The save is refused with "Choose a contact from Acme Ltd" next to the contact (R23) |
| A deal whose contact was cleared by a delete is moved to Won | No contact changes (R17), and the move succeeds |
| A drop lands between two cards in another column | The card takes the midpoint position, and if the gap is too small the column is renumbered first (section 6.4) |
| A drop refers to a card that's since been deleted or moved (another tab) | The server answers 409 `stale_position`. The board reloads and says "The board changed. Try again." |
| A follow-up date in the past is entered | Accepted, and it shows as Overdue |
| An activity's "when it happened" is in the future | Accepted, as planned activity (R13) |
| A record is opened by an ID that doesn't exist | R56 |
| The same record is saved in two tabs | The last save wins (ADR-003) |
| A double-click on Save | The button is disabled while saving, so only one record is created (REL-5) |
| A very long name | Up to 200 characters is accepted, and it's shortened with an ellipsis in cards and rows |
| A search with no matches | "No matches for 'xyz'", with a clear-search link |
| The month boundary, at midnight on the last day | Figures follow local time each time the dashboard loads (R77) |
| Clearing while the app is open | Allowed. The next refresh shows empty states (REL-10). |

## 5. API and interface contracts

### 5.1 Conventions

- **Base path:** `/api`, served by the backend on `127.0.0.1` (SEC-1). The frontend reaches it through the Vite proxy, so it sees one origin.
- **Versioning:** the API is unversioned in the MVP, because the bundled frontend is its only client (ADR-009). A breaking change after the API gets other clients would be released as `/api/v2`.
- **Format:** JSON in UTF-8. Requests with a body need `Content-Type: application/json`, or get 415. Bodies over 1 MB get 413 *(threshold approved 21 Nov 2026)*.
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

## 6. Data design

### 6.1 Entities

All tables live in one SQLite database file. Its path defaults to `backend/data/accountable.db` and can be changed with `ACCOUNTABLE_DB`.

| Table | Columns and constraints |
|---|---|
| `organizations` | `id` INTEGER PRIMARY KEY, `name` TEXT NOT NULL, `website`, `industry`, `notes` TEXT NULL, `created_at`, `updated_at` TEXT NOT NULL |
| `contacts` | `id`, `organization_id` → organizations ON DELETE SET NULL, `name` NOT NULL, `email`, `phone`, `job_title` NULL, `status` NOT NULL CHECK in (lead, qualified, customer) DEFAULT lead, timestamps |
| `deals` | `id`, `organization_id` → organizations SET NULL, `contact_id` → contacts SET NULL, `name` NOT NULL, `stage` NOT NULL CHECK in the six stages, `value` INTEGER NOT NULL CHECK 0–1,000,000,000, `probability` INTEGER NOT NULL CHECK 0–100, `close_date` TEXT NOT NULL, `position` REAL NOT NULL, `closed_at` TEXT NULL, timestamps |
| `activities` | `id`, `type` CHECK in (note, call, email), `contact_id` → contacts ON DELETE CASCADE, `deal_id` → deals CASCADE, `description` NOT NULL, `occurred_at` NOT NULL, `follow_up_date` NULL, `done` INTEGER NOT NULL DEFAULT 0. CHECK that exactly one of `contact_id` and `deal_id` is set. |
| `stage_changes` | `id`, `deal_id` → deals CASCADE, `from_stage` NULL, `to_stage` NOT NULL, `changed_at` NOT NULL |
| `alembic_version` | Managed by Alembic (ADR-004) |

`closed_at` is the date and time a deal last moved to Won or Lost, and is null while it's open. The month-by-month figures and the "last 12 months" windows use it, not `close_date`, because a user can edit `close_date` afterwards (R16). Approved 21 Nov 2026 (C-3). The rejected alternative was grouping by `close_date`, where an edited date moves the deal to another month.

### 6.2 Indexes

- Every foreign key column
- `deals(stage, position)`
- `deals(closed_at)`
- `activities(occurred_at)`
- `activities(follow_up_date, done)`
- `stage_changes(deal_id, changed_at)`

### 6.3 Connection settings

Every connection sets:

- `PRAGMA foreign_keys = ON`
- `journal_mode = WAL`
- `synchronous = FULL`, so committed writes survive a power cut (REL-1)
- `busy_timeout = 5000` *(threshold approved 21 Nov 2026)*

### 6.4 Positions

- A new deal, or one whose stage changed outside the board, gets a position 1.0 below the column's current smallest, so it lands at the top.
- A drop between two cards gets their midpoint.
- When two neighbors are within 1e-6 of each other, the column is renumbered 1.0, 2.0, 3.0 and so on in the same transaction before the midpoint is taken.

### 6.5 Lifecycle

| Event | Effect |
|---|---|
| Create | `created_at` and `updated_at` are set to now. A deal also gets its first stage change row. |
| Update | `updated_at` is set to now. A stage change follows section 4.2. |
| Delete | R31–R33, through the foreign key rules, in one transaction |
| Seed | Every table is cleared and the sample data inserted, in one transaction |
| Clear | Every table is cleared in one transaction. The schema stays. |
| Upgrade | Alembic migrations run on startup, before the app serves requests (DEP-4) |

### 6.6 Data classification

Contact names, emails and phones are personal data. They're stored only in the local database file, never sent anywhere (section 8), and never logged (SEC-8).

## Area C: Technical architecture

## 7. Solution architecture

### 7.1 Components

```
 Browser (React app)  ──HTTP──▶  Vite dev server 127.0.0.1:5173  ──proxy /api──▶  FastAPI 127.0.0.1:8000
                                                                                     │
                                          seed / clear CLI ──────────────────────────┤ shared db layer
                                                                                     ▼
                                                                         SQLite file (WAL)
```

| Component | Responsible for | Not responsible for |
|---|---|---|
| **React app** (`frontend/`) | Screens, forms, client-side checks for fast feedback, table search, sort and paging, optimistic pipeline moves with rollback, formatting | Anything authoritative: final validation, stage rules and dashboard figures all come from the API |
| **Vite dev server** | Serving the app and proxying `/api` to the backend, so the browser sees one origin | Business logic |
| **FastAPI routers** (`app/routers/`) | HTTP only: parsing, the error format, status codes, origin checks | SQL or business rules |
| **Services** (`app/services/`) | Use cases and transactions (one per request): CRUD, move, delete impact, timelines, dashboard | HTTP details |
| **Rules** (`app/rules.py`) | Pure functions: probabilities, late check, close-date and customer rules, positions | Input and output |
| **Data layer** (`app/db.py`) | Engine, connection settings, table definitions. SQLAlchemy Core only, no raw SQL. | Business logic |
| **Migrations** (`backend/migrations/`) | Alembic scripts, run on startup | Data seeding |
| **Seed and CLI** (`app/seed.py`, `app/cli.py`) | Sample data, and the reset and empty commands, through the services and data layer | Running the server |
| **Launcher** (`scripts/ensure-installed.mjs`, root `package.json`) | First-run installs, starting both servers, printing the address | App behavior |

### 7.2 Interactions

- Reads go through TanStack Query, which caches them and refetches when a window regains focus.
- After any save, the queries that depend on it are refetched: the list, the record, timelines and the dashboard.
- A pipeline drop updates the board's cache straight away, calls `/move`, and on failure puts the cache back as it was (R64).

### 7.3 Boundaries

- The browser only ever talks to `/api` on its own origin.
- Only the backend and the CLI touch the database file.
- No component makes outbound network calls at runtime (section 8).

### 7.4 Runtime

The MVP runs as the two development servers started by `npm run dev` (ADR-010). Uvicorn runs without reload for users and with reload for development *(approved 21 Nov 2026)*. The default user command is `npm run dev`, as `TECH_STACK.md` sets.

## 8. Integration design

| Dependency | When | Protocol | Notes |
|---|---|---|---|
| npm registry, PyPI | First run only (`npm install`, `uv sync`) | HTTPS | Versions are pinned by `package-lock.json` and `uv.lock`. Nothing is fetched at runtime (R2). |
| Google Chrome | Tests only | Playwright | Uses the installed Chrome (`channel: "chrome"`) |
| Supabase, Render | Not in the MVP | (none) | Named in `TECH_STACK.md` for later. Keeping database access behind `db.py` and the services keeps that move contained. |
| Email, calendar, phone | Never in the MVP | (none) | Out of scope (intent §5) |

There are no other external systems, no webhooks and no telemetry. The app makes no outbound calls at runtime, which V-E00 checks on every end-to-end test.

## 9. Nonfunctional requirements

| ID | Requirement | Measure |
|---|---|---|
| R6 / NFR-1 | Pages are quick at the intent's data volume | With 1,000 contacts, 500 deals and 5,000 activities, each page is usable within 500 ms of navigation on the test machine, at the 95th percentile of 20 loads *(threshold approved 21 Nov 2026)* |
| NFR-2 | API speed | Lists and the dashboard answer within 300 ms, and other calls within 100 ms, at the 95th percentile at that volume *(threshold approved 21 Nov 2026)* |
| NFR-3 | Searching and sorting keep up | A key press in search, or a click on a heading, updates the table within 100 ms *(threshold approved 21 Nov 2026)* |
| NFR-4 / R2 | Offline after the first run | No request leaves `127.0.0.1` or `localhost` at runtime, and fonts and icons are bundled |
| NFR-5 | Start-up | After the first run, the address is printed within 15 seconds on the test machine *(threshold approved 21 Nov 2026)* |
| NFR-6 / R1 | Portability | The same commands work on current Windows 11, macOS and Ubuntu LTS *[Assumption: these versions]* |
| NFR-7 | Accessibility, best effort (intent §7) | Every action can be done with the keyboard, including pipeline drags (R66). Focus is always visible. Form fields have labels. Text meets the color rules in section 3.9. There's no formal standard. |
| NFR-8 | Usability | SC1: someone new answers the intent's five questions within a couple of clicks of the dashboard |
| NFR-9 | Look and feel | Section 3.9 and mockup 1. The product owner approves it (SC5). |
| R5 / NFR-10 | Screen sizes | Designed for 1280px and wider, and usable at 1024px with no horizontal page scroll |
| R7 / NFR-11 | Clean console | No errors in the browser console on any screen |
| NFR-12 | Browsers | Current Chrome, Edge, Firefox and Safari *[Assumption]*. Automated tests use Chrome. |
| NFR-13 | Scalability | No design limit below 10 × the intent's volume. The performance test runs at 2 × as a safety margin *(threshold approved 21 Nov 2026)*. |

## 10. Security and privacy

The MVP has no sign-in by design (intent §5), so its protection is to stay on one computer.

| ID | Requirement |
|---|---|
| SEC-1 | Both servers listen on `127.0.0.1` only, never `0.0.0.0` (ADR-002). The Vite proxy targets `http://127.0.0.1:8000` by address, not by `localhost`. |
| SEC-2 | The backend refuses any request whose `Host` header isn't `127.0.0.1` or `localhost` on the API or web port, with 403. This guards against DNS rebinding. Vite's own allowed-hosts check stays at its local-only default. |
| SEC-3 | A changing request (POST, PATCH, DELETE) whose `Origin` header isn't the app's own (`http://127.0.0.1:5173` or `http://localhost:5173`, or the test ports) is refused with 403. No CORS headers are sent, so other websites can't read responses. |
| SEC-4 | There's no authentication or authorization, by intent. *[Assumption from intent §12: only the salesperson can use the computer.]* |
| SEC-5 | Every query goes through SQLAlchemy Core with bound parameters. There's no raw SQL or string-built queries. |
| SEC-6 | User text is always shown as text. React escaping is used, with no `dangerouslySetInnerHTML`. Websites become links only for `http` and `https`, open in a new tab with `rel="noopener noreferrer"`, and any other scheme is refused on save (R21). |
| SEC-7 | Inputs are checked on the server (R21), and unknown fields and oversized bodies are refused (section 5.1) |
| SEC-8 | Logs never contain request or response bodies, or any field value. Paths are logged as templates with IDs, such as `/api/contacts/{id}` (ADR-005). |
| SEC-9 | The MVP has no secrets. `.env` files are already ignored by git, and none are needed. |
| SEC-10 | Data at rest is the plain SQLite file, protected only by the computer's user account *[Assumption]*. Encrypting it isn't in scope. |
| SEC-11 | Dependencies are pinned by lockfiles. `npm audit --audit-level=high` and `pip-audit` run before a release, and high or critical findings block it *(approved 21 Nov 2026)*. |
| SEC-12 | Deleting removes the data from the database at once (R36). The space is reclaimed on the next checkpoint. Which privacy rules apply for real business use is an open question in the intent (§13), and isn't decided here. |

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

## 11. Reliability and failure handling

| ID | Requirement |
|---|---|
| REL-1 | **Durability:** with WAL and `synchronous = FULL`, every change the API reported as saved survives a crash or power cut (AC8) |
| REL-2 | **Atomic requests:** each request runs in one transaction, so a move, delete, seed or clear either happens fully or not at all |
| REL-3 | **Persistence:** data is still there after a refresh and a restart (R3) |
| REL-4 | **Timeouts:** the frontend gives up on a request after 10 s and shows the error message *(threshold approved 21 Nov 2026)* |
| REL-5 | **Retries and idempotency:** reads are retried once automatically, and changes are never retried automatically. Save buttons are disabled while saving, so double-clicks don't create twice. PATCH and the move endpoint are safe to repeat (section 5.4). A DELETE of something already gone returns 404, and the frontend treats that as done. |
| REL-6 | **Busy database:** if the database stays locked past `busy_timeout`, the API answers 503 `busy` and the UI says "Accountable is busy. Try again." |
| REL-7 | **Backend not reachable:** a banner says "Can't reach Accountable. Check it's still running in the terminal." Data already on screen stays visible, but saving is blocked until it's back *(approved 21 Nov 2026)*. |
| REL-8 | **Optimistic moves:** a failed move puts the card and the totals back (R64) |
| REL-9 | **Start-up failures** stop the start-up with one clear line and a non-zero exit, and are never fixed silently: a port in use ("Port 8000 is already in use…"), an unreadable or damaged database file, or a failed migration. A failed migration leaves the database as it was. The app never resets or reseeds an existing database by itself. |
| REL-10 | **Seed and clear while the app runs** both work. Running tabs show the new data on their next refetch or refresh. |
| REL-11 | **Concurrent edits:** the last write wins (ADR-003). The board reloads on a 409 `stale_position` (section 4.5). |
| REL-12 | **Rendering errors:** an error boundary on each page shows "Something went wrong on this page", with a reload button and the request ID if there is one, instead of a blank screen |

## Area D: Engineering quality

## 12. Observability and operations

| ID | Requirement |
|---|---|
| OBS-1 | One log line per request, with time, request ID, method, path template, status and duration in milliseconds. Errors add the exception and stack trace. There's never any body or field value (SEC-8). |
| OBS-2 | Logs go to the terminal and to `backend/logs/accountable.log`, which rotates at 5 MB and keeps 3 files *(threshold approved 21 Nov 2026)*. The `logs/` folder is already ignored by git. The level is set by `ACCOUNTABLE_LOG_LEVEL` (default `INFO`). |
| OBS-3 | Every response has an `X-Request-ID`. The frontend's error messages show it as "Reference: 9f2c" so the log line can be found. |
| OBS-4 | Start-up logs the address, the database path, the schema version, and whether sample data was loaded |
| OBS-5 | `GET /api/health` (section 5.5) |
| OBS-6 | There are no metrics, traces or alerts in the MVP, because it's a single-user local app with no one on call (ADR-014) |

### Runbook

These steps go in `docs/STATUS.md` when the app is built.

| Symptom | Action |
|---|---|
| "Port 8000 (or 5173) is already in use" | Close the other copy of Accountable, or the program using that port, and run `npm run dev` again |
| "uv not found" or "node not found" | Install them, following the documented steps |
| "Can't reach Accountable" in the browser | Check the terminal running `npm run dev`. Restart it if it stopped. |
| "Accountable is busy" | Wait a moment and try again. If it keeps happening, check nothing else has the database file open. |
| The database won't open | Stop the app, copy `backend/data/accountable.db` somewhere safe, and look in `backend/logs/accountable.log` for the error |
| Starting again from the sample data | `npm run seed` |
| Starting with real data | `npm run clear` |
| Backing up | Stop the app and copy the `backend/data/` folder, which holds the database and its `-wal` file |
| Restoring | Stop the app and put the copied files back |

## 13. Testing and verification strategy

### 13.1 Levels

| Level | Tool | Scope |
|---|---|---|
| Unit (backend) | pytest | `rules.py` and the services, against a temporary database |
| Integration (API) | pytest with FastAPI's TestClient | Every endpoint, error format, status code and rule, each test on a new temporary database |
| Unit and component (frontend) | Vitest and Testing Library | Formatting, deal logic, the data table, forms, dialogs and dashboard lists |
| End to end | Playwright with installed Chrome | Whole journeys against real servers on test ports with a test database |
| Security | pytest and Playwright | Section 10's negative cases |
| Performance | A generator script and Playwright timing | NFR-1 to NFR-3 at 2 × the intent's volume |
| Accessibility | Playwright keyboard-only runs, best effort | NFR-7 |
| Manual | People | Looks, first-time use, and the walkthrough |

### 13.2 Rules for tests

- `npm test` runs pytest, Vitest and Playwright, and fails if any test fails.
- Tests never use the real database. `ACCOUNTABLE_DB` must point at a temporary file, and a test fails if it's the default path.
- Time is fixed in tests: an injectable clock in the backend, fake timers in Vitest, and `page.clock` in Playwright.
- Every end-to-end test fails on a browser console error or on any request outside localhost (V-E00).
- Each test's name starts with the requirement it proves, for example `R16 moving to Won sets the close date to today`.
- Coverage of `rules.py` and `services/` is at least 90% of lines *(threshold approved 21 Nov 2026)*.

### 13.3 Verification cases

| ID | Case | Proves |
|---|---|---|
| V-B01 | `test_rules.py`: probabilities, the hand-set probability kept, Won/Lost close date, late, expected revenue, positions and renumbering | R14–R16, R19, R20, section 6.4 |
| V-B02 | `test_db.py`: foreign keys on, WAL and FULL set, the exactly-one-parent check | R13, section 6.3 |
| V-B03 | `test_organizations.py`: CRUD, field rules, list counts and open value | R10, R21, R44 |
| V-B04 | `test_contacts.py`: organization required on create, status default, cleared link kept on edit, field rules | R11, R21, R34 |
| V-B05 | `test_deals.py`: required fields, value and probability bounds, contact must match organization, `PATCH` stage change follows the rules, top of column | R12, R15, R21, R23, R67 |
| V-B06 | `test_move.py`: across and within columns, Won makes the contact a customer, reopening keeps status and date, stage change rows, 409 `stale_position`, repeated move | R15–R18, R24, R63, section 5.4 |
| V-B07 | `test_deletes.py`: R31–R33 checked on the rows themselves, delete-impact counts, won deals still counted, delete of a missing record | R30–R36 |
| V-B08 | `test_activities.py`: CRUD, mark done and undone, future dates allowed, exactly one parent | R13, R53, R55 |
| V-B09 | `test_timelines.py`: deal, contact and organization timelines, order and sources | R50, R51, R54 |
| V-B10 | `test_dashboard.py`: every figure on a fixed data set, funnel from history, follow-up groups, month boundary, empty database | R70–R79 |
| V-B11 | `test_seed.py`: counts, coverage, history fits, seeding only when new | R4, R80–R84 |
| V-B12 | `test_cli.py`: refuses without "yes", `--yes`, exit codes, works with another connection open | R4, section 5.6, REL-10 |
| V-B13 | `test_migrations.py`: upgrade from empty, and from the previous version with data, keeps the rows. A failed migration leaves the database unchanged. | DEP-4, REL-9 |
| V-B14 | `test_errors.py`: the error format and each status code in section 5.2 | Section 5.2 |
| V-F01 | `lib/format.test.ts`: money and dates | Section 3.9 Writing |
| V-F02 | `lib/deals.test.ts`: late check, expected revenue, greeting times, initials | R19, R20, R79 |
| V-F03 | `components/DataTable.test.tsx`: search, sort, 25 per page, count, empty and no-match messages | R40, R41, R43, R46, R47 |
| V-F04 | `components/ConfirmDialog.test.tsx`: name and counts, nothing deleted until confirmed | R30 |
| V-F05 | `forms/DealForm.test.tsx`: field messages, probability prefill and override, contact list filtered by organization, server errors shown | R15, R23, R45, R48 |
| V-F06 | `forms/ContactForm.test.tsx`: organization required, inline "Add organization" | R11, R45 |
| V-F07 | `pages/pipeline/Column.test.tsx`: totals, Won/Lost showing 5 and "Show all", and only this month's closed deals, with a deal closed last month absent | R60 |
| V-F08 | `pages/pipeline/DealCard.test.tsx`: Late badge, meter width | R62 |
| V-F09 | `pages/dashboard/FollowUps.test.tsx`: groups, later count, ticking removes | R76 |
| V-F10 | `components/ErrorBoundary.test.tsx` and the API client: fallback screen, timeout message, request ID shown | REL-4, REL-12, OBS-3 |
| V-E00 | `e2e/fixtures.ts`, in every test: no console errors and no request outside localhost | R2, R7 |
| V-E01 | `start.spec.ts`: lands on the dashboard with sample data on every screen | AC1, R4 |
| V-E02 | `organizations.spec.ts`: add, search, sort, edit, delete with counts, links show "None" | AC2, R30, R31, R34 |
| V-E03 | `contacts.spec.ts`: the same round, status filter, inline organization | AC2, AC3, R45 |
| V-E04 | `deals.spec.ts`: the same round, late deals stand out, probability prefill | AC2, AC4 |
| V-E05 | `record-pages.spec.ts`: links on each page, the organization's combined timeline, missing record | AC3, R50–R52, R56 |
| V-E06 | `pipeline.spec.ts`: drag across and within columns, reload, add in a column, late cards, keyboard drag, rollback when the API fails (mocked) | AC4, R60–R67 |
| V-E07 | `won-deal.spec.ts`: dashboard figures, close date, timeline, recent activity, contact becomes customer | AC6, R16–R18, R77 |
| V-E08 | `activities.spec.ts`: log each type with a follow-up, on the deal's and contact's timelines, on the dashboard until done | AC5, R53, R76 |
| V-E09 | `commands.spec.ts`: after `clear --yes`, every screen is empty but works. After `seed --yes`, the sample data is back. | AC2, R4, R78 |
| V-E10 | `persistence.spec.ts`: survives a reload, and survives a backend restart | AC2, R3 |
| V-E11 | `keyboard.spec.ts`: add, edit, delete and drag with the keyboard only, focus always visible | NFR-7, R66 |
| V-E12 | `layout.spec.ts`: no horizontal scroll at 1024px and 1280px | R5 |
| V-S01–V-S10 | `test_security.py` and `security.spec.ts`: each negative case in section 10, plus a check that nothing listens on anything but `127.0.0.1` | SEC-1–SEC-8 |
| V-P01 | `e2e/perf/` plus a data generator: page, API and search timings at 2 × volume | R6, NFR-1–NFR-3, NFR-13 |
| V-M01 | The coding agent's end-to-end walkthrough, every screen by eye, then the product owner's review | AC9 |
| V-M02 | A fresh clone on Windows, macOS and Linux: first run, then a second run with the network off | AC1, R1, R2, NFR-6 |
| V-M03 | Crash test: kill the backend process (`kill -9`, or Task Manager) straight after a save, restart, and check the change | AC8, REL-1 |
| V-M04 | Every screen compared by eye with mockup 1 and the brand rules | SC5, NFR-9 |
| V-M05 | Someone new answers the SC1 questions with no instructions | SC1, NFR-8 |
| V-M06 | Two weeks of real use, with the product owner checking SC2–SC4 | SC2–SC4 |

## 14. Deployment and release design

| ID | Requirement |
|---|---|
| DEP-1 | **Environments.** *Local* is the user's or a developer's computer, using `npm run dev`, ports 8000 and 5173, and `backend/data/accountable.db`. *Test* is automated, using ports 8001 and 5174 and a temporary database. There's no shared or hosted environment in the MVP. |
| DEP-2 | **Configuration**, all optional with defaults: `ACCOUNTABLE_DB` (the database path), `ACCOUNTABLE_API_PORT` (8000), `ACCOUNTABLE_WEB_PORT` (5173) and `ACCOUNTABLE_LOG_LEVEL` (INFO). There are no secrets. |
| DEP-3 | **First run.** `predev` runs `scripts/ensure-installed.mjs`, which checks for Node 24+ and uv with a clear message if either is missing, then runs `npm install` and `uv sync` only if they haven't been run. Then both servers start. |
| DEP-4 | **Migrations.** Alembic runs `upgrade head` on start-up, before serving requests. A new database is created by the migrations, then seeded. Migrations are forward-only in the MVP, and every one is tested on a database holding data (V-B13). |
| DEP-5 | **Release.** The version is kept the same in `package.json` and `pyproject.toml` (starting at 0.1.0). A release is a git tag `v0.1.0` with notes in `docs/STATUS.md`, made only when the Definition of Done is met. |
| DEP-6 | **Rollback.** For code, check out the previous tag. For data, migrations don't run backwards, so the runbook tells users to copy `backend/data/` before upgrading and to restore that copy to go back (section 12). The app doesn't make backups itself (intent §5). |
| DEP-7 | **Upgrading** is pulling the new version and running `npm run dev`. Dependencies and migrations update by themselves. |

## 15. Engineering standards

| ID | Standard |
|---|---|
| ENG-1 | **Module boundaries** as in section 7.1. In the frontend, only `src/api/` calls `fetch`. Pages use components and hooks, and colors come only from tokens. In the backend, routers don't touch the database, and services don't import FastAPI. |
| ENG-2 | **TypeScript** in strict mode, with no `any` except at typed boundaries (with a comment). ESLint and Prettier must pass. |
| ENG-3 | **Python 3.12** with type hints on every public function. Ruff lint and format must pass. |
| ENG-4 | **SQLAlchemy Core** only, with no raw SQL and no ORM, as `TECH_STACK.md` sets. Schema changes only through Alembic. |
| ENG-5 | **Libraries:** the ones in section 7.1 and `TECH_STACK.md`. A new dependency needs a reason in the change description, and popular, maintained libraries come before custom code. |
| ENG-6 | **Naming:** API fields in `snake_case`, TypeScript in `camelCase`, with one translation in `src/api/`. Stage keys are lowercase (`new` … `lost`). |
| ENG-7 | **Tests** go with every change, named by requirement ID (section 13.2). `npm test` must pass before every commit to the main branch. |
| ENG-8 | **UI copy** follows section 3.9 Writing. There's no text in code that a user sees and that breaks the tone rules. |
| ENG-9 | **Changes** are small, focused commits. `docs/STATUS.md` is updated when a piece of work is finished (`AGENTS.md`). |
| ENG-10 | **Decision boundary:** a coding agent doesn't invent business rules, permissions, security policies or architecture. Anything this spec doesn't settle is raised with the product owner first, and recorded in section 16. |

## Area E: Governance and readiness

## 16. Assumptions, risks and decisions

### 16.1 Assumptions

| ID | Assumption | If it's wrong |
|---|---|---|
| A-1 | Only the salesperson uses the computer (intent §12) | Anyone at the computer has full access. Sign-in would be needed. |
| A-2 | No privacy rule changes the MVP while the data stays on one computer (intent §9) | Deleting or exporting on request may be needed |
| A-3 | The user backs up `backend/data/` themselves | Losing the computer loses the data |
| A-4 | Node 24+ and uv can be installed by the user, following the documentation | A non-technical user may need help with setup |
| A-5 | The target platforms and browsers in NFR-6 and NFR-12 | More testing would be needed |
| A-6 | The test machine for performance is a typical recent laptop | The thresholds may need adjusting |

### 16.2 Risks

The delivery risks, with how each is handled, are in `docs/plan.md` ("Risks"). These are the architectural ones:

| Risk | Handling |
|---|---|
| Local time, rather than UTC, makes a later move to hosting harder | ADR-013. Moving would need a migration that converts stored times. |
| Last write wins is wrong once there are several users | ADR-003 is for the MVP only. The multi-user intent must revisit it. |
| The two development servers aren't a production runtime | ADR-010. Hosting (later) will need a build-and-serve setup. |
| Forward-only migrations make data rollback depend on the user's copy | DEP-6 and the runbook |

### 16.3 Decisions (ADR log)

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | The stack is as set by `docs/TECH_STACK.md` | Approved (an intent constraint) |
| ADR-002 | Both servers listen on `127.0.0.1` only, with Host and Origin checks (SEC-1–SEC-3) | Approved 21 Nov 2026 |
| ADR-003 | Last write wins on concurrent edits | Approved 21 Nov 2026 |
| ADR-004 | Alembic versioned migrations, run on start-up. This adds Alembic alongside SQLAlchemy Core: real data must survive future versions. | Approved 21 Nov 2026 |
| ADR-005 | No personal data in logs. Logs go to the terminal and a rotating local file. | Approved 21 Nov 2026 |
| ADR-006 | Stage changes are a separate, read-only table | Approved 20 Nov 2026 |
| ADR-007 | Lists load in full, and search, sort and paging happen in the browser | Approved 21 Nov 2026. It's simple and fast at 1,000 rows. The trade-off is that it would need server paging at about 10 × the volume. |
| ADR-008 | Fractional positions with renumbering | Approved 21 Nov 2026. One row changes per drop. The alternative, renumbering the whole column every time, is simpler but writes more. |
| ADR-009 | An unversioned `/api` | Approved 21 Nov 2026. The frontend is the only client. The alternative, `/api/v1` now, costs little and is clearer for future clients. |
| ADR-010 | The development servers are the runtime for users | Approved 21 Nov 2026. It's what `TECH_STACK.md` sets. The alternative, a built frontend served by FastAPI, starts faster and runs one process, but adds a build step. |
| ADR-011 | Stage colors, contrast rules, funnel from stage history, the contact must match the organization, reopening keeps the date, follow-up groups, timelines follow the current contact (concerns 1–10 in version 1.x) | Approved 20 Nov 2026 |
| ADR-012 | Mockup B set the layout (approved 20 Nov 2026). Mockup 1 (`docs/mockups/1-spec-reference/`), which follows that layout and spec 2.0, is the visual reference. | Approved 21 Nov 2026 |
| ADR-013 | Times are stored and compared in the computer's local time | Approved 21 Nov 2026. It matches "today" in the intent. The alternative, UTC plus a stored time zone, is safer for hosting later. |
| ADR-014 | No metrics, tracing or alerting in the MVP | Approved 21 Nov 2026 |
| ADR-015 | The `closed_at` column drives the month figures | Approved 21 Nov 2026. See challenge C-3. |
| ADR-016 | Duplicate names are allowed | Approved 21 Nov 2026. See R22. |
| ADR-017 | Small text with a white color uses darker fills: badges stay at 12px, and their Cerulean and Raspberry fills become `--cerulean-text` and `--raspberry-text`. This resolves a contradiction between the badge style and the contrast rule in 3.9. | Approved 21 Nov 2026 |

### 16.4 Challenges to ambiguous requirements

| ID | Ambiguity | Options and trade-offs | Proposed |
|---|---|---|---|
| C-1 | The funnel "value reaching each stage" has no time window in the intent | (a) **All time:** simple, but old deals weigh on it more and more. (b) **Deals created in the last 12 months:** matches the other charts, but a deal created 13 months ago and won last month drops out. (c) **Deals that were open at some point in the last 12 months:** most accurate, but harder to explain. | (b), approved 21 Nov 2026 |
| C-2 | Won and Lost columns would grow forever | (a) **Last 12 months**, latest 5 with "Show all" (current R60). (b) **This month only:** the board stays short, but it hides recent wins. (c) **Everything:** a column hundreds of cards long. | (b), approved 21 Nov 2026 |
| C-3 | Which date puts a won deal in a month: when it was moved, or its editable close date? | (a) **`closed_at`** (when moved): stable, and matches "counts in the month it was won" (AC6). But editing the close date doesn't move it. (b) **`close_date`:** the user can correct the month, but a typo moves revenue between months. | (a), approved 21 Nov 2026 |
| C-4 | "Stays quick" isn't measured in the intent | Thresholds in NFR-1–NFR-3 | Approved 21 Nov 2026 |
| C-5 | Field limits aren't in the intent | Limits in R21 | Approved 21 Nov 2026 |

## 17. Definition of Done

The MVP is done when all of these are true:

1. Every requirement with an ID in sections 3 and 9–15 is built, or recorded as a deliberate change approved by the product owner.
2. Every verification case in section 13.3 from V-B01 to V-P01 passes. `npm test` passes on a clean checkout, and the performance run meets the approved thresholds.
3. Lint, formatting and type checks pass, and coverage of `rules.py` and `services/` meets the threshold.
4. No high or critical dependency findings are open (SEC-11).
5. V-M02 (fresh clone on Windows, macOS and Linux) and V-M03 (crash test) are done, with results in `docs/STATUS.md`.
6. The V-M01 walkthrough is done, with every screen checked by eye, no console errors, and every issue found fixed.
7. `docs/STATUS.md` says how to install, run, seed, clear, back up and restore, and includes the runbook.
8. No *[Unapproved]* item is left in this spec, and any later change to an approved item has the product owner's approval.
9. The product owner has used the app and approved it, including how it looks (AC9, SC5).
10. The release is tagged `v0.1.0` (DEP-5).

SC2–SC4 (two weeks of use) are checked after release, and aren't part of done.

## 18. Review and approval

| | |
|---|---|
| **Owner** | The product owner (the project owner) |
| **Author** | The coding agent, acting as architect |
| **Status** | Version 2.0, approved |
| **Approved inputs** | Intent (21 Nov 2026), concerns 1–10 and mockup B's layout (20 Nov 2026), mockup 1 as the visual reference (21 Nov 2026), and the network, concurrency, migration and logging decisions (21 Nov 2026) |
| **Approval decision** | Approved by the product owner on 21 Nov 2026: the funnel window (C-1), the won month (C-3), every proposed threshold and every proposed decision. C-2 followed the same day: the Won and Lost columns show this month only (R60). |

### Self-review

| Area | Finding | Action taken |
|---|---|---|
| Completeness | Version 1.x had no failure, security, operations, deployment or governance sections | Added sections 5.2, 10, 11, 12, 14, 15 and 16 |
| Consistency | The intent's criteria were renumbered (SC1–SC5, AC1–AC9), and `plan.md` still uses the old numbers | Traced to the new numbers here. `plan.md` needs refreshing later (not done, as asked). |
| Consistency | Month figures could have used either `close_date` or a "moved to Won" date | Added `closed_at`, raised as C-3 |
| Security | No sign-in plus a reachable port would expose all data | SEC-1 to SEC-3, with negative cases and tests |
| Testability | Version 1.x said "quick" with no way to measure it | NFR-1 to NFR-3 thresholds (proposed) and V-P01 |
| Testability | Every functional requirement needs a test | Each R ID maps to a V case in sections 2 and 13.3. Look and feel rules are verified by eye (V-M04). |
| Maintainability | Module rules were implicit | ENG-1, plus the boundaries in section 7.1 |
| Operational readiness | There was no runbook, health check or upgrade path | Section 12's runbook, OBS-5, DEP-4, DEP-6 and DEP-7 |
| Residual | The MVP can't recover data without the user's own copy | Accepted by intent §5. Recorded as A-3 and DEP-6. |

### Blocking questions

All four blocking questions were answered on 21 Nov 2026:

1. The funnel's time window (C-1): deals created in the last 12 months.
2. Which date puts a won deal in a month (C-3): `closed_at`, when it was moved.
3. The proposed thresholds: all accepted.
4. The proposed decisions: all accepted.

C-2 was answered the same day: the Won and Lost columns show this calendar month only (R60). Nothing is open.
