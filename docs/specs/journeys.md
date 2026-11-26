# Spec: User journeys and edge cases

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The user journeys (WF IDs) and the edge cases. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

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
| The mode is changed while a form on the page has something typed in it (the Log activity form, a search box) | The form keeps what was typed, and the page and its scroll position stay (R90). Side panels and dialogs are modal, so the toggle can't be reached while one is open. |
| `localStorage` holds something other than `light` or `dark` under `accountable.theme` | Treated as no choice: light mode (R91). The next toggle overwrites it. |
| `localStorage` is blocked | R93 |
| Two tabs are open and the mode is changed in one | The other tab keeps its mode until it's reloaded *[Assumption]* |
