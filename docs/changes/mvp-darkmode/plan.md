# Plan: dark mode

Status: approved by the engineer on 25 Nov 2026, and restructured the same day into four sections with the same content. Phases 1 to 3 (T0–T2) are built and committed (`ead0cb4`, `31de085`, `15e1f61`). Phases 4 to 8 (T3–T7) were built on 26 Nov 2026 and committed in `2c0841d`, with the first independent review's fixes. The product owner approved the dark palette on 26 Nov 2026; they approved the retaken screenshots, with the first review's `--line` change and the second's full-size toggle icon (REV-008), the same day.

This plan builds what `intent.md` sets out and `docs/spec.md` describes:

- R90–R95 (section 3.10)
- the light and dark tokens and the "Dark mode" rules in section 3.9
- NFR-7 and R7 in both modes, and ENG-1 (colors only from tokens)
- ADR-017 to ADR-019, and the edge cases in section 4.5
- V-F11, V-E13 and V-M04

The work is frontend only: there's no backend, API, database or migration change (ADR-018). It adds no dependency. The moon and sun icons come from `lucide-react`, and the token test's Node types from `@types/node`, both already frontend dependencies.

## 1. Files that change

| File | Change | Phase |
|---|---|---|
| `frontend/src/styles/tokens.css` | Fixed tokens `--midnight`, `--cerulean-strong`, `--raspberry-strong` and `--overlay`, each with the value of the color it replaced. `color-scheme: light` on `:root`. A `:root[data-theme="dark"]` block holding only the tokens that change with the mode, plus `color-scheme: dark`. Phase 5 adds `--line` and `--raised`. | 2, 3, 5 |
| `frontend/src/styles/global.css` | Fills and text on fills move to the fixed tokens (16 rules). The overlay uses `--overlay`. Field outlines and dashed lines use `--line`; floating surfaces and secondary buttons use `--raised`; the toggle keeps its focus ring. The toggle's style. No dark-mode rules. | 2, 4, 5 |
| `frontend/src/pages/dashboard/RevenueChart.tsx` | The dots use `--midnight` | 2 |
| Other chart files (`WonLostChart.tsx`, `StageDonut.tsx`, `FunnelPanel.tsx`) | Change only if phase 5 finds a Recharts default color that isn't a token | 5 |
| `frontend/index.html` | An inline script in `<head>` that applies the saved mode before the first paint | 3 |
| `frontend/src/lib/theme.ts` | New: `THEME_KEY`, `readTheme`, `saveTheme`, `applyTheme`, `currentTheme` | 3 |
| `frontend/src/components/ThemeToggle.tsx` | New: the toggle | 4 |
| `frontend/src/components/TopBar.tsx` | Shows the toggle in `topbar-right`, before "Add deal" | 4 |
| `frontend/src/styles/tokens.test.ts` | New (V-F11): contrast pairs, and no literal colors outside `tokens.css` | 2, 3 |
| `frontend/src/lib/theme.test.ts` | New (V-F11) | 3 |
| `frontend/src/components/ThemeToggle.test.tsx` | New (V-F11) | 4 |
| `e2e/theme.spec.ts` | New (V-E13) | 6 |
| `e2e/keyboard.spec.ts` | V-E11's focus check requires the focus ring itself, not any shadow, and a new test checks secondary buttons' ring in both modes | 8 |
| `e2e/visual/dark-mode.spec.ts` | New (V-M04): the light-mode comparison with the baselines (zero tolerance, top bar's right-hand group masked). Phase 7 adds the screenshots in both modes. | 1, 7 |
| `playwright.config.ts` | `snapshotPathTemplate: "docs/changes/{arg}{ext}"`, so a visual test's baselines live in the change folder it names | 1 |
| `docs/changes/mvp-darkmode/baseline/` | Six light-mode baselines: the dashboard, pipeline, deals table, a deal's page, the Add deal side panel and a delete dialog | 1 |
| `docs/changes/mvp-darkmode/*.png` | `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png`, `pipeline-dark.png` (intent success criterion 3) | 7 |
| `docs/spec.md` | Already describes dark mode. Phase 5 adds `--line` and `--raised` to section 3.9, and a focus gap to 17.1. Updated again if the build turns up anything else it doesn't describe. | 5, 8 |
| `docs/STATUS.md`, `docs/build_logs.log` | Progress, and evidence for each task | Every phase |

## 2. Order of work

Each phase ends with its evidence in `docs/build_logs.log`, `npm run check:quick` passing, and a commit. From phase 2 on, the light-mode comparison must pass too: `node scripts/run-tests.mjs visual dark-mode`.

### Phase 1 (T0): light-mode baselines. Done.

- Write `e2e/visual/dark-mode.spec.ts`.
- Take the six light-mode baselines on the code as it was, before any change.

Done when: the six baselines are in `docs/changes/mvp-darkmode/baseline/`, and two more runs match them.

### Phase 2 (T1): split the tokens, with no visible change. Done.

Some tokens did two jobs:

- `--ink` was the main text color and also the Midnight fill, and Midnight text on light fills.
- `--cerulean-text` and `--raspberry-text` were text colors and also the fills under small white text.

Dark mode needs these apart. So:

- Every use of `--ink`, `--cerulean-text`, `--raspberry-text` and `--on-fill` is checked by hand: text on a panel or the page stays, and a fill or text on a fill moves to a fixed token. The same goes for the chart colors and the inline styles.
- The overlay's literal `rgba()` becomes `--overlay`.
- `styles/tokens.test.ts` is added.

The values don't change, so light mode is the same down to the pixel.

Done when: light mode matches the baselines with zero tolerance, and a one-step color change makes all six fail (a probe, undone afterwards). The token test passes, apart from the one light-mode gap listed in spec 17.1.

### Phase 3 (T2): dark values, theme logic and the before-paint script. Done.

- The dark block in `tokens.css`.
- `lib/theme.ts` and its tests.
- The inline script in `index.html`. A module script would run too late to rule out a flash of light mode, because the dev server loads modules on demand (ADR-010). The script follows the same rules as `readTheme` and `applyTheme`, wrapped in `try`, with a comment linking the two.

Done when: the dark contrast checks pass, and setting `accountable.theme` to `dark` by hand and reloading shows dark mode with `data-theme` already set at `domcontentloaded`. Light mode still matches the baselines.

### Phase 4 (T3): the toggle

- `ThemeToggle.tsx` is a 36px icon button styled like a secondary button, with the accessible name "Dark mode", `aria-pressed`, and a `Moon` or `Sun` icon.
- Its state starts from `<html data-theme>`, so it agrees with what the inline script did.
- A click applies and saves the new mode, without remounting the app or changing the route, so open forms keep what's typed in them (R90).
- `TopBar.tsx` shows it before "Add deal".
- Other tabs aren't kept in sync (spec 4.5, *[Assumption]*). A `storage` event listener would do it, if the product owner wants it.

Done when: the toggle's tests pass, and light mode matches the baselines with the toggle's area masked. If the toggle moves the tabs, that's an R94 question for the product owner before going on.

### Phase 5 (T4): walk every screen in dark mode and fix what's wrong

Fixes change which token a rule uses, or add a token. They never add a dark-only rule. Known so far: form field outlines use `--sea-mist`, a fill token, which is too bright on black. They get a new `--line` token, Sea Mist in light mode and a quieter line in dark mode, added to spec 3.9.

The walkthrough covers, in both modes:

- every page, and the pipeline with a drag
- each form's side panel and its pickers, the delete dialog, the row menu and a date picker
- the timeline and its activity form
- the empty states (after `npm run clear` on a test database)
- the offline banner (with the backend stopped) and the board's error message
- the tooltips on all three charts

Each screen is checked by eye against spec 3.9's dark mode rules, with no console errors.

Done when: every item above has been checked in both modes, and its findings are fixed or recorded.

### Phase 6 (T5): the end-to-end test

- `e2e/theme.spec.ts` (V-E13): see section 4.2.

Done when: it passes, and fails when the toggle's save is commented out (checked once, then restored).

### Phase 7 (T6): the screenshots

- `e2e/visual/dark-mode.spec.ts` saves the dashboard and the pipeline, full page at 1440px, in both modes, into `docs/changes/mvp-darkmode/`.

Done when: the four files are there and have been checked by eye.

### Phase 8 (T7): check and approve

- `npm run check`, with its output saved under `docs/evidence/`.
- Update `docs/STATUS.md`, and the spec if anything has drifted.
- The product owner reviews the dark palette from the screenshots (ADR-019). Two things to look at in particular: the black panels on the darker teal page, and the Midnight hero and active tab on the dark page and black top bar.

Done when: `npm run check` passes and the product owner approves.

The product owner approved the palette on 26 Nov 2026, and asked for the focus ring on every secondary button too. `.btn-secondary:focus-visible` now keeps the ring over the shadow (replacing the toggle-only rule), a light-mode change they approved (R94). V-E11's check was tightened, because it counted any shadow as a focus indicator, which is how the gap went unnoticed.

## 3. Risks

| Risk | Handling |
|---|---|
| A `var(--ink)` used as Midnight on a fill is missed, so a badge or button shows Sea Mist text on a bright fill in dark mode | Phase 2 checked every use by hand (listed in the build log). Phase 5's walkthrough covers every badge and stage color. The light screenshots can't catch this, because the values are the same in light mode. |
| A fill token is used as a line or text color, and is too bright in dark mode | Phase 5 looks for these. Form field outlines are one, fixed with `--line`. |
| The light-mode comparison fails on pixels that didn't really change (font hinting, chart animation) | Charts render with animation off, and Playwright waits for two identical screenshots. The baselines and later runs are on the same machine. So far, every run has matched at zero tolerance. |
| The light-mode comparison passes when it shouldn't | It uses threshold 0, and a probe showed a one-step change in `--midnight` fails all six screens |
| The toggle moves the tabs, so light mode changes beyond the toggle | Phase 4's comparison with the masked baselines shows it. The product owner decides before going on. |
| The inline script and `theme.ts` drift apart | Both are a few lines, with a comment linking them. V-E13 tests the inline script's result. |
| A flash of light mode on reload in dark mode | The inline script runs before the body is parsed. V-E13 checks `data-theme` at `domcontentloaded`. |
| Native controls (date inputs, scrollbars, selects) stay light | `color-scheme: dark` in the dark block. Phase 3 confirmed dark selects and date pickers, and phase 5 checks the rest. |
| Recharts sets a color of its own that isn't a token (a default cursor, tooltip or label color) | Phase 5 checks every chart's hover and tooltip in dark mode. Any default found is set to a token in its props. |
| The token test passes without checking anything | Vitest turns CSS imports, even with `?raw`, into empty strings. So the test reads files with Node, and checks that what it read isn't empty. A probe `rgba()` in `global.css` made it fail. |
| The literal-color test flags something legitimate | Named colors are checked only as CSS values and color props, and comments are skipped. `url(#id)` is allowed. A self-check covers both cases. |
| The Midnight hero and active tab are hard to see in dark mode | The product owner decides in phase 8. The alternative for the active tab, a Sea Mist pill with Midnight text (8.3:1), is ready. |
| Light mode has one contrast gap that this change can't fix (Raspberry text on a hovered row, 4.47:1) | It predates dark mode, and R94 keeps light mode as it is. It's recorded in spec 17.1, and pinned in the token test, so a new failure or a fix both show up. |

## 4. Proof

### 4.1 Unit tests (Vitest), V-F11

**`frontend/src/styles/tokens.test.ts`** (phases 2–3, passing)

- NFR-7 light mode: every text token reaches 4.5:1 on `--panel` and `--page` (`--ink-muted` on `--panel` only), and so does every text-on-fill pair. The one exception is the known gap in spec 17.1, listed exactly.
- NFR-7 dark mode: the same pairs with the dark values, and `--ink-muted` on the page too. No exceptions.
- ENG-1: the dark block only redefines tokens that light mode has.
- The contrast arithmetic reproduces spec 3.9's figures (12.1:1 and 4.6:1).
- ENG-1: the scan covers the styles, components, pages and charts, and reads their real contents.
- ENG-1: no hex, `rgb()`, `rgba()`, `hsl()` or named color appears in `frontend/src` outside `tokens.css` and the tests.
- ENG-1: the literal-color check catches each kind of color, and doesn't catch `url(#id)`.

**`frontend/src/lib/theme.test.ts`** (phase 3, passing)

- R91: light when nothing is saved, and for any value other than `dark`.
- R92: `dark` is read as dark; the choice is saved under `accountable.theme`; this browser's `localStorage` is the default.
- R93: light when storage can't be read or doesn't exist, and a write that fails is ignored, including when reading `window.localStorage` itself throws (review REV-001).
- R92: `applyTheme` sets and removes `data-theme` on `<html>`. `currentTheme` reads it, and any other value counts as light.

**`frontend/src/components/ThemeToggle.test.tsx`** (phase 4)

- R90: it starts from the `data-theme` already on `<html>`, in either mode.
- R90: a click switches the mode, saves it, and flips `aria-pressed` and the icon. A second click switches back.
- R90: its accessible name is "Dark mode".
- Enter and Space are checked in real Chrome by V-E13 step 6, not here: jsdom doesn't turn them into a click on a button, and `@testing-library/user-event` isn't a dependency.
- R93: with storage that throws, it still switches, and nothing is logged; and with reading `window.localStorage` itself throwing, it switches both ways (review REV-001).

### 4.2 End to end (Playwright), V-E13 `e2e/theme.spec.ts` (phase 6)

Every test goes through `e2e/fixtures.ts`, so a console error or a request outside localhost fails it (V-E00). This is the "new end-to-end test" in intent success criterion 2.

1. **R91, R94:** on first load, `<html>` has no `data-theme`, and the page and panel colors are `#F0F4F5` and `#FFFFFF`.
2. **R90:** the toggle is in the top bar on each of the five sections and on a record page.
3. **R90, R95:** a click gives `data-theme="dark"`, `aria-pressed="true"`, a `#04232E` page, `#000000` panels and `#0E3240` raised surfaces. That's checked on the dashboard (with the revenue chart's tooltip on the raised surface), the pipeline (a card), a table, its row menu, a delete dialog, the Add deal side panel and a deal's page.
4. **R90:** with a search typed on the contacts table, and a description typed in a contact's Log activity form, switching mode keeps the page and what's typed. (Side panels and dialogs are modal, so the toggle can't be reached while one is open; spec 4.5.)
5. **R92:** after a reload, dark mode is still on, and `data-theme` was already on `<html>` when `<body>` first existed (recorded by an init script), so it was applied before the page could be drawn. Switching back to light and reloading keeps light.
6. **R90, NFR-7:** the toggle can be reached with Tab, its focus ring shows in both modes, and Space and Enter switch it.
7. **R93** (review REV-001): with reading `window.localStorage` made to throw, as when site data is blocked, the app starts light and the toggle switches both ways, with no console error.
8. **NFR-7** (review REV-004): chart tooltip items on both charts are in `--ink`, in both modes.
9. **R90** (second review REV-008): the toggle is 36px square and its icon 18px square, in both modes.
10. **R90** (second review REV-012): with the deals table scrolled to 600px, switching mode in either direction leaves the scroll position at 600px.

**`e2e/keyboard.spec.ts` (V-E11, phase 8)**

- NFR-7: focus is visible at every Tab stop only with an outline, the `--focus-ring` color, a highlighted menu item, or Chrome's own outline on a date field's calendar button.
- NFR-7: in light and dark mode, the mode toggle and the deals table's "Next" show the focus ring, and so does every stop on the way.

### 4.3 Screenshots, V-M04 `e2e/visual/dark-mode.spec.ts` (`node scripts/run-tests.mjs visual dark-mode`)

These are outside `npm test`, because font rendering differs between machines.

- **R94:** six light-mode screens match the phase 1 baselines at zero tolerance, with the top bar's right-hand group masked. Passing since phase 2. Limits: only those six screens at 1440px are compared. The top bar at 1024px and 1280px was checked by eye (same height, no horizontal scroll), and the other screens in the phase 5 walkthrough. The suite isn't part of `npm run check`, so R94 is checked by hand before merge.
- The approved screenshots are replaced only with `ACCOUNTABLE_SCREENSHOTS=1`; a routine run writes them to Playwright's output folder.
- **Intent success criterion 3:** `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png` and `pipeline-dark.png` in `docs/changes/mvp-darkmode/` (phase 7).

### 4.4 By hand and the gate

- The phase 5 walkthrough in both modes (AC9, V-M01, V-M04), recorded in `docs/build_logs.log`.
- The product owner's approval of the dark palette (ADR-019).
- `npm run check` passes (intent success criterion 1).

### 4.5 Requirement to code and test

| Requirement | Code | Test |
|---|---|---|
| R90 Toggle | `ThemeToggle.tsx`, `TopBar.tsx`, `global.css` | `ThemeToggle.test.tsx`, V-E13 steps 2–4, 6, 9 and 10 |
| R91 Default light | `theme.ts`, `index.html` | `theme.test.ts`, V-E13 step 1 |
| R92 Remembered | `theme.ts`, `index.html` | `theme.test.ts`, V-E13 step 5 |
| R93 Storage not available | `theme.ts`, `index.html`, `ThemeToggle.tsx` | `theme.test.ts`, `ThemeToggle.test.tsx`, V-E13 step 7 |
| R94 Light mode unchanged | `tokens.css`, `global.css` | The V-M04 baseline comparison, V-E13 step 1 |
| R95 Everything follows | `tokens.css`, `global.css`, chart files | V-E13 step 3, V-M04, the walkthrough |
| NFR-7 Contrast in both modes | `tokens.css` | `tokens.test.ts`, the walkthrough |
| ENG-1 Colors only from tokens | All styles and chart files | `tokens.test.ts` |
| R7 Clean console in both modes | All | V-E00 in V-E13, the walkthrough |
