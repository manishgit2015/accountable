# Spec: Dashboard

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. The dashboard's figures, charts, follow-ups and greeting. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.7 Dashboard

- **R70** Summary figures: open pipeline value, expected revenue, won this month (value and count), and win rate over the last 12 months (won ÷ (won + lost), by count). With no closed deals, the win rate shows "None yet".
- **R71 Line chart:** revenue won each month for the last 12 months, the current month included.
- **R72 Bar chart:** deals won each month for the last 12 months, with deals lost shown beside them.
- **R73 Pipeline visual:** open value by stage, as a donut in stage colors with the total open value in the middle and each stage's value listed beside it.
- **R74 Funnel:** for each stage from New to Won, the value of the deals that reached it, with the percentage carried over from the stage before. It counts deals created in the last 12 months. A deal counts at every open stage up to the furthest one its history reached, and a won deal counts at every stage (C-1).
- **R75 Recent activity:** the 10 latest activities and stage changes, each linking to its record.
- **R76 Follow-ups:** open follow-ups grouped into Overdue (due before today), Today and Next 7 days, each with a checkbox to mark it done, plus a count of those due later. Marking one done removes it from the list straight away.
- **R77** Every figure is worked out from the data each time the dashboard loads. A deal won today counts in this month. Months are calendar months in local time.
- **R78** With no data, each panel shows a short empty message instead of a blank chart, and the figures show $0 or "None yet".
- **R79** The greeting is "Good morning" before 12:00, "Good afternoon" from 12:00 to 17:59, and "Good evening" from 18:00, by local time. A one-line summary beside it counts the overdue follow-ups and late deals ("2 follow-ups overdue, 3 deals running late"), or says "Nothing overdue".
