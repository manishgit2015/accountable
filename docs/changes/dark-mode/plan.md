# Plan: dark mode

Status: approved by the engineer on 25 Nov 2026.

## 1. What this change builds

A dark mode with a toggle in the top bar, as `intent.md` sets out and `docs/spec.md` now describes: R90–R95 (section 3.10), the light and dark tokens and the "Dark mode" rules in section 3.9, NFR-7 and R7 in both modes, ENG-1 (colors only from tokens), ADR-017 to ADR-019, the edge cases in section 4.5, and the verification cases V-F11, V-E13 and V-M04.

The work happens in the frontend only. There's no backend, API, database or migration change (ADR-018), and no new dependency: the moon and sun icons come from `lucide-react`, which the app already uses.

## 2. Approach

### 2.1 Split the tokens first, with no visible change

Today some tokens do two jobs, and dark mode needs them apart:

- `--ink` is the main text color, and it's also used for Midnight fills (the hero, the active tab and the wordmark square: 4 `background: var(--ink)` rules) and for Midnight text on light fills (badges, stage icons and the primary button).
- `--cerulean-text` and `--raspberry-text` are text colors, and they're also the fills under small white text (5 `background:` rules, ADR-017).
- The overlay is a literal `rgba(7, 59, 76, 0.28)` in `global.css`.
- The revenue chart's dots use `var(--ink)` to mean Midnight.

Task T1 adds `--midnight`, `--cerulean-strong`, `--raspberry-strong` and `--overlay`, each with the same value as the color it replaces, and moves every second-job use onto them. There are 36 uses of `--ink`, `--cerulean-text` and `--raspberry-text` in `global.css`, and 19 token uses in the dashboard charts. Each is checked by hand: is it text on a panel or the page (keep it), or a fill or text on a fill (move it)? Because the values don't change, light mode is pixel for pixel the same after T1, and the baseline screenshots from T0 prove it.

### 2.2 Dark values in the same file

`tokens.css` keeps the light values on `:root` with `color-scheme: light`, and adds a `:root[data-theme="dark"]` block that redefines only the tokens in spec 3.9's "change with the mode" table, plus `color-scheme: dark`. No component or stylesheet has a dark-mode rule of its own (ENG-1). Charts already take their colors from `var(--…)` props, so they follow the mode as soon as the tokens change.

### 2.3 Choosing, applying and remembering the mode

- **`frontend/src/lib/theme.ts`** holds the logic: the storage key `accountable.theme`, `readTheme()` (returns `"light"` unless `localStorage` holds exactly `"dark"`, and returns `"light"` if reading throws), `applyTheme(theme)` (sets or removes `data-theme="dark"` on `<html>`), and `saveTheme(theme)` (writes, and ignores a write that throws). It's pure enough to unit test with a fake storage (R91–R93).
- **Before the first paint:** a short inline classic script in the `<head>` of `frontend/index.html` reads the key and sets `data-theme` before the body is parsed. A module script in `main.tsx` would run too late to rule out a flash of light mode, because the Vite dev server loads modules on demand (ADR-010). The inline script does the same as `readTheme` and `applyTheme`, wrapped in `try`. It's kept to a few lines, with a comment pointing at `theme.ts`, and V-E13 tests the behavior they share, so the two can't drift unnoticed.
- **`frontend/src/components/ThemeToggle.tsx`:** a button styled like the secondary icon button, with the accessible name "Dark mode", `aria-pressed`, and a `Moon` or `Sun` icon. Its state starts from `document.documentElement.dataset.theme`, so it agrees with what the inline script did. A click applies and saves the new mode. It doesn't remount the app or change the route, so open forms and what's typed in them are kept (R90).
- **`TopBar.tsx`** puts the toggle in `topbar-right`, before "Add deal" (spec 3.9 Layout).
- Other tabs aren't kept in sync (spec 4.5, *[Assumption]*). A `storage` event listener would do it, and can be added if the product owner wants it.

### 2.4 Proving light mode is unchanged (R94)

T0 saves baseline screenshots of light mode before any code changes. After T1, the light screenshots must match them exactly. After the toggle is added (T3), they must match with the top bar's right-hand group masked, since that's the only intended difference. These are Playwright screenshot comparisons in the `visual` suite (`node scripts/run-tests.mjs visual`), not in `npm test`, because font rendering differs between machines. The baselines are for this change only and live in `docs/changes/dark-mode/baseline/`.

## 3. Files

