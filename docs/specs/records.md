# Spec: Records, tables and record pages

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Organizations, contacts and activities: the four kinds of record and their field rules, deleting, the tables, the record pages, follow-up states and contact status. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.1 Records and validation

- **R10 Organization:** name (required), website, industry, notes.
- **R11 Contact:** name (required), organization (required on create, including for leads), email, phone, job title, and status (lead, qualified or customer; defaults to lead).
- **R12 Deal:** name, organization, main contact, stage, value in US dollars (a whole number) and close date are all required on create. Probability of close is a whole-number percentage.
- **R13 Activity:** type (note, call or email), and a contact *or* a deal (exactly one). Description is required. "When it happened" defaults to now and may be in the future, for planned activity. There's an optional follow-up date and a done flag, which starts as not done.
- **R21 Field rules**. Text is trimmed before it's checked, and a value that's blank after trimming counts as empty.

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

- Every organization, contact, deal and activity also records who added it and who last changed it, taken from the signed-in person (R110).
- **R22 Duplicates are allowed.** Two organizations or contacts may share a name (ADR-016). The alternative is to warn when a new name matches an existing one: it catches typos, but adds a step to every add.

### 3.3 Deleting

- **R30** Every delete asks first, in a dialog that names the record and says what happens to its linked records, with counts. For example: "Delete Acme Ltd? Its 4 contacts and 3 deals will be kept, with no organization." The counts come from the server when the dialog opens.
- **R31** Deleting an organization keeps its contacts and deals, with the organization cleared.
- **R32** Deleting a contact keeps their deals, with the main contact cleared, and deletes the activities logged on that contact.
- **R33** Deleting a deal deletes its activities and its stage changes.
- **R34** A cleared link shows as "None". A record with a cleared link can be saved while the link stays empty, but a new record still needs every required link (R11, R12).
- **R35** Won deals keep counting on the dashboard after their organization or contact is deleted.
- **R36** Deleting is permanent. There's no undo or trash: backups are the user's job (A-3).

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
- **R47** Default sort: organizations and contacts by name A–Z, and deals by close date with the soonest first. Search and sort reset when the page is left.
- **R48** A save that the server refuses keeps the form open with what was typed, and shows the server's messages next to the fields.

### 3.5 Record pages

- **R50 Organization page:** its details (editable), with who added and last changed it (R111), a contacts list, a deals list, and one timeline combining its contacts' activities, its deals' activities and its deals' stage changes, newest first.
- **R51 Contact page:** details, with who added and last changed it (R111), organization (as a link, or "None"), deals where they're the main contact, and a timeline. The timeline shows their own activities plus the activities and stage changes of those deals, newest first.
- **R52 Deal page:** details, with who added and last changed it (R111), stage (with a stage picker), organization and contact links, a late warning when it's late, and its timeline.
- **R53** Contact and deal pages have a "Log activity" form with type, description, when it happened, and an optional follow-up date.
- **R54** Each timeline entry shows an icon for its type, the description, the date and time, who added it (for activities, R112), and, on organization and contact pages, which deal or contact it came from.
- **R55** Activities in a timeline can be edited and deleted (after asking). Ones with a follow-up can be marked done or not done. Stage change entries can't be edited or deleted.
- **R56** A record page for an ID that doesn't exist, or that was deleted in another tab, shows "This organization no longer exists" (or contact, or deal), with a link back to the list.

### 4.3 Follow-up states

An activity's follow-up is one of three things:

- **None:** there's no follow-up date.
- **Open:** it has a date and isn't done. It shows as Overdue, Today, Next 7 days or Later, worked out from today's date each time.
- **Done:** it's no longer listed on the dashboard. Unticking it in the timeline makes it open again.

### 4.4 Contact status

Lead, qualified and customer can each be set by hand to any other. The only automatic change is to customer, when one of their deals is won (R17).
