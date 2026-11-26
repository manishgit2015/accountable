# Spec: Look and feel, and light and dark mode

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Layout, typography, color tokens, components, the dashboard grid, dark mode, light and dark mode behavior, and writing. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.9 Look and feel

The look follows the brand guidelines and mockup 1, as detailed below. These rules are verified by eye (V-M04). They describe light mode, the default. Dark mode uses the same layout, type and components with the dark token values, and the differences are listed under "Dark mode" below.

#### Layout

- A floating top bar: a white rounded panel 16px below the top of the window, spanning the content width. It holds the Accountable wordmark (a Midnight square mark with a Sea Green "A"), the tabs Dashboard, Pipeline, Deals, Contacts and Organizations, and on the right the search box (R120), "Add deal", then the user menu button (R106). The active tab is a Midnight pill with white text, and the others are in Muted ink. There's no line under the bar.
- The only sign of who's signed in is their initials on the user menu button (R106). There are no photos or avatars.
- The content area has the page background `#F0F4F5`, a maximum width of 1440px and a 32px gutter. Each page has a title (Instrument Sans 28px, semibold).
- Content sits in white panels with 12px corners, no outline and a soft shadow (`0 1px 2px rgba(7,59,76,.06), 0 4px 16px rgba(7,59,76,.04)`). There are no single-edge borders and no rule along the top of the page.
- Forms open in a right-hand side panel 480px wide. Delete confirmations open in a centered dialog.

#### Typography

| Use | Font | Size and weight |
|---|---|---|
| Page title | Instrument Sans | 28px / 600 |
| Panel heading | Instrument Sans | 16px / 600 |
| Body and table text | Instrument Sans | 14px / 400 |
| Labels and captions | Instrument Sans | 12px / 500, Muted ink |
| Money, percentages, counts and dates | JetBrains Mono | 13–14px / 500, tabular figures |
| Big dashboard figures | JetBrains Mono | 28–32px / 600 |
| Dashboard greeting | Instrument Serif | 34px italic, white on Midnight |
| Empty-state line | Instrument Serif | 20px italic |
| Initials on the user menu button | Instrument Sans | 13px / 600, white on Midnight |
| Sign-in tagline | Instrument Serif | 20px italic, Muted ink |

Fonts are bundled from `@fontsource/instrument-sans`, `@fontsource/instrument-serif` and `@fontsource/jetbrains-mono`.

#### Color tokens

All colors are CSS custom properties in one tokens file (`frontend/src/styles/tokens.css`), and components, styles and charts use only tokens: there's no hex or `rgba()` color anywhere else, and no per-component dark-mode rule. The light values sit on `:root`, and dark mode redefines the tokens that change under `:root[data-theme="dark"]` (R92). Text contrast is given against the panel color of each mode: white in light mode, black in dark mode. Every text color meets at least 4.5:1 against every surface it's used on (NFR-7).

