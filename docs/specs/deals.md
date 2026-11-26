# Spec: Deals

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Deal rules (stages, probability, winning, losing, late deals) and the effects of each stage move. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

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
