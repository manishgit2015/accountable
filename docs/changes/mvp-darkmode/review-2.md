# Review 2: re-review of dark mode

The second independent review of the change (REVIEW.md 12, step 9), on 26 Nov 2026, by a fresh agent, on commit `2c0841d` with a clean working tree. It was saved here afterwards, word for word, when REVIEW.md 12 began asking for it. REV-008 to REV-012 have since been fixed, and the product owner approved the retaken screenshots (see `docs/build_logs.log`).

---

# Independent re-review: `mvp-darkmode` (dark mode)

## A. Summary

- **Branch:** `mvp-darkmode`, HEAD `2c0841d`. The working tree was clean before and after every run (`git status --short` printed nothing).
- **Base reviewed:** `3cdd783..HEAD`, the tip of `build-mvp-harness` to HEAD, as instructed. That is 6 commits (`0d0a1ff`, `ead0cb4`, `31de085`, `15e1f61`, `d83e41b`, `2c0841d`) touching 33 files.
- **Files reviewed in full:**
  - `frontend/index.html`
  - `frontend/src/lib/theme.ts` and `theme.test.ts`
  - `frontend/src/components/ThemeToggle.tsx`, `ThemeToggle.test.tsx` and `TopBar.tsx`
  - `frontend/src/test/storage.ts`
  - `frontend/src/styles/tokens.css`, `tokens.test.ts` and `global.css` (the diff, plus the surrounding rules)
  - `RevenueChart.tsx` and `WonLostChart.tsx`
  - `e2e/theme.spec.ts`, `e2e/keyboard.spec.ts` and `e2e/visual/dark-mode.spec.ts`
  - `playwright.config.ts` and `.gitattributes`
  - the diffs of `docs/spec.md` and `docs/STATUS.md`
  - `docs/changes/mvp-darkmode/intent.md` and `plan.md`, and the four screenshots
  - the dark-mode and mvp-darkmode entries in `docs/build_logs.log`
  - `docs/evidence/2026-11-26-dark-mode/npm-run-check.txt`
- **Against `main`:** `main` is not an ancestor. The merge-base is `b6c6aaf`, and `build-mvp-harness` has 42 commits that aren't on `main`.
  - `git diff main...HEAD` is 231 files, +35,645/−70.
  - Of that, 209 files and +33,409 lines are the MVP and harness (`git diff main...3cdd783`). Dark mode is the remaining ~2,300 lines.
  - Merging this branch into `main` as it stands would also merge the whole MVP and harness. Either `build-mvp-harness` is merged first, or the PR targets `build-mvp-harness`. That decision is the engineer's, and STATUS.md already lists it as open.
- **Spec and plan sections:**
  - spec 1.3, 3.9 (tokens, Components, Dark mode), 3.10 (R90–R95), 4.5, NFR-7, R7, V-F11, V-E11, V-E13, V-M04, DEP-2, ENG-1, ADR-017 to ADR-019 and 17.1
  - plan 1–4. The requirement-to-code-and-test map is plan 4.5.
- **Overall:** all seven earlier findings are fixed, one of them only partly (table below). The gate, audit, performance and visual suites all pass on HEAD. The re-review found one new P1 and four new P2s. The P1 is that the toggle's icon renders 8px wide instead of 18px, because a CSS rule-order problem cancels the toggle's `padding: 0`.

### Earlier findings

