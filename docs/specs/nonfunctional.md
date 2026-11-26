# Spec: Nonfunctional requirements

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Speed, the internet, start-up, portability, accessibility, usability, look, screen sizes, console, browsers and scalability. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

## 9. Nonfunctional requirements

| ID | Requirement | Measure |
|---|---|---|
| R6 / NFR-1 | Pages are quick at the target data volume | With 1,000 contacts, 500 deals and 5,000 activities, each page is usable within 500 ms of navigation on the test machine, at the 95th percentile of 20 loads. Measured as in-app navigation after the first load; the cold first load is recorded without a threshold (E-3). Measured locally on SQLite; the hosted app's speed depends on Render's free plan and Supabase, and is checked by hand without a threshold (V-M07). |
| NFR-2 | API speed | Lists and the dashboard answer within 300 ms, and other calls within 100 ms, at the 95th percentile at that volume |
| NFR-3 | Searching and sorting keep up | A key press in search, or a click on a heading, updates the table within 100 ms |
| NFR-4 / R2 | Internet | Accountable needs an internet connection, for Supabase. The only requests that leave the computer or the Render service at runtime go to Supabase (section 7.3). Fonts and icons are bundled. The tests run with no network (AC15). |
| NFR-5 | Start-up | After the first run, the address is printed within 15 seconds on the test machine. On Render, after a sleep, up to about a minute (REL-14). |
| NFR-6 / R1 | Portability | The same commands work on current Windows 11, macOS and Ubuntu LTS *[Assumption: these versions]* |
| NFR-7 | Accessibility, best effort | Every action can be done with the keyboard, including pipeline drags (R66), signing in, the user menu (R109) and the top-bar search (R123). Focus is always visible. Form fields have labels. Text meets the color rules in section 3.9 in both light and dark mode: at least 4.5:1 against every surface it's used on. Focus is visible in both modes. There's no formal standard. |
| NFR-8 | Usability | SC1: someone new answers the five questions in section 1.4 within a couple of clicks of the dashboard |
| NFR-9 | Look and feel | Section 3.9 and mockup 1. The product owner approves it (SC5). |
| R5 / NFR-10 | Screen sizes | Designed for 1280px and wider, and usable at 1024px with no horizontal page scroll |
| R7 / NFR-11 | Clean console | No errors in the browser console on any screen, in either mode |
| NFR-12 | Browsers | Current Chrome, Edge, Firefox and Safari *[Assumption]*. Automated tests use Chrome. |
| NFR-13 | Scalability | No design limit below 10 × the target volume. The performance test runs at 2 × as a safety margin. |
| NFR-14 | Team size | Up to 10 people signed in at once *[Assumption: a small team]* |
| NFR-15 | Unit test speed | Every unit test, old and new, runs in under 1 second on this computer, because CI runs on a much slower machine. The test runs fail any unit test that takes longer (V-U01). |
