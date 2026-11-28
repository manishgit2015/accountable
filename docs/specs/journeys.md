# Spec: User journeys and edge cases

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The user journeys (WF IDs) and the edge cases. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 4.1 Journeys

| ID | Journey | Steps | End state |
|---|---|---|---|
| WF-1 | First run, for a developer | Install Node and uv (documented), clone, put the Supabase settings in `.env`, run `npm run dev`, open the printed address, sign in | The dashboard shows sample data (AC1) |
| WF-2 | Start real work on the team's data | Sign in, browse every section on the sample data, then add the first real organization, contact and deal beside it. A sample record nobody wants is deleted on its own, with its warning (R30–R36). | The real records sit with the sample data, which stays (E-8). An empty database, which the tests use, shows each screen's empty state and works (AC2) |
| WF-3 | Add a lead | Contacts → Add contact → organization picker → "Add organization" → save the organization → back in the contact form with it chosen → status Lead → save | The contact is in the table and on the organization's page |
| WF-4 | Add and work a deal | Pipeline → "Add deal" in Qualified → pick organization and contact → save → the card is at the top of Qualified → drag it to Proposal | Stage and probability are updated, totals move, and the timeline shows "Moved from Qualified to Proposal" |
| WF-5 | Log and finish a follow-up | Contact page → Log activity → Call, description, follow-up date tomorrow → save → Dashboard → Next 7 days → tick it | The timeline shows the call, and the dashboard list no longer does (AC5) |
| WF-6 | Win a deal | Drag a card to Won | Close date is today, probability 100%, contact becomes customer, won this month and the revenue chart rise, and recent activity shows the move (AC6) |
| WF-7 | Reopen a deal | Drag a Won row back to Negotiation | Probability 70%, close date unchanged (so it may show Late), contact stays customer |
| WF-8 | Delete with links | Organizations → row menu → Delete → the dialog gives the counts → confirm | The organization is gone, and its contacts and deals show "None" (AC2) |
| WF-9 | Reset | `npm run seed`, type `yes` | The sample data is back, and the running app shows it on refresh |
| WF-10 | Recover after a crash | Power is lost while using the app, then the computer and app are started again | Every change the app showed as saved is there (AC8) |
| WF-11 | Sign in for the first time | Whoever runs Accountable adds the person in Supabase's dashboard with an email, a password and a display name → the person opens the team's onrender.com address → the sign-in screen → enters the email and password → Sign in | The dashboard, with their initials on the user menu (AC10) |
| WF-12 | Find a record | Type part of a name in the top-bar search → the results list → arrow down to a contact → Enter | The contact's page opens (AC12) |
| WF-13 | See who added a deal | Open a deal's page | "Added by" names the person who added it, and "Last changed by" the one who last changed it (AC11) |
| WF-14 | Change the theme | User menu → Theme → System | The mode follows the device, and stays so after a reload (AC13) |
| WF-15 | Sign out | User menu → Sign out | The sign-in screen. Opening any address shows it too (AC10). |
| WF-16 | Deploy | Push to the branch Render deploys → Render builds the app and starts it → migrations run → open the onrender.com address | The new version answers, with the team's data (AC14, DEP-8) |

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
| The mode is changed while a form on the page has something typed in it (the Log activity form, a search box) | The form keeps what was typed, and the page and its scroll position stay (R90). Side panels and dialogs are modal, so the user menu can't be reached while one is open. |
| The device switches between light and dark while System is chosen | The app follows at once, keeping the page (R96) |
| `localStorage` holds something other than `light`, `dark` or `system` under `accountable.theme` | Treated as no choice: light mode (R91). The next theme choice overwrites it. |
| `localStorage` is blocked | R93 |
| Two tabs are open and the mode is changed in one | The other tab keeps its mode until it's reloaded *[Assumption]* |
| Two people change the same record at the same time | The last save wins (ADR-003). Each sees the other's change on their next refetch or refresh. |
| Someone deletes a record another person has open | The other person's next save or refresh shows R56's message |
| The session ends while something is typed in a form | The save gets 401 and the sign-in screen shows (R108). What was typed isn't kept *[Assumption: rare, because the browser renews the token before it runs out]*. |
| A person is removed in Supabase while signed in | Their next request that renews the session fails, and they see the sign-in screen (R108). Their records stay (R114). |
| One character is typed in the top-bar search | Nothing is searched, and the list says "Type at least 2 characters" (R121) |
| The search text contains `%` or `_` | Matched as plain characters (R125) |
| Supabase can't be reached | Signing in shows R103's message. Signed in, API requests that need the database answer 503 and the UI says so (REL-13). |