| ID | Sev | Disposition | Evidence checked |
|---|---|---|---|
| REV-001 | P1 | **Fixed** | `theme.ts:316-336`: storage is read in `browserStorage()` inside each `try`. `ThemeToggle.tsx:16-21` applies the mode and sets state before saving, and `saveTheme` can't throw. The inline script in `index.html:22-26` reads bare `localStorage` inside its `try`. Tests make the `window.localStorage` getter itself throw or be missing: `test/storage.ts`, `theme.test.ts:243-251,272-275`, `ThemeToggle.test.tsx:103-117`, and V-E13 step 7 (`e2e/theme.spec.ts:176-198`, via `addInitScript`, which also exercises the inline script). All pass in my run. |
| REV-002 | P1 | **Fixed** | The branch is `mvp-darkmode` and the folder is `docs/changes/mvp-darkmode/`. `grep "changes/dark-mode"` outside `.git` and `node_modules` finds matches only in `course/` and the append-only `docs/build_logs.log`. The intent records the product owner's decision. |
| REV-003 | P2 | **Fixed** (approval pending, see REV-010) | Dark `--line` is `#62828e`. My own figures are 5.10:1 on the panel, 3.29:1 on `--raised` and 3.97:1 on the page, matching spec 3.9 line 280 and `tokens.css:697`. `tokens.test.ts:843-849` checks all three surfaces. |
| REV-004 | P2 | **Fixed** | `TOOLTIP_ITEM_STYLE` (`color: var(--ink)`) is on both tooltips (`RevenueChart.tsx:20,46`, `WonLostChart.tsx:49`). V-E13 step 8 checks the computed color of every tooltip item on both charts, in both modes. The light-mode change is recorded as an approved R94 exception (spec 3.10). The donut has no tooltip, so two charts is complete. |
| REV-005 | P2 | **Fixed** for spec 17.1 | Spec 17.1 (line 941) now names all three places where Raspberry sits on the page color. I confirmed them in `global.css`: `.form-error` at 431-437, `.menu-item[data-highlighted]` plus `.destructive` at 601-605, and the row hover at 543-544. Separately, STATUS.md has new stale lines (REV-011), and there is a second light gap that 17.1 still omits (REV-009). |
| REV-006 | P2 | **Fixed** | No `skipIf` remains. `darkTokens()` throws when the block is missing (`tokens.test.ts:746-749`), and a test asserts the block exists and holds the surface and ink tokens (`:832-837`). |
| REV-007 | P2 | **Partly fixed** | The overwrite is fixed. Approved copies are written only with `ACCOUNTABLE_SCREENSHOTS=1` (`dark-mode.spec.ts:91-93`, documented in DEP-2). I verified it: a routine `visual dark-mode` run left the md5 of all four approved PNGs unchanged and the tree clean. The breadth is unchanged: the automated R94 proof is still six screens at 1440px. Its limits are now stated in plan 4.3 and spec V-M04. The checks at 1024px and 1280px were done by eye with a throwaway test that was deleted, so they can't be re-run. The comparison also hides the toggle and masks `.topbar-right`, which is why REV-008 went unnoticed. |

## B. Findings

```
REV-008  P1  Functional
Location: frontend/src/styles/global.css:130-134 (.theme-toggle) and 137-146 (.btn);
          frontend/src/components/ThemeToggle.tsx:25-26
Issue: The mode toggle's icon renders 8px wide instead of 18px. `.theme-toggle { padding: 0 }` comes
  before `.btn { padding: 0 14px }` in the stylesheet. Both selectors are a single class, so `.btn`'s
  padding wins. That leaves 36 - 28 = 8px of content width, and the 18px SVG shrinks into it (the
  viewBox scales it down to about 8x8).
Evidence: Measured in real Chrome (the Vite dev server on a spare port, HEAD code): the toggle box is
  36x36; the svg.lucide-moon has width="18" but getBoundingClientRect() is 8 x 18. The Plus icon in
  "Add deal" measures 16 x 16 as intended. A 4x crop of dashboard-dark.png and pipeline-light.png shows
  a tiny moon and sun in the button. Spec 3.9 Components (spec.md:311): "an 18px moon ... an 18px sun".
Impact: The one new control in this change doesn't match the spec, and its icon is barely recognizable
  in both modes. The product owner approved the palette from screenshots that show the shrunken icon.
  No test can catch it: ThemeToggle.test.tsx:26/33 only checks that the .lucide-moon or .lucide-sun
  element exists (jsdom has no layout), and the R94 visual comparison hides the toggle and masks its area.
Recommendation: Make the toggle's padding win, for example by moving the .theme-toggle rule after
  .btn/.btn-secondary or using `.btn.theme-toggle`. Add a V-E13 assertion that the toggle's svg box is
  18x18. Retake the four screenshots with ACCOUNTABLE_SCREENSHOTS=1 for the product owner.
Requirement: R90, spec 3.9 Components (Mode toggle)
Disposition: Open
```