**Tokens that change with the mode:**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--page` | `#F0F4F5` | `#04232E` | Page background |
| `--panel` | `#FFFFFF` | `#000000` | Panels, cards, tables, the top bar, form fields |
| `--raised` | `#FFFFFF` | `#0E3240` (text 5.1:1 or more; 1.55:1 against `--panel`) | What floats above panels: row menus, side panels, the delete dialog, chart tooltips and a lifted pipeline card. In dark mode a black menu on a black table would lose its edge, because shadows don't show on black. |
| `--ink` | `#073B4C` Midnight (12.1:1) | `#CDD8DB` Sea Mist (14.4:1) | Main text |
| `--ink-muted` | `#5B7A85` (4.6:1) | `#8AA3AC` (7.9:1; 6.2:1 on the page) | Secondary text. On white only in light mode; on the panel or the page in dark mode. |
| `--sea-green-text` | `#047857` (5.5:1) | `#5EEBC4` (14.2:1) | Sea Green as text |
| `--marigold-text` | `#8A5A00` (5.9:1) | `#FFD27A` (14.8:1) | Marigold as text |
| `--coral-text` | `#B54A2A` (5.3:1) | `#FFA98F` (11.3:1) | Coral as text |
| `--cerulean-text` | `#0E7194` (5.5:1) | `#5BC0E3` (10.1:1) | Links and information text |
| `--raspberry-text` | `#D12E57` (5.0:1) | `#FF7A98` (8.5:1) | Late dates and errors |
| `--tint` | `#E6EDEF` | `#0B2A35` | Inner dividers, neutral backgrounds, chart gridlines on panels, the won and lost chart's cursor |
| `--cerulean-tint` | `#E3F1F6` | `#0A3443` | Behind timeline icons, which are in `--cerulean-text` (6.4:1 in dark mode) |
| `--drop-fill` | `rgba(255,255,255,.5)` | `rgba(205,216,219,.08)` | The drop gap on the pipeline |
| `--overlay` | `rgba(7,59,76,.28)` | `rgba(0,0,0,.6)` | Behind side panels and dialogs |
| `--line` | `#CDD8DB` Sea Mist | `#62828E` (5.1:1; 3.3:1 on `--raised`; 4.0:1 on the page) | Form field outlines, the dashed "Add deal" buttons and the drop gap on the pipeline. In dark mode it's at least 3:1 on every surface it sits on (the panel, the raised surface of side panels and dialogs, and the page), as a control's edge, and quieter than Sea Mist on black. |
| `--shadow` | `0 1px 2px rgba(7,59,76,.06), 0 4px 16px rgba(7,59,76,.04)` | `0 1px 2px rgba(0,0,0,.5), 0 4px 16px rgba(0,0,0,.4)` | Panels and secondary buttons |
| `--shadow-lift` | `0 2px 4px rgba(7,59,76,.08), 0 12px 32px rgba(7,59,76,.14)` | `0 2px 4px rgba(0,0,0,.6), 0 12px 32px rgba(0,0,0,.5)` | A lifted card, side panels, menus |
| `--focus-ring` | `0 0 0 3px rgba(17,138,178,.45)` | `0 0 0 3px rgba(91,192,227,.6)` | Keyboard focus |

**Tokens that are the same in both modes** (fills, and the colors that sit on fills):

| Token | Value | Use |
|---|---|---|
| `--midnight` | `#073B4C` | The hero panel, the active tab, the selected segmented button, the wordmark square, the revenue chart's dots, and text on light fills (8.3:1 on Sea Mist) |
| `--on-fill` | `#FFFFFF` | Text on Midnight, Cerulean, Raspberry and their strong fills |
| `--sea-green` | `#06D6A0` | Primary fills and buttons, with Midnight text |
| `--marigold` | `#FFC145` | Fills, with Midnight text |
| `--coral` | `#F78C6B` | Fills, with Midnight text |
| `--cerulean` | `#118AB2` | Information fills, with bold white text |
| `--cerulean-strong` | `#0E7194` | Fill under small white text (5.5:1), such as Qualified badges |
| `--raspberry` | `#EF476F` | Late and alert fills, with bold white text |
| `--raspberry-strong` | `#D12E57` | Fill under small white text (5.0:1), such as Late and Lost badges |
| `--sea-mist` | `#CDD8DB` | New stage and neutral fills, and text on Midnight |
| `--hero-grid` | `#0F4C60` | Gridlines in the hero chart |

- **Stage colors:** New Sea Mist, Qualified Cerulean, Proposal Marigold, Negotiation Coral, Won Sea Green, Lost Raspberry, in both modes.
- **Contact status:** Lead Sea Mist, Qualified Cerulean, Customer Sea Green, in both modes.
- White text on Cerulean or Raspberry is used only for bold text of 14px or more. Anything smaller with white text, such as badges, uses `--cerulean-strong` (5.5:1) or `--raspberry-strong` (5.0:1) as its fill instead (ADR-017). A fill never uses a `-text` token, because those change with the mode (ADR-019).
- Text on a fill is Midnight (`--midnight`) or white (`--on-fill`), never `--ink`, so badges, buttons and pills read the same in both modes.
- The only gradient is the faint Sea Green fill under the revenue line.

#### Components

