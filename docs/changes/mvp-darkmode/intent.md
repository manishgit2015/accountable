# Intent: dark mode

## Problem

Accountable only has a light mode, and some people prefer a dark screen.

## Proposed outcome

A dark mode with a toggle on every page, across every section.

## Constraints

- Light mode stays the default, and the app remembers the choice.
- Light mode looks exactly as it does today, apart from the toggle.
- Colors stay in one place, as tokens, with no scattered overrides.
- Text in dark mode meets the same contrast rules as spec.md.
- Charts, dialogs and messages follow the mode too.
- No new dependencies unless the plan makes the case for one.
- The choice is remembered in the browser (localStorage), with no backend, API or database change. It's per browser, so another browser starts in light mode.
- The dark palette is derived from the brand (Midnight-based surfaces, with lighter text variants of the accents where needed). Each dark text color meets 4.5:1 against the dark surface it sits on, as spec 3.9's rules do against white. The plan proposes the tokens, and the product owner approves them from the screenshots.

## Decisions

Answers from the product owner, 25 Nov 2026:

- The change's branch is `mvp-darkmode`, and this folder is named after it, as AGENTS.md requires. (On 25 Nov the branch was to be renamed `dark-mode`; on 26 Nov the product owner kept `mvp-darkmode` and the folder was renamed to match.)
- The choice is stored in the browser, not the database.
- The dark palette is derived from the brand and approved by eye, rather than from a mockup or a supplied palette.

## Not in this change

- Following the device's own dark mode setting.
- A layout for phones.

## Success criteria

1. npm run check passes.
2. A new end-to-end test proves that the toggle works and is remembered after a reload.
3. Screenshots of the dashboard and the pipeline in both modes are saved in docs/changes/mvp-darkmode/.
