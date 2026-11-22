# Intent: the Accountable MVP

Each statement below is one of three kinds:

- **Confirmed:** stated or decided by the product owner. This is the default; anything unmarked is confirmed.
- **Assumption:** believed true but not yet confirmed. Marked *(Assumption)*.
- **Proposed target:** a measure drafted by the coding agent rather than taken from a baseline. Marked *(Proposed target)*. The product owner approved all of them on 21 Nov 2026.

## 1. Business context

- Accountable is being built as part of a course on AI-native software development, and is meant to be used by a real small business afterwards.
- Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. This first version, the MVP, is the sales CRM.
- The business driver is visibility. Today the business can't see its customers, sales and next steps in one place, which makes it hard to follow up, forecast and grow (see section 2).
- Later versions add sign-in, several people sharing the same data, and making Accountable available beyond one computer (see section 13). The MVP should be a sound base for those, but doesn't include them.

## 2. Problem statement

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

The impact:

- Follow-ups are forgotten or done late, because nothing reminds anyone. *(Assumption)*
- How sales are going, and what's likely to close, can't be seen without piecing it together by hand. *(Assumption)*
- What happened with a customer depends on one person's memory or inbox. *(Assumption)*

Current limitations: no single place holds companies, people, deals and their history together, and no figures are worked out from that data. There are no baseline numbers today, such as time spent on admin or follow-ups missed.

## 3. Desired outcome

One salesperson manages all their companies, contacts, deals and follow-ups in one place on their own computer. They know at a glance how sales are going and what needs doing next, and they stop relying on spreadsheets, inboxes and memory.

It should feel like a private Salesforce that does the everyday CRM essentials really well: sharp, modern, professional and a pleasure to use.

## 4. Target users and stakeholders

| Who | Role |
|---|---|
| **One salesperson** | The only user of the MVP. They use it every day on their own computer with their own real data. They start from the sample data to look around, then clear it and type in their own records. |
| **The rest of the sales team** | Affected later, when several users are added (out of scope for the MVP). |
| **The business's owner or managers** | Benefit from seeing sales figures once the team uses it. *(Assumption)* |
| **Product owner** | The project owner. Owns every product decision, approves this intent, and has the final say on the finished MVP, including how it looks. |
| **The coding agent** | Builds the MVP and tests it end to end before handing it to the product owner. |

## 5. Scope

### In scope

- A complete sales CRM for one person, running on their own computer, with five sections: Dashboard, Organizations, Contacts, Deals and Pipeline (section 6).
- Four kinds of record: organization, contact, deal and activity.
- Realistic sample data, a way to reset to it, and a way to empty the app to start with real data.
- Light mode, designed for a laptop or desktop screen, following Accountable's brand guidelines.

### Out of scope

- Sign-in, user accounts or several users
- A dark mode or a layout for phones
- AI features
- Email, calendar or phone integrations
- Currencies other than US dollars
- Reports beyond the dashboard
- Tags or custom fields
- Changing the pipeline stages
- Importing or exporting data, including backups made by the app

## 6. Functional expectations

### Dashboard