```
REV-009  P2  Testing / Docs
Location: frontend/src/styles/tokens.test.ts:797-809 and 824 (KNOWN_LIGHT_GAPS); docs/spec.md:941 (17.1);
          global.css:874-877 (.col-head .val .e), 885-897 (.add), 1033-1038 (.month-note)
Issue: In light mode the token test checks --ink-muted only on --panel and --raised, because spec 3.9
  says muted ink is "on white only". The app also uses it directly on the page color in light mode, at
  4.15:1 by my computation (#5B7A85 on #F0F4F5). Examples: the "$4.5K expected" line under each pipeline
  column head, the dashed "Add deal" buttons (transparent, on the page) and "Closed in November", all
  visible in pipeline-light.png. The test still claims Raspberry is "the one known gap", and spec 17.1
  repeats that.
Evidence: The `.add` rule has `color: var(--ink-muted); background: transparent;` on the pipeline board,
  which has no background of its own (global.css:840-846), so the text sits on --page. The figures come
  from the same WCAG formula the test uses.
Impact: This predates the change and R94 keeps it. But the change's contrast proof and spec 17.1
  understate the light-mode gaps, which is the same shape as REV-005. Because the pair isn't in the
  list, a future regression in the pair won't fail the test.
Recommendation: Add [--ink-muted, --page] to the light pairs and pin it in KNOWN_LIGHT_GAPS at 4.15:1.
  Name the places it shows in spec 17.1, and track it in STATUS.md.
Requirement: NFR-7, spec 17.1
Disposition: Open
```

```
REV-010  P2  Process / Docs
Location: docs/spec.md:899 (ADR-019); docs/STATUS.md:126; docs/build_logs.log:1733-1734
Issue: The dark --line changed from #527280 to #62828E after the product owner approved the palette, and
  pipeline-dark.png was retaken. STATUS.md and the build log say the new value "needs the product owner's
  look", and nothing records that look. ADR-019 still says the palette was "Approved by the product owner
  on 26 Nov 2026, from the screenshots".
Evidence: The quoted lines. No later approval entry exists in build_logs.log, STATUS.md or intent.md.
Impact: The intent requires the product owner to approve the tokens from the screenshots. As written,
  the spec claims an approval that doesn't cover the shipped value. REV-008's fix will also change all
  four screenshots.
Recommendation: Get and record the product owner's approval of the final screenshots (after REV-008),
  or mark the --line value *[Unapproved]* in spec 3.9 until then. Add the item to STATUS.md "Next".
Requirement: ADR-019, intent constraint (palette approved from screenshots)
Disposition: Open
```

```
REV-011  P2  Docs
Location: docs/changes/mvp-darkmode/plan.md:3 and 210; docs/STATUS.md:69, 116 and 145-150
Issue: Several docs no longer match the committed state.
  - plan.md:3 says phases 4 to 8 are "not committed yet", and STATUS.md:116 says the same. Both are in 2c0841d.
  - The R93 row of plan 4.5 (line 210) leaves out V-E13 step 7, the end-to-end proof added for REV-001.
  - STATUS.md "For developers" (line 69) still describes `node scripts/run-tests.mjs visual` as only
    saving the mockup screenshots. It doesn't say the command now also runs the R94 light-mode
    comparison, which plan 4.3 says must be run by hand before merge because it's outside
    `npm run check`, or that ACCOUNTABLE_SCREENSHOTS=1 replaces the approved copies.
  - STATUS.md "Next" has no dark-mode items (the manual R94 run, the --line approval, the merge target).
Impact: The next session, or the engineer, can't tell from STATUS.md that a manual pre-merge check
  exists, and the plan misstates the commit state.
Recommendation: Update those lines.
Requirement: AGENTS.md ("Update docs/STATUS.md when you finish a piece of work"), REVIEW.md 7
Disposition: Open
```

```
REV-012  P2  Testing
Location: e2e/theme.spec.ts:105-122; docs/spec.md 3.10 R90
Issue: R90 says switching mode "keeps the page, its scroll position, and what's typed in its forms".
  V-E13 checks the URL and typed values, but no test checks scroll position.
Evidence: No `scrollY` or scroll assertion in e2e/theme.spec.ts or ThemeToggle.test.tsx.
Impact: Low today, since only <html data-theme> changes. But a stated acceptance clause has no test,
  and a later toggle that re-keys or remounts the app would pass every test.
Recommendation: In V-E13 step 4, scroll the deals table or pipeline, toggle, and assert window.scrollY
  is unchanged.
Requirement: R90
Disposition: Open
```

### Other checks, with no findings