| File | Change |
|---|---|
| `frontend/src/styles/tokens.css` | New tokens `--midnight`, `--cerulean-strong`, `--raspberry-strong`, `--overlay`. `color-scheme`. The `:root[data-theme="dark"]` block. |
| `frontend/src/styles/global.css` | Fills and text on fills move to the new tokens. The overlay uses `--overlay`. The toggle's style. No dark-mode rules. |
| `frontend/src/pages/dashboard/RevenueChart.tsx` | Dots use `--midnight`. Other chart files are checked, and change only where a token is doing a second job. |
| `frontend/index.html` | The inline script that applies the saved mode before the first paint |
| `frontend/src/lib/theme.ts` | New: read, apply and save the mode |
| `frontend/src/components/ThemeToggle.tsx` | New: the toggle |
| `frontend/src/components/TopBar.tsx` | Shows the toggle |
| `frontend/src/lib/theme.test.ts` | New (V-F11) |
| `frontend/src/components/ThemeToggle.test.tsx` | New (V-F11) |
| `frontend/src/styles/tokens.test.ts` | New (V-F11): contrast pairs, and colors only in `tokens.css` |
| `e2e/theme.spec.ts` | New (V-E13) |
| `e2e/visual/dark-mode.spec.ts` | New (V-M04): the baselines, the light comparison, and the screenshots in both modes |
| `playwright.config.ts` | `snapshotPathTemplate: "docs/changes/{arg}{ext}"`, so a visual test's baselines live in the change folder it names |
| `docs/changes/dark-mode/` | `baseline/`, and `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png`, `pipeline-dark.png` (intent success criterion 3) |
| `docs/spec.md` | Already updated on this branch. Updated again if the build turns up something it doesn't describe. |
| `docs/STATUS.md`, `docs/build_logs.log` | Progress and evidence |

## 4. Verification

### 4.1 Unit tests (Vitest), V-F11

- `lib/theme.test.ts`: no saved value means light; `"dark"` means dark; any other value means light; reading or writing that throws means light with no error; `applyTheme` sets and removes `data-theme`; `saveTheme` writes the key (R91–R93).
- `components/ThemeToggle.test.tsx`: it starts from the `data-theme` already on `<html>`; a click switches mode, saves it, and flips `aria-pressed` and the icon; Enter and Space work; with storage that throws, it still switches and nothing is logged (R90, R93).
- `styles/tokens.test.ts`:
  - It parses `tokens.css` and checks spec 3.9's contrast rules in both modes. Every text token must reach at least 4.5:1 against `--panel`, and against `--page` too, except `--ink-muted` in light mode, which is for white only. Midnight on Sea Mist and the light fills, and white on Midnight and the strong fills, must reach 4.5:1 too. A dark value that slips below 4.5:1 fails the test (NFR-7).
  - It fails if any `.css`, `.ts` or `.tsx` file in `frontend/src` other than `tokens.css` and the tests contains a hex, `rgb()`, `rgba()` or `hsl()` color, or a named color (such as `white`) as a CSS value or in a `fill`, `stroke`, `color` or `background` prop (ENG-1, the intent's "no scattered overrides"). Named colors are checked only in those places, so words like "white" in comments and copy don't trip it.
  - It fails if the dark block sets a token the light block doesn't have.

The contrast check is about 15 lines of luminance arithmetic, with no new dependency. The spec's V-F11 row is updated to name `styles/tokens.test.ts`.

### 4.2 End to end (Playwright), V-E13 `e2e/theme.spec.ts`

Every test goes through `e2e/fixtures.ts`, so a console error or a request outside localhost fails it (V-E00).

1. **R91, R94:** on first load, `<html>` has no `data-theme`, and the page and panel background colors are `#F0F4F5` and `#FFFFFF`.
2. **R90:** the toggle is in the top bar on each of the five sections and on a record page.
3. **R90, R95:** clicking it gives `data-theme="dark"`, `aria-pressed="true"`, a `#04232E` page and `#000000` panels. That's checked on the dashboard (including a chart tooltip's panel), the pipeline (a card), a table, a deal's page, the Add deal side panel and a delete dialog.
4. **R90:** with the Add deal form open and a name typed in, switching mode keeps the panel open and the name in the field.
5. **R92:** after a reload, dark mode is still on. It's already set when the page reaches `domcontentloaded`, before React has rendered, which shows the inline script ran first. Switching back to light and reloading keeps light.
6. **R90, NFR-7:** the toggle can be reached with Tab and switched with Space, with its focus ring visible.

This is the "new end-to-end test" of intent success criterion 2.

### 4.3 Screenshots and the light-mode comparison, V-M04 `e2e/visual/dark-mode.spec.ts`

- Baselines at 1440px, light mode, taken in T0 before any code changes: the dashboard, the pipeline, the deals table, a deal's page, the Add deal side panel and a delete dialog.
- The comparison of the same screens with the baselines: an exact match after T1, and after T3 an exact match with the top bar's right-hand group masked (R94).
- `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png` and `pipeline-dark.png`, full page, saved in `docs/changes/dark-mode/` (intent success criterion 3).

### 4.4 By hand (AC9, V-M01, V-M04)

- A walkthrough in a real browser, in both modes, of every section and every action the change touches:
  - every page, the pipeline (including a drag), each form's side panel and its pickers
  - the delete dialog, the row menu, a date picker, the timeline and its activity form
  - the empty states (after `npm run clear` on a test database), the offline banner (with the backend stopped), and the board's error message
  - chart tooltips on all three charts

  Each screen is checked by eye against spec 3.9's dark mode rules, with no console errors. Findings and screenshots go in `docs/build_logs.log`.