The landing page shows how sales are going at a glance: deals won and revenue won month by month, the open pipeline and its expected revenue (each deal's value times its probability of close), a sales funnel showing how much value reaches each stage, recent activity, and the follow-ups that are coming up or overdue. It should be visually stunning, with at least a line chart, a bar chart and a visual of the pipeline. Which figures each one shows, and how, is the designer's call.

### Organizations

The companies we do business with. Open one to see its contacts, its deals and a combined timeline of everything from those contacts and deals, newest first.

### Contacts

The people we deal with, including leads and customers, with a filter by status. Open one to see their organization and a timeline of everything that has happened with them, including activities and stage changes on the deals where they're the main contact.

### Deals

The potential sales, with each one's stage, value and close date. Open one to see its details and its timeline. A deal still open after its expected close date stands out, in the table and on its pipeline card.

### Pipeline

The deals as cards on a board, one column per stage. A card is dragged to another column to change the deal's stage, or within a column to change its place. A card can be dropped anywhere in a column, and it stays where it was dropped. A new deal can be added straight into a column, at that stage. The board shows the total value and expected revenue of the deals still open, each column shows its own, and the figures change as soon as a card moves.

### Tables

Every table has a search box, columns you can sort by clicking their headings, a way to add a new record, and edit and delete on each row. That's how we add a new deal, a new lead or a new customer.

### Activities and follow-ups

From any contact or deal, the user can log an activity (a note, call or email) and give it a follow-up date. A follow-up shows on the dashboard as a task until it's marked done. Activities can be edited and deleted too. When a deal moves to another stage, including Won or Lost, an entry such as "Moved from Proposal to Negotiation" appears in its timeline and in the dashboard's recent activity by itself.

### The four kinds of record

- **Organization:** a company we do business with. Name, website, industry and notes. An organization has many contacts and many deals.
- **Contact:** a person we deal with. Name, email, phone, job title, the organization they belong to, and a status (lead, qualified or customer). A lead is a contact with the lead status, so there's no separate list of leads.
- **Deal:** a potential sale. Name, the organization and the main contact it is with, its stage (New, Qualified, Proposal, Negotiation, Won or Lost), its value in US dollars, its probability of close, and its expected or actual close date.
- **Activity:** something that happened, or needs to happen, with a contact or deal. Type (note, call or email), the contact or deal it relates to, a description and when it happened, and optionally a follow-up date and whether it's done.

### Sample data

Accountable comes with realistic sample data, so every screen looks alive the first time it starts:

- organizations across several industries
- contacts at every status
- deals at every stage, including deals won and lost over the past months, deals expected to close in the months ahead, and a few running late
- activities, with some follow-ups due soon and some overdue

## 7. Nonfunctional expectations

| Area | Expectation |
|---|---|
| **Performance** | It stays quick with up to about 1,000 contacts, 500 deals and 5,000 activities. |
| **Availability** | It runs on the salesperson's own computer whenever they start it. After the first run it needs no internet connection, so everything it shows, including the brand's fonts, comes with the app. |
| **Reliability and persistence** | All data is stored in a SQLite database on that computer. Every change is kept: it's still there after a browser refresh, and after the computer or the app is restarted, including after a crash or power cut. Backing up the data file is the user's job. |
| **Security** | There's no sign-in, because the app runs on one person's computer for that person only. *(Assumption: only the salesperson has access to that computer.)* |
| **Accessibility** | Best effort, with no formal standard: readable contrast and keyboard use where practical. |
| **Usability** | Someone new can find their way around the sample data with no instructions (section 10). |
| **Look and feel** | It follows Accountable's brand guidelines, which take priority over any general design guidance. Light mode only, for laptop and desktop screens. |
| **Portability** | It works the same on Mac, Linux and Windows. |

## 8. Affected systems and dependencies

- No other systems are involved yet. There are no integrations.
- The technology is set by `docs/TECH_STACK.md`, which is a constraint on this intent.
- Node and uv must already be installed on the computer, and the documentation says how. The first run fetches whatever else is missing, which needs an internet connection that one time.
- The brand guidelines (the project's brand skill) set the fonts, colors and tone.

## 9. Business rules and constraints

### Stages and probability

Each stage has a usual probability of close:

| Stage | Probability |
|---|---|
| New | 5% |
| Qualified | 20% |
| Proposal | 40% |
| Negotiation | 70% |
| Won | 100% |
| Lost | 0% |

A deal takes its new stage's probability when it moves. A probability set by hand is kept until the stage changes.

### Winning and losing

- When a deal moves to Won or Lost, its close date becomes today. It can be edited afterwards if the deal really closed on another day.
- When a deal moves to Won, its main contact's status becomes customer. It doesn't change back by itself, even if the deal is reopened.

### Required information

- Every record needs a name.
- A contact needs an organization. This applies to leads too: a lead can't be added before their organization exists.
- A deal needs an organization, a main contact, a stage, a value and a close date. So a deal can't be added before its organization and main contact exist.
- A link left blank by a delete shows as "None". It can stay blank when the record is edited for some other reason, until someone fills it in.

### Deleting

Deleting asks first, and says what will happen to the records linked to the one being deleted:

- Deleting an organization keeps its contacts and deals, which are left with no organization.
- Deleting a contact keeps their deals, which are left with no main contact.
- Activities logged on a deleted contact or deal are deleted with it.
- Won deals stay on the dashboard after the organization or contact they were linked to is deleted.

### Commands and data

- It starts with one documented command that works on Mac, Linux and Windows, which prints the app's address.
- One documented command resets the data to the sample data. A second empties the database, to start with real data. Both ask before wiping anything.

### Regulatory and timeline

- No regulatory or privacy requirements are stated yet. *(Assumption: while the data stays on one computer used by one person, no privacy rule changes the MVP's scope. This must be reviewed before real business use or sharing; see section 12.)*
- There is no fixed deadline. The MVP is done when the success and acceptance criteria are met and the product owner approves it.

## 10. Success criteria

### Business and user outcomes

1. Someone new to Accountable, with only the sample data and no instructions, can find which companies we deal with, who our contacts are, what's in the pipeline, what happened last with a customer and what needs doing next, each within a couple of clicks of the dashboard.
2. The salesperson uses Accountable as their only record of companies, contacts, deals and follow-ups for 2 weeks of normal work, without going back to a spreadsheet. *(Proposed target)*
3. In those 2 weeks, every follow-up the salesperson logs is either marked done or shown as overdue on the dashboard, so none is lost unnoticed. *(Proposed target)*
4. The salesperson can say how sales are going this month, and what's expected from the open pipeline, from the dashboard alone, in under a minute. *(Proposed target)*
5. The product owner rates every screen as sharp, modern, professional and on brand, and the dashboard as visually stunning.

## 11. Acceptance criteria

1. Someone non-technical can start Accountable with the one documented command, open it in a browser and land on the dashboard, with sample data on every screen.
2. Organizations, contacts (leads, qualified contacts and customers) and deals can each be added, found by searching, sorted, edited and deleted from their tables. Every change is still there after a refresh and after a restart. Deleting asks first, and the linked records end up as the warning said. The reset command brings back the sample data, and the empty command leaves an empty app that still works on every screen.
3. Contacts can be filtered by status, and each record's page shows the records it's linked to. An organization's page shows the combined timeline of its contacts and deals.
4. Dragging a deal to another column on the pipeline changes its stage and its probability of close, and the deals list shows both. A card dropped anywhere in a column, including higher or lower in its own column, stays there after a refresh. The board's and the columns' totals and expected revenue change as soon as the card moves. A deal added in a column starts at that stage, and late deals stand out.
5. An activity or follow-up logged on a contact or deal appears in its timeline, newest first, and so does an entry for each change of stage. Anything on a deal also appears on its main contact's timeline. Follow-ups show on the dashboard as upcoming or overdue until they're marked done.
6. The dashboard's figures match the data, and they reflect a deal marked won or a new follow-up. A deal marked won counts in the month it was won, and its main contact becomes a customer.
7. The dashboard has a line chart, a bar chart and a visual of the pipeline.
8. Data survives a restart of the app and of the computer, including an unexpected shutdown.
9. Before it's called done, the coding agent has used it end to end in a real browser, the way a salesperson would. That covers every section and every action above, with each screen checked by eye and no errors in the browser's console, and the agent fixes what it finds. Then the product owner uses it and has the final say, including on how it looks. Passing tests is necessary, but it isn't enough.

## 12. Risks and assumptions

### Assumptions

| Assumption | If it's wrong |
|---|---|
| Only the salesperson can use their computer, so no sign-in is needed. | Anyone at the computer can read and change sales data. Sign-in would move into scope. |
| No privacy or regulatory rule applies while the data stays on one computer. | Rules such as GDPR could require deleting or exporting a person's data on request, which is out of scope today. |
| The salesperson backs up the data file themselves. | A lost or broken computer loses all the data. |
| Node and uv can be installed on the salesperson's computer. | A non-technical user may not manage the install alone. |
| One salesperson's needs are close enough to the wider team's. | The data model may need changes when the team joins. |
| The problem's impacts (missed follow-ups, no forecast, knowledge in one person's head) are as described in section 2. | The success measures may target the wrong thing. |

### Risks

| Risk | Impact |
|---|---|
| Requiring an organization for every contact, including leads, adds a step for individual buyers. | Small friction when adding leads. Accepted by the product owner. |
| There are no baselines for the business outcomes. | Success can only be judged against the proposed targets in section 10, not against an improvement on today. |
| "Visually stunning" and "a pleasure to use" are judgement calls. | Rework if the product owner's review finds the look falls short. Mitigated by mockups reviewed before building. |
| Moving to several users and hosting later may need changes to how data is stored. | Extra work in a later version. |

## 13. Open questions

- Sign-in, several people sharing the same data, and a record of who did what are for a later intent.
- Making Accountable available beyond the computer it runs on is for later too.
- Which privacy rules apply once a real business uses it, and what they require.
- Whether the proposed targets in section 10 are the right measures, and who checks them over the 2 weeks.
- Which real business will use it after the course, and whether their needs differ from this intent.

## 14. Approval and ownership

| | |
|---|---|
| **Product owner** | The project owner |
| **Status** | Approved |
| **Last updated** | 21 Nov 2026 |
| **Approval decision** | Approved by the product owner on 21 Nov 2026, including the proposed targets in section 10 and the assumptions in section 12. Any change from here needs the product owner's approval. |
