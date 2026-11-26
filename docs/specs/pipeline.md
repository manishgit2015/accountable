# Spec: Pipeline

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The pipeline board: columns, cards, dragging and totals. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.6 Pipeline

- **R60** Six columns, New to Lost, each with a header showing the stage name, the number of deals, their total value and their expected revenue. Won and Lost are narrower and show compact rows (name, organization, value, close date). They hold only deals closed this calendar month (by `closed_at`, local time). They list the 5 most recent, with "N more · Show all" to expand the column in place, and their count and value cover this month only. Deals closed in earlier months stay in the Deals table and on the dashboard, but leave the board (C-2).
- **R61** Above the board: the total value and expected revenue of the open pipeline (Won and Lost excluded), and a panel with a stacked bar of open value by stage, showing each stage's deal count, value and expected revenue.
- **R62** Open-stage cards show the organization's initials, the deal name, the organization and main contact, the value and close date, and a probability meter in the stage color with its percentage. Late deals show a Raspberry "Late" badge with the date in place of the plain date.
- **R63** Dragging a card to another column changes its stage (R15–R18). Dragging it within a column, or into a gap between two cards in another column, puts it exactly where it was dropped. The order is saved and survives a refresh.
- **R64** Totals change the moment a card is dropped. If the save fails, the card goes back, the totals are restored, and an error message says so.
- **R65** Each open column has an "Add deal" button that opens the deal form with that stage chosen. The new card goes to the top of its column.
- **R66** Clicking a card opens the deal's page. Dragging also works from the keyboard: focus a card, press Space to lift it, use the arrow keys to move it, Space to drop and Escape to cancel.
- **R67** A deal whose stage changes anywhere else (its edit form or its page) goes to the top of its new column.
