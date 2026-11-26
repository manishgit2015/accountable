# Spec: Search

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The search box in the top bar, which finds any organization, contact or deal. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.13 Search

- **R120 Search box:** the top bar has a search box on every page, labelled "Search", with the placeholder "Search organizations, contacts and deals". Pressing `/` anywhere outside a field puts focus in it. Each table's own search box (R40) stays as it is.
- **R121 What it matches:** typing two or more characters searches the names of every organization, contact and deal for that text anywhere in the name, ignoring case. Spaces at either end are ignored. The search runs on the server (`GET /api/search`, section 5.3), 200 ms after the last key press, so it covers every record whatever is loaded on the page.
- **R122 Results:** a list opens under the box with up to three groups, Organizations, Contacts and Deals, in that order, each with its 5 best matches. A name that starts with the text comes before one that only contains it, then names go A–Z. Each row shows the name, and in Muted ink the organization (for a contact), or the organization and the stage badge (for a deal), or the industry (for an organization). When a group has more than 5 matches, its heading shows the total ("Contacts · 12").
- **R123 Opening a result:** clicking a row, or pressing Enter on the highlighted one, opens that record's page and closes the list. The Up and Down arrows move the highlight. Escape closes the list, and a second Escape clears the box.
- **R124 No matches:** "No matches for 'xyz'". While the search is running the list shows "Searching…", and if it fails, "Couldn't search. Try again."
- **R125 The same on every database:** the same text finds the same records, in the same order, on SQLite and on Postgres, including names with accents or capitals, and text containing `%` or `_`, which are matched as plain characters.
