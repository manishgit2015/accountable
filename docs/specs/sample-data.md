# Spec: Sample data and commands

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Starting the app, the sample data, and the reset and empty commands. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.8 Sample data and commands

- **R1** One command, `npm run dev`, installs anything missing on its first run, starts the app and prints the address to open (`http://127.0.0.1:5173`, rather than `localhost`, which some systems resolve to the IPv6 address the servers don't listen on). It works on Mac, Linux and Windows, with Node 24 or later and uv installed beforehand.
- **R4** A new database is filled with sample data. `npm run seed` resets it to the sample data and `npm run clear` empties it. Both ask "Type yes to continue" and do nothing unless the answer is `yes`, and `--yes` skips the question.
- **R80** About 12 organizations across at least 6 industries, 40 contacts covering all three statuses, 45 deals at every stage, and 150 activities.
- **R81** Won and lost deals in every one of the last 12 months, open deals with close dates over the next 3 months, and at least 4 late deals.
- **R82** Follow-ups that are overdue, due today, due in the next 7 days, due later, and done.
- **R83** Every deal has a stage history that starts with its creation and ends at its current stage. Dates are relative to the day the data is generated, so the sample data always looks current.
- **R84** Names are realistic but made up, with no real companies.