- **Buttons:** primary is a Sea Green fill with Midnight text, 8px corners and 36px high. Secondary is the raised color (`--raised`: white in light mode, so a dark-mode button keeps its edge on a black panel) with a soft shadow. Focused, it shows the focus ring on top of its shadow. Destructive is a Raspberry fill with bold white text, used only in delete dialogs.
- **Badges:** pill shaped, 12px/600. New, Proposal, Negotiation, Won, Lead and Customer badges are filled with their stage or status color, with Midnight text. Qualified (stage and status) badges are filled with `--cerulean-strong`, and Late and Lost badges with `--raspberry-strong`, both with white text (ADR-017).
- **User menu:** a 36px round button at the end of the top bar, filled Midnight (`--midnight`) with the initials in white (`--on-fill`) in both modes, showing the focus ring when focused. Its menu opens below it, lined up with its right edge: 260px wide on the raised surface (`--raised`, `--shadow-lift`, 12px corners). It holds the name (14px/600, `--ink`) and email (12px/500, Muted ink), a divider in `--tint`, the label "Theme" over a segmented control (Light, Dark, System; the selected one a Midnight pill with white text, like the contact status filter), another divider, and "Sign out" as a menu item (R106, R90).
- **Search box:** 240px wide (180px below 1280px), 36px high, on `--panel` with a `--line` outline and 8px corners, a 16px search icon (lucide-react, already a dependency) and the placeholder in Muted ink. Results open below it in a 420px panel on the raised surface: group headings in 12px/500 Muted ink, rows 40px high, the highlighted row in the page color (`--page`), and stage badges as elsewhere (R122).
- **Tables:** header row in 12px/500 Muted ink, rows 48px high, a row hover in the page color (`--page`), and numbers right-aligned in JetBrains Mono.
- **Pipeline cards:** white, 10px corners and 12px padding. A 30px rounded square with the organization's initials sits beside the name (14px/600) and "organization · contact" in Muted ink. Below them come the value and the date or Late badge, then a 5px probability meter in the stage color with the percentage. "Add deal" is a dashed outline button at the top of each open column. A dragged card lifts with a larger shadow, and the drop gap is a dashed placeholder in the line color (`--line`, Sea Mist in light mode).
- **Closed rows:** white and 10px corners. Each is one line: the name (shortened with an ellipsis) and organization on the left, the short value and date on the right.
- **Timeline:** round icons. Note, call and email use Cerulean on a light tint, and stage changes use the destination stage's color.

#### Sign-in screen

- The page background with one panel (`--panel`) 400px wide in the middle of the window: 12px corners, the soft shadow and 32px padding. There's no top bar.
- In the panel, top to bottom: the wordmark, the title "Sign in" (Instrument Sans 28px/600), the Email and Password fields with their labels above them, the primary button "Sign in" (Sea Green with Midnight text, full width), the error line in `--raspberry-text` when there is one (R103), and "Ask whoever runs Accountable for your team to add you." in 12px Muted ink (R104).
- Below the panel, the tagline "Your sales, in one place." in Instrument Serif 20px italic, Muted ink.
- It uses the saved theme (R92), so it's dark when the app is.

#### Dashboard layout (12-column grid)

1. **Hero panel**, full width: Midnight with 16px corners. On the left (360px) are the greeting (R79), the date, the summary line, and the four figures (R70) in a 2 × 2 grid. They're in white JetBrains Mono with Sea Mist labels, and won this month is in Sea Green. On the right is the revenue line chart (R71), with Sea Mist axis text and `#0F4C60` gridlines.
2. Funnel (R74), 5 columns; won and lost bars (R72), 4 columns; donut (R73), 3 columns.
3. Follow-ups (R76), 6 columns; recent activity (R75), 6 columns.

Charts have no borders, their text is Instrument Sans 12px, and their tooltips sit on the raised surface (`--raised`, with `--shadow`). All tooltip text is `--ink`, including each item's line: not the series color, which Recharts uses by default and which is a fill too light for text on white. Every chart color, including axis text, gridlines, dots and tooltips, is a token, so charts follow the mode with no chart-specific dark rule.

