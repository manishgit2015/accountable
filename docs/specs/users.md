# Spec: Sign-in, people and the user menu

Part of the Accountable spec: [`docs/spec.md`](../spec.md) has the summary and the index of every area file. Signing in and out, how a person is shown, the user menu, and who added and last changed each record. Section numbers and IDs are the same as in the whole spec, so a reference such as "section 3.9" or "R21" means the same thing in every file.

### 3.11 Sign-in and the user menu

- **R100 Sign-in screen:** anyone who isn't signed in sees only the sign-in screen, whatever address they open. It asks for an email and a password, and has one button, "Sign in". After signing in, the person lands on the page they asked for, or on the dashboard. The look is in section 3.9 (Sign-in screen).
- **R101 Everything needs sign-in:** every page and every API route needs a signed-in person, except `GET /api/health` (section 5.5), the sign-in screen itself and the files it needs to load. A request without a valid token is refused with 401 (section 5.2), and the app shows the sign-in screen.
- **R102 Supabase Auth:** signing in uses Supabase Auth with an email and password. The browser holds only the publishable key (`SUPABASE_PUBLISHABLE_KEY`), never a secret key. It sends the access token Supabase gives it with every API request, and keeps the session until the person signs out, renewing the token before it runs out. The backend checks the token on every request and takes the person from it (SEC-13, SEC-14).
- **R103 Wrong details:** a wrong email or password shows "Email or password is wrong. Check them and try again." under the form, keeps the email and clears the password. If Supabase can't be reached, it shows "Couldn't reach the sign-in service. Check your internet connection and try again."
- **R104 No sign-up or reset:** there's no sign-up page, no password reset, and no sign-in with Google or a magic link. People are added, removed and given new passwords in Supabase's dashboard. The sign-in screen says "Ask whoever runs Accountable for your team to add you."
- **R105 How a person is shown:** by their display name, the `name` in their Supabase user metadata, or by their email when no name is set. Their initials are the first letters of the first two words of the name, or the first letter of the email when there's no name, in capitals. This is how they appear on the user menu and as who added or changed a record (section 3.12).
- **R106 User menu:** the top bar ends with a round button showing the signed-in person's initials. It opens a menu with their name and email, the theme choice (Light, Dark or System, R90) and "Sign out".
- **R107 Signing out** ends the session in this browser and shows the sign-in screen. Anything not yet saved is lost, as when leaving a page.
- **R108 Session ends:** when the session can't be renewed (the person was removed in Supabase, or it ran out while the computer slept), the next request gets 401 and the app shows the sign-in screen with "Your session has ended. Sign in again." After signing in, the person goes back to the page they were on.
- **R109 Keyboard and screen readers:** the menu button's accessible name is "Account menu, " followed by the person's name (or email). Enter, Space or the Down arrow opens the menu, the arrow keys move through its items, Escape closes it and puts focus back on the button, and Tab moves out of it and closes it (NFR-7).

### 3.12 Who added and changed each record

- **R110 Recorded from the token:** each organization, contact, deal and activity records who added it and who last changed it, with the time of each. Both are taken from the signed-in person's token, never from the request body. A field with those names in a request is refused like any other unknown field (section 5.1).
- **R111 Shown on record pages:** the organization, contact and deal pages show "Added by Priya Shah on 12 Nov 2026" and, once it's been changed, "Last changed by Sam Lee on 14 Nov 2026", below the details in Muted ink.
- **R112 Shown in timelines:** each activity in a timeline shows who added it, after the date and time: "12 Nov 2026, 14:30 · Priya Shah". Stage changes don't record a person.
- **R113 Sample data:** records loaded as sample data have no person recorded, and show "Added by Sample data" (confirmed by the engineer with the plan, 27 Nov 2026). A sample record changed later shows the person who changed it as "Last changed by".
- **R114 People who leave:** a person removed from Supabase still shows by the name or email they last signed in with. Their records stay.
- **R115 Everyone can do everything:** every signed-in person can see, add, change and delete every record. There are no roles or permissions (section 1.3).
