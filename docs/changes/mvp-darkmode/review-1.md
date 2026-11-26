# Review 1: dark mode

The first independent review of the change (REVIEW.md), on 26 Nov 2026, by a fresh agent that hadn't written it. It was run on the uncommitted working tree after phase 8, and saved here afterwards, word for word, when REVIEW.md 12 began asking for it. At that time the change folder was still called `docs/changes/dark-mode/`, which is what REV-002 is about. Every finding is now fixed (see `review-2.md` and `docs/build_logs.log`).

---

# Review report: dark mode

## A. Summary

- **Branch and base.** The branch checked out is **`mvp-darkmode`**, not `dark-mode` (see REV-002). The change folder is `docs/changes/dark-mode/`. The stated base is `main`, but `main` (`b6c6aaf`) contains neither the MVP nor the harness. `git diff main` covers 222 files and about 34,500 lines, almost all of it the MVP and `build-mvp-harness`. The dark-mode change itself starts after `3cdd783` (the tip of `build-mvp-harness`), so I reviewed `3cdd783`..working tree plus the untracked files.
- **The change isn't fully committed.** Phases 1–3 are in commits `ead0cb4`, `31de085`, `15e1f61` and `d83e41b`. Phases 4–8 are only in the working tree: modified `global.css`, `tokens.css`, `tokens.test.ts`, `TopBar.tsx`, `RevenueChart.tsx`, `keyboard.spec.ts`, `dark-mode.spec.ts` and the docs, plus the untracked `ThemeToggle.tsx`, `ThemeToggle.test.tsx`, `e2e/theme.spec.ts`, the four screenshots and `docs/evidence/2026-11-26-dark-mode/`. The merge criterion that `npm run check` and `npm run audit` are "run on the commit being merged" (REVIEW.md 14) therefore can't be met yet. My runs were on an uncommitted working tree.
- **Files reviewed:**
  - code: `frontend/index.html`, `frontend/src/lib/theme.ts`, `components/ThemeToggle.tsx`, `components/TopBar.tsx`, `styles/tokens.css`, `styles/global.css` (diff and the rules it touches), `pages/dashboard/RevenueChart.tsx`, plus `WonLostChart.tsx`, `StageDonut.tsx`, `FunnelPanel.tsx` and `Button.tsx` for context
  - tests: `lib/theme.test.ts`, `ThemeToggle.test.tsx`, `styles/tokens.test.ts`, `e2e/theme.spec.ts`, `e2e/keyboard.spec.ts` (diff), `e2e/visual/dark-mode.spec.ts`
  - config and docs: `playwright.config.ts`, `.gitattributes`, `docs/spec.md` (diff), `docs/STATUS.md` (diff)
- **Related spec and plan sections:** spec 1.3, 3.9 (Color tokens, Components, Dashboard, Dark mode), 3.10 R90–R95, 4.5, NFR-7, R7, ENG-1, V-F11, V-E11, V-E13, V-M04, ADR-017 to ADR-019 and 17.1. Plan sections 1–4, including the 4.5 requirement-to-code-and-test map.
- **Evidence inspected:**
  - `intent.md` and `plan.md`
  - the dark-mode entries in `docs/build_logs.log` (T3–T7)
  - `docs/STATUS.md`
  - `dashboard-dark.png`, looked at by eye
  - the existence of `docs/evidence/2026-11-26-dark-mode/npm-run-check.txt`. I relied on my own runs, not on that file.
  - The spec-reference mockups weren't compared, because dark mode has no mockup (ADR-019: approved by eye).
- **Overall status:** the code is small and mostly well built, and every automated check passes. There is one real functional defect in R93 (blocked storage), and an AGENTS.md rule is broken by the branch name. **CHANGES REQUIRED.**

### Requirement to code and test (plan 4.5)

Every row maps to code and a test. The gaps:

- **R93:** the case where reading `window.localStorage` itself throws is neither handled nor tested (REV-001).
- **R94:** the proof covers six screens at 1440px only (REV-007).
- **NFR-7:** the tests don't check two pairs that are actually used: field outlines on `--raised` (REV-003) and chart tooltip item text (REV-004).

Tests are named by requirement ID (ENG-7).

### What I checked and found sound

- **The inline script and `theme.ts` agree:** same key, the same exact `=== "dark"` test, the same attribute.
- **Security:** the inline script is a static literal with no user data and no CSP to break. Nothing in it touches SEC-1 to SEC-9: no new network calls, no `dangerouslySetInnerHTML`, no backend change.
- **ENG-1 holds:**
  - the only `data-theme` selector is in `tokens.css:67`
  - there are no dark-only component rules
  - there are no literal colors outside `tokens.css`, and the scan test is real (it reads files through `fs` and checks they're non-empty)
- **Light mode really is unchanged at the token level.** Every new light value equals the value it replaced: `--midnight` equals the old `--ink`, the `-strong` tokens equal the old `-text` values, and `--raised`, `--line` and `--overlay` equal the old panel, sea-mist and literal values. The new declarations (`.btn-primary` color, `.card.lift` and `.closed.lift` background) resolve to the same light colors.
- **Every contrast figure in spec 3.9 and `tokens.css` is correct.** I recomputed them all. For example, dark `--ink` is 14.44 on the panel, `--ink-muted` is 7.92 on the panel and 6.16 on the page, `--raised` text is at least 5.11, `--line` is 4.08 and 3.17, and Midnight on Sea Mist is 8.30.
- **`KNOWN_LIGHT_GAPS` is an exact-match assertion, not a weakening.**
- **V-E11 is stricter than before:** it now requires the ring color rather than any shadow. Its two new allowances (a highlighted menu item, and Chrome's own date-picker button) are narrow and written into V-E11 in the spec.
- **The visual test's style override** affects only the toggle and the approved focus-ring rule, and the mask covers the same box as the baselines.

## B. Findings

```
REV-001  P1  Functional / Reliability
Location: frontend/src/lib/theme.ts:10 and :19; frontend/src/components/ThemeToggle.tsx:16-21
Issue: readTheme and saveTheme take `storage = globalThis.localStorage` as a default parameter. Default
  parameters are evaluated before the function body, so they're outside the try/catch. When the browser
  blocks site data, reading the `window.localStorage` property throws a SecurityError (Chrome: "Failed to
  read the 'localStorage' property from 'Window': Access is denied"). saveTheme then throws.
  In ThemeToggle.toggle(), applyTheme(next) has already run, saveTheme(next) throws, and setTheme(next) is
  never reached. The page turns dark, but aria-pressed stays false and the icon stays a moon. The error
  escapes a React event handler, so it reaches the console. Every later click computes next = "dark"
  again, because `dark` is still false, so the user can't get back to light mode for the rest of the visit.
Evidence: I reproduced the functions' semantics in Node with a throwing localStorage getter
  (scratchpad r93.mjs). Both readTheme() and saveTheme("dark") threw. The index.html inline script reads
  the property inside its try, and correctly fell back to light.
  The tests miss this case:
  - theme.test.ts:85-92 passes a `blocked` object whose methods throw, not one whose property access throws.
  - ThemeToggle.test.tsx:51 spies on Storage.prototype.setItem.
  - V-E13 doesn't cover R93.
Impact: breaks R93 ("the toggle still switches mode for the rest of the visit, and nothing is written to
  the console") and R7, in exactly the case R93 names ("for example, it's blocked"). The toggle gets stuck.
Recommendation: read globalThis.localStorage inside the try, for example
  `function saveTheme(theme, storage?) { try { (storage ?? globalThis.localStorage).setItem(...) } catch {} }`,
  and the same for readTheme. Consider calling setTheme before saveTheme. Add unit tests that redefine
  `window.localStorage` with a throwing getter (Object.defineProperty) for readTheme, saveTheme and
  ThemeToggle, and ideally an e2e case that overrides the getter with addInitScript. Separately, readTheme
  is exported and tested but has no caller in the app; only the inline copy reads at start-up. Keep it as
  the documented twin of the inline script, or drop it.
Requirement: R93, R7 (V-F11)
Disposition: Open
```

```
REV-002  P1  Process (AGENTS.md)
Location: git branch `mvp-darkmode` (local and origin/mvp-darkmode); docs/changes/dark-mode/intent.md, "Decisions"
Issue: AGENTS.md says each change folder is "named after its git branch", and that agents find the current
  change from `git branch --show-current`. The intent records the decision "The change's branch is
  `dark-mode`, matching this folder (renamed from `mvp-darkmode`)", but the rename was never done.
  `git branch --show-current` prints `mvp-darkmode`, there's no `dark-mode` branch locally or on origin,
  and `docs/changes/mvp-darkmode/` doesn't exist.
Evidence: `git branch -a` lists `* mvp-darkmode` and `remotes/origin/mvp-darkmode`, and no `dark-mode`.
Impact: an agent following AGENTS.md on this branch finds no change folder (no intent, no plan). The
  approved intent's own decision isn't reflected.
Recommendation: the engineer renames the branch (`git branch -m mvp-darkmode dark-mode`, then pushes the new
  name). Also decide the merge base: the change sits on build-mvp-harness (3cdd783), which isn't in main.
Requirement: AGENTS.md "Where to find things" and "Working on a change"; spec 1.5
Disposition: Open
```

```
REV-003  P2  Accessibility / Testing
Location: frontend/src/styles/tokens.css:83; frontend/src/styles/tokens.test.ts:119-124; docs/spec.md:280, :330
Issue: in dark mode, form fields inside side panels sit on --raised (#0E3240), and spec 3.9 says they "stay
  black, with their --line outline". The --line outline (#527280) is 2.63:1 against --raised. Spec line
  280 says --line is "at least 3:1, as a control's edge" in dark mode, but it quotes only the panel (4.1:1)
  and page (3.2:1) figures. The test checks only --panel and --page, though the most common place for
  form fields is a side panel (Add deal, Add or Edit contact and organization). The field's black fill is
  only 1.55:1 against --raised, so the outline carries the field's edge on its own.
Evidence: computed contrast(#527280, #0E3240) = 2.63.
Impact: the spec's own non-text contrast rule isn't met where most forms appear, and no test would notice.
Recommendation: add --raised to the --line surfaces in the test. Then either choose a --line value that
  reaches 3:1 on #0E3240 as well (the product owner approved the palette, so it needs their eye) or state
  the exception in spec 3.9 and 17.1.
Requirement: NFR-7, spec 3.9 (--line), V-F11
Disposition: Open
```

```
REV-004  P2  Functional (spec vs code)
Location: frontend/src/pages/dashboard/RevenueChart.tsx:39-43; WonLostChart.tsx:47; docs/spec.md:323
Issue: spec 3.9 now says chart tooltips have "--ink text" and that every text color meets 4.5:1 on its
  surface. Neither Tooltip sets itemStyle, so Recharts colors each item line with the series color
  (node_modules/recharts/lib/component/DefaultTooltipContent.js:141-142, `color: entry.color`). The
  revenue item is Sea Green, the won/lost items are Sea Green and Sea Mist.
  - Light mode: Sea Green on white is 1.89:1 and Sea Mist on white is 1.45:1.
  - Dark mode: 7.19:1 and 9.32:1 on --raised, which is fine.
  The plan's phase 5 risk row said a Recharts default color would be set to a token in its props. These
  are tokens, but fill tokens used as text.
Evidence: library source; the code has no itemStyle prop; spec 17.1 lists only the Raspberry hover gap;
  V-E13 (theme.spec.ts:72) checks only the tooltip's background, and tokens.test.ts doesn't cover tooltips.
Impact: the spec says something the code contradicts. The light-mode part predates the change, but the
  change wrote the claim.
Recommendation: either set `itemStyle={{ color: "var(--ink)" }}` (a light-mode change, so it needs the
  product owner's approval under R94), or record the light-mode tooltip gap in spec 17.1 and docs/STATUS.md.
Requirement: NFR-7, spec 3.9 Dashboard, R94
Disposition: Open
```

```
REV-005  P2  Docs
Location: docs/spec.md 17.1 (the NFR-7 light-mode bullet); frontend/src/styles/global.css:431-437, :601-606;
  docs/STATUS.md (2026-11-26 bullets)
Issue: 17.1 describes the 4.47:1 gap as "a late date in Raspberry on a hovered table row". The same pair,
  --raspberry-text on --page, is also used:
  - by .form-error (global.css:431-437), always and not only on hover, so every form's error message in
    light mode is at 4.47:1
  - by the highlighted destructive menu item (.menu-item.destructive on [data-highlighted], 601-606)
  Separately, STATUS.md still says "Found along the way ... secondary buttons show no focus ring ... (spec
  17.1). The toggle has its own fix". 17.1 no longer lists that gap, and the toggle-only rule was replaced
  by the .btn-secondary rule.
Evidence: the CSS rules cited; the 17.1 text; the STATUS.md diff.
Impact: the known-gaps list understates where the shortfall shows, and STATUS describes a fix that no
  longer exists.
Recommendation: widen the 17.1 bullet to name the form error message and the destructive menu item. Make
  the STATUS bullet say the focus gap was later fixed for every secondary button.
Requirement: NFR-7, spec 17.1, REVIEW.md 7 (docs updated)
Disposition: Open
```

```
REV-006  P2  Testing
Location: frontend/src/styles/tokens.test.ts:115, :119, :126 (and :33)
Issue: the three dark-mode checks run under `it.skipIf(DARK_OVERRIDES === undefined)`. That guard made
  sense before phase 3, but the dark block now exists. block() finds it by the exact string
  `:root[data-theme="dark"] {`. If Prettier or a person changes the quotes, adds a selector to the list
  or changes the spacing, block() returns undefined. The dark contrast, --line and "only known tokens"
  checks then skip silently, and the suite stays green.
Evidence: the code as cited. Skipped tests don't fail `npm test` or the coverage gate.
Impact: the code could be wrong (any dark value) while every test passes. This is the only automated proof
  of NFR-7 in dark mode.
Recommendation: replace skipIf with an explicit `expect(DARK_OVERRIDES).toBeDefined()` (and a non-empty
  check), and run the dark checks unconditionally.
Requirement: NFR-7 (dark), ENG-1, V-F11
Disposition: Open
```

```
REV-007  P2  Testing (R94 proof coverage)
Location: e2e/visual/dark-mode.spec.ts:25-37; scripts/run-tests.mjs (visual suite outside npm test)
Issue: R94 ("every screen looks exactly as before") is proven by six baselines at 1440px, with
  .topbar-right masked. These aren't compared:
  - the Add deal button area: .topbar-right became a flex row, and .btn-primary gained an explicit color
  - the top bar at 1024px or 1280px with the extra 44px toggle
  - the contacts and organizations tables, contact and organization pages, empty states, the offline
    banner, timeline stage icons, a lifted card, and form error states
  The suite also isn't part of `npm run check`, so nothing gates R94 at merge. Running the full visual
  suite also rewrites the four product-owner-approved screenshots in docs/changes/dark-mode/ (the V-M04
  tests write there unconditionally), so the evidence behind ADR-019 changes whenever the suite runs.
Evidence: the spec file as cited. I ran only the six R94 comparisons (`--grep R94`) to avoid overwriting
  those screenshots.
Impact: low in practice. I checked by hand that every light token value and every new declaration resolve
  to the old colors. Still, the R94 claim is stronger than its automated proof, and the approval evidence
  can be overwritten without anyone noticing.
Recommendation: add a 1024px top-bar baseline, or state the coverage limit in plan 4.3. Have the V-M04
  screenshot tests write to test-results/, or skip them unless a flag is set, so the approved images stay
  fixed. Note in the plan that R94 is checked by hand before merge.
Requirement: R94, V-M04
Disposition: Open
```

## C. Verification status

Run on the uncommitted working tree of `mvp-darkmode`, one at a time, in the foreground.

| Check | Command | Result |
|---|---|---|
| Quality gate | `npm run check` | **Passed**, exit 0, "All 12 checks passed". Backend 388 passed with 97.33% coverage. `rules.py` and `services/` 99.8% (479/480). Frontend 31 files and 249 tests passed, lines 98.44% (950/965). E2E 55 passed (2.3 min). Prettier, ESLint, tsc, ruff, ty and gitleaks (history and working tree) all passed. |
| Security | `npm run audit` | **Passed**, exit 0. npm audit found 0 vulnerabilities, and pip_audit found no known vulnerabilities. |
| Security cases | V-S cases inside `npm test` | **Passed** (part of the 388 backend and 55 e2e tests above) |
| Performance | `npm run test:perf` | **Passed**, 4 of 4. The worst figures, each against its threshold, are in the three rows below. |
| | NFR-1 navigation (500 ms) | worst p95 329 ms (Contacts); the worst single sample was 597 ms (Contact page), but the threshold applies to p95 |
| | NFR-2 API (300 ms for lists, 100 ms for other calls) | worst list p95 87 ms (activities, 10,000 rows); other calls 4 ms or less |
| | NFR-3 search and sort (100 ms) | worst p95 61 ms |
| R94 light-mode comparison (extra) | `node scripts/run-tests.mjs visual dark-mode --grep R94` | **Passed**, 6 of 6 at threshold 0 |
| V-M04 screenshots and dark palette by eye | the full visual suite and the product owner's review | **Not run** by me. I didn't run the full suite, because it would overwrite the approved screenshots. I looked at `dashboard-dark.png` only. The product owner's approval is recorded only in the agent-written build log, `spec.md` and `STATUS.md`. |
| Phase 5 walkthrough | by hand | **Couldn't be verified.** The throwaway test that did it was deleted, so only the build log describes it. |
| Run on the commit being merged | REVIEW.md 14 | **Can't be met yet**: phases 4–8 are uncommitted |

The runs left no new untracked files: `git status --short --untracked-files=all` was identical before and after.

## D. Outstanding risks

- **Uncommitted work:** the gate and the audit must be rerun on the final commit.
- **Merge base:** `main` doesn't contain the MVP or the harness. A merge into `main` from this branch brings in about 34,000 lines that this review didn't cover. The engineer should decide the target (probably `build-mvp-harness` first) before approving.
- **Branch name (REV-002):** until it's fixed, agent sessions on this branch can't find the change folder.
- **Weak focus indicator for menu items:** focus shows as a background change of 1.11:1 in light mode and 1.21:1 in dark mode (`--page` on `--raised`). V-E11 now explicitly counts this as visible. It predates the change, but NFR-7 now says focus is visible in both modes.
- **Unverified layout:** the top bar's layout at 1024px with the toggle wasn't checked. `layout.spec` only checks there's no horizontal scroll.
- **Two tabs:** the second tab not syncing is a recorded *[Assumption]* (spec 4.5). It isn't a defect.

## E. Decision

**CHANGES REQUIRED.** REV-001 (P1: R93 defect, the toggle sticks in dark mode and logs an error when storage is blocked) and REV-002 (P1: the AGENTS.md branch and folder rule) are open, and the change isn't committed, so the merge criteria can't be met yet. REV-003 to REV-007 are P2: fix them or track them in `docs/STATUS.md`. This decision is a recommendation; only the engineer approves a merge.