#### Dark mode

Dark mode is the same layout, type, spacing and components as light mode, with the dark token values above. Following the brand:

- The page is `#04232E` and panels and cards are black (`#000000`), rounded with no outline. That includes the top bar, tables, pipeline cards, closed rows, form fields, and messages such as the board's error message. The "Can't reach Accountable" banner keeps its Raspberry fill.
- What floats above panels (row menus, side panels, the delete dialog, chart tooltips and a lifted pipeline card) is on `--raised` (`#0E3240`), so it keeps its edge against black. Form fields inside them stay black, with their `--line` outline.
- Main text is Sea Mist, and Sea Green, Marigold, Coral, Cerulean and Raspberry text use their lighter dark-mode `-text` values.
- The hero panel stays Midnight (`--midnight`), with the same white figures, Sea Mist labels, Sea Green line and `#0F4C60` gridlines as in light mode.
- The active tab and the selected segmented buttons (the contact status filter and the theme choice) stay Midnight pills with white text, the user menu button stays Midnight with white initials, and the wordmark keeps its Midnight square and Sea Green "A".
- Fills (buttons, badges, stage colors, probability meters, the donut, the funnel and the chart bars) keep their light-mode colors and their Midnight or white text.
- The page tells the browser it's dark (`color-scheme: dark`), so scrollbars, date pickers and other native controls are dark too.

### 3.10 Light and dark mode

- **R90 Theme choice:** the user menu (R106), on every page and section, has a Theme choice of Light, Dark and System (section 3.9 Components). Choosing one, by clicking it or with the arrow keys and Enter or Space, changes the mode at once, with no reload, and keeps the page, its scroll position, and what's typed in its forms. The menu stays open, so the change can be seen. The dark mode button that used to be in the top bar is gone.
- **R91 Default:** Light is the default. The app starts in light mode the first time, and whenever no valid choice is saved *[Assumption: the default stays Light rather than System, so a first visit looks as it did before]*.
- **R92 Remembered:** the choice is saved in the browser's `localStorage` under `accountable.theme`, as `light`, `dark` or `system`, and the mode in use is applied as `data-theme="dark"` on the `<html>` element (no attribute means light). It's applied before the page first paints, System included, so a reload in dark mode never flashes light. It's kept after a reload, a restart of the app, a restart of the browser and signing out. It's per browser, not per person: another browser, or a private window, starts in light mode, and someone else signing in on the same browser keeps it (ADR-018). Nothing about the mode is sent to the backend or stored in the database.
- **R93 Storage not available:** if `localStorage` can't be read or written (for example, it's blocked), the app starts in light mode, the theme choice still changes the mode for the rest of the visit, and nothing is written to the console.
- **R94 Light mode unchanged:** in light mode every screen looks exactly as it did before dark mode was added, apart from the top bar, which now has the search box and the user menu button where the dark mode button was, and two fixes the product owner approved on 26 Nov 2026: a focused secondary button now shows the focus ring, and chart tooltip items are in Midnight ink instead of their series' Sea Green or Sea Mist (1.9:1 and 1.5:1 on white before).
- **R95 Everything follows the mode:** every page, panel, table, form, side panel, dialog, menu, chart, tooltip, empty state, banner and error message uses the current mode's tokens. Changing mode changes them all at once.
- **R96 System:** with System chosen, the mode follows the device's light or dark setting (`prefers-color-scheme`). When the device changes it, the app follows at once, with no reload, keeping the page, its scroll position and what's typed. When the browser doesn't say, System means light.

#### Writing

- Short labels in plain business English, such as "Add deal", "Log activity" and "Mark done". No exclamation marks.
- Money always shows its currency: `$12,500` in tables and cards, and `$1.2M` for large figures. Column headings say "Value (USD)".
- Dates appear as `12 Nov 2026` in tables and `12 Nov 2026, 14:30` in timelines, with "Today" and "Yesterday" for recent ones.
- Errors say what happened and what to do, for example "Couldn't save the deal. Check the app is still running and try again."