- **Spec match:**
  - The ADR-018 storage key and values, and the `data-theme` attribute, match R92.
  - Invalid values mean light (R91).
  - R94's two approved exceptions are implemented: `.btn-secondary:focus-visible` at `global.css:162-164`, and the tooltip items. The visual spec neutralizes only the first one, which is correct, since the baselines have no tooltips.
  - The `color-scheme` setting is in both blocks.
  - DEP-2 now includes `ACCOUNTABLE_SCREENSHOTS`.
  - Spec 4.5's new edge cases are consistent with the code.
- **No literal colors:** no hex, rgb or hsl color appears outside `tokens.css`. The ENG-1 scan has a self-check and confirms it reads real file contents.
- **Contrast figures:** I recomputed every figure in `tokens.css:681-701` and spec 3.9 (14.4, 7.9/6.2, 14.2, 14.8, 11.3, 10.1, 8.5, 5.1 on `--raised`, 6.4 on `--cerulean-tint`, 1.55 raised-to-panel, 8.3 Midnight on Sea Mist, and `--line` 5.10/3.29/3.97). All are correct.
- **Pairs tested:** dark mode covers text on the panel, raised surface and page, plus the fill pairs. Text on `--tint` doesn't occur. The only untested pair in use is light-mode muted ink on the page (REV-009).
- **Assertions:**
  - V-E11 was tightened, not weakened. "Any shadow" no longer counts as a focus indicator. The two new allowances, a highlighted Radix menu item and Chrome's own date-field button, are narrow and documented in spec V-E11.
  - No existing assertion was relaxed.
  - New tests are named by requirement ID (R90–R94, NFR-7, ENG-1, V-M04). The one exception is the arithmetic sanity test.
- **Security, reliability and performance:** no backend, API, database or dependency change. The one new piece of inline script reads and writes only `data-theme`. There are no new network calls (V-E00 covers this).
- **`.gitattributes` (`* text=auto eol=lf`):** this is repo tooling that isn't in the plan's file table. It's harmless, and the tree is clean after checkout.

## C. Verification status

All runs were on HEAD `2c0841d` with a clean tree, one at a time in the foreground. `npm run check` was moved to the background by the tool after 180s, but nothing else ran until it finished.

| Check | Command | Result |
|---|---|---|
| Quality gate | `npm run check` | **Run and passed.** All 12 checks passed, exit 0. Backend: 388 passed. Frontend: 31 files, 253 tests passed, lines at 98.44%. `rules.py` and `services/`: 99.8% (479/480). e2e: 57 passed (2.3 min). The V-S cases are included. |
| Security | `npm run audit` | **Run and passed.** npm: 0 vulnerabilities. pip-audit: none known. |
| Performance | `npm run test:perf` | **Run and passed.** 4 of 4. NFR-1 p95: Dashboard 170 ms, Pipeline 130 ms, slowest page 225 ms (Organization page), threshold 500 ms. NFR-2 p95: largest list 107 ms (`/api/activities`, 10,000), dashboard 12 ms. NFR-3 p95 at most 49 ms. |
| R94 light-mode comparison and V-M04 screenshots | `node scripts/run-tests.mjs visual dark-mode` | **Run and passed.** 8 of 8. The md5 of all four approved PNGs was unchanged and `git status` was clean afterwards. |
| Toggle icon size (REV-008) | Vite dev server on port 5199, measured with Playwright in Chrome | **Run.** The SVG measures 8x18, against 18x18 in the spec. I stopped the server afterwards. |
| Leftover files | `git status --short` and `--ignored` | Nothing outside the git-ignored folders. My scripts and logs are only in the scratchpad. |

## D. Outstanding risks

- The automated R94 proof still covers six screens at 1440px only, with the toggle hidden. It isn't part of `npm run check`, so a light-mode regression elsewhere would pass the gate. This is the residue of REV-007, and it is how REV-008 escaped.
- The product owner hasn't approved the final dark `--line`, and will need to see the screenshots again after REV-008 is fixed (REV-010).
- The merge target: merging into `main` also brings in roughly 33,400 lines of the MVP and harness (`build-mvp-harness`). That's the engineer's call.
- Not verified by me: the phase 5 walkthrough by eye (empty states, the offline banner, date pickers in dark mode). I rely on the build log for those, and the tests only partly cover them.

## E. Decision

**CHANGES REQUIRED.** REV-008 (P1) is open. The fix is small (CSS rule order or specificity), followed by a test and retaken screenshots. Fixing REV-009 to REV-012 isn't required for the merge; they can be fixed or tracked in `docs/STATUS.md`. This decision is a recommendation, not an approval.