- The product owner reviews the dark palette from the screenshots and approves it, or asks for changes (ADR-019). Two things to look at in particular: the black panels on the darker teal page, and the Midnight active tab on the black top bar.

### 4.5 Checks

`npm run check` passes (intent success criterion 1), with the output saved under `docs/evidence/`.

### 4.6 Requirement to code and test

| Requirement | Code | Test |
|---|---|---|
| R90 Toggle | `ThemeToggle.tsx`, `TopBar.tsx` | V-F11 (`ThemeToggle.test.tsx`), V-E13 steps 2–4 and 6 |
| R91 Default light | `theme.ts`, `index.html` | V-F11 (`theme.test.ts`), V-E13 step 1 |
| R92 Remembered | `theme.ts`, `index.html` | V-F11, V-E13 step 5 |
| R93 Storage not available | `theme.ts`, `index.html`, `ThemeToggle.tsx` | V-F11 |
| R94 Light mode unchanged | `tokens.css`, `global.css` (token split) | V-M04 baseline comparison, V-E13 step 1 |
| R95 Everything follows | `tokens.css`, `global.css`, chart files | V-E13 step 3, V-M04, walkthrough |
| NFR-7 Contrast in both modes | `tokens.css` | V-F11 (`tokens.test.ts`), walkthrough |
| ENG-1 Colors only from tokens | all styles and chart files | V-F11 (`tokens.test.ts`) |
| R7 Clean console in both modes | (all) | V-E00 in V-E13, walkthrough |

## 5. Tasks

Each task ends with its evidence in `docs/build_logs.log`, and `npm run check:quick` passing.

| Task | Work | Done when |
|---|---|---|
| T0 | Write `e2e/visual/dark-mode.spec.ts` and take the light baselines on the current code, before anything else changes | Six baselines saved in `docs/changes/dark-mode/baseline/` |
| T1 | Split the tokens (section 2.1), and add `styles/tokens.test.ts`'s literal-color and contrast checks for light mode | Light screenshots match the baselines exactly. The token test passes. |
| T2 | Add the dark block to `tokens.css`, `lib/theme.ts` and its tests, and the inline script | `tokens.test.ts` passes for dark mode too. Setting the key by hand and reloading shows dark mode with no flash. |
| T3 | Add `ThemeToggle` to the top bar, with its tests | The toggle works. Light screenshots match the baselines with the toggle area masked. |
| T4 | Walk every screen in dark mode (section 4.4) and fix what's wrong, by changing which token a rule uses, never with a dark-only rule | Every item in section 4.4 has been checked in both modes, with no console errors |
| T5 | `e2e/theme.spec.ts` (V-E13) | It passes, and fails when the toggle's save is commented out (checked once, then restored) |
| T6 | Take the four screenshots into `docs/changes/dark-mode/` | The files are there, and checked by eye |
| T7 | `npm run check`. Update `docs/STATUS.md`, and the spec if anything has drifted. The product owner reviews the palette. | `npm run check` passes and the product owner approves |

## 6. Risks

| Risk | Handling |
|---|---|
| A `var(--ink)` used as Midnight on a fill is missed, so a badge or button shows Sea Mist text on a bright fill in dark mode | T1 checks each of the 36 uses by hand. T4's walkthrough covers every badge and stage color. The light screenshots can't catch this, because the values are the same in light mode. |
| The light-mode comparison fails on pixels that didn't really change (font hinting, chart animation) | Charts render with animation off, as they do today (`isAnimationActive={false}`). The comparison runs on one machine, against baselines taken on that same machine in T0. If needed, a tiny `maxDiffPixels` is allowed, with the reason recorded. Real shifts still fail. |
| The inline script and `theme.ts` drift apart | Both are a few lines, with a comment linking them, and V-E13 step 5 tests the inline script's result |
| A flash of light mode on reload in dark mode | The inline script runs before the body is parsed (section 2.3). V-E13 step 5 checks `data-theme` at `domcontentloaded`. |
| Native controls (date inputs, scrollbars, selects) stay light | `color-scheme: dark` on the dark root, checked in T4 |
| Recharts sets a color of its own that isn't a token (a default cursor, tooltip or label color) | T4 checks every chart's hover and tooltip in dark mode. Any default found is set to a token in its props. |
| The Midnight hero and active tab are hard to see against the dark page and the black top bar | The product owner decides at review. The alternative for the active tab (a Sea Mist pill with Midnight text, 8.3:1) is ready if they want it. |
| The literal-color test flags something legitimate, such as `transparent` or `currentColor` | Those two keywords are allowed, and the test lists them. Nothing else is. |

## 7. Definition of done

- Intent success criteria 1–3 are met: `npm run check` passes, V-E13 passes, and the four screenshots are in `docs/changes/dark-mode/`.
- Light mode matches the T0 baselines, apart from the toggle (R94).
- The walkthrough in section 4.4 is done in both modes and recorded, with no console errors.
- `docs/spec.md` describes the product as built, and `docs/STATUS.md` is updated.
- The product owner has approved the dark palette (ADR-019).
