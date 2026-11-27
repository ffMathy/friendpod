# Email-link landing

What opens when a sign-in link from the email is opened on the phone: it signs
in at once, asks for the address when the link was opened on another phone,
or says the link does not work. Asking for the address is the child
EmailLinkConfirmAddress.

```ail
node EmailLinkLanding : flow   level: experience
  why   A sign-in link finishes signing in on its own, and a link opened on the wrong phone, or one that does not
        work, always leaves a way on (DESIGN §11, F10).                                                     <- SignIn
  what
    With the address kept on this phone, the link signs in at once, and the app moves on to onboarding or the tabs.
    Without it, the person types the address the link was sent to.
    A link that has expired or was already used says The link has expired or was already used. Ask for a new one.
    For a member already signed in (asked to sign in again before an export or a deletion), the link signs them in
      again; when it does not work, only Back to the start is offered, since the action that asked sends a new link.
    In builds against the local emulators, opened without a link, the landing also offers a field to paste one.

    Scenario: A link opened on the phone that asked for it signs in at once
      Given someone signed out, email link sent to emil@example.com
      When they open the sign-in link
      Then they are signed in, and onboarding opens on About you, reading Step 1 of 6

    Scenario: A link that does not work offers a new one
      Given someone signed out, email link sent to emil@example.com
      When they open a link that is not a sign-in link
      Then it reads That link didn’t work and This isn’t a valid sign-in link. Ask for a new one.
      When they press Send a new link
      Then Sign in with email opens, with emil@example.com in the Email address field

    Scenario: Back to the start from a link that does not work
      Given someone signed out, email link sent, on That link didn’t work
      When they press Back to the start
      Then the welcome screen shows, with Continue with email

    Scenario: Opened without a link, the landing only waits
      Given someone signed out
      When the landing opens without a link
      Then it reads Signing you in and This only takes a moment., with a spinner, and nothing else

    Scenario: A link that does not work, in Danish
      Given someone signed out whose app is in Danish, email link sent
      When they open a link that is not a sign-in link
      Then it reads Linket virkede ikke, Linket er ikke gyldigt. Bed om et nyt., Send et nyt link and Tilbage til start

  how
    decide with the kept address a link that does not work ends in Send a new link, which opens the email step with that address
      because there is nothing to correct here ("apps/mobile/app/auth/complete.tsx")
    decide no back chevron, and no header
      because the link opens this screen on its own ("apps/mobile/app/auth/complete.tsx")
    decide opened without a link, the landing waits with its spinner and offers nothing
      because "unknown, confirm with the owner: outside emulator builds, the landing opened without a link spins forever with no way out; should it offer Back to the start?"
    decide the spinner is Ink 2, not Skov
      because it is not something to tap ("apps/mobile/app/auth/complete.tsx")
  look
    Paper (color.page), side padding space.gutter, blocks space.gap.loose apart; no back chevron: the title starts 40px from the top
      in font.display, type.title, 800, color.text, the lede 8px under it in font.body, type.body, color.text.secondary.
    Waiting: a large spinner in color.text.secondary under the lede, at the left.
    Pinned at the bottom: the main button, full width, size.button tall, radius.pill, color.primary with color.on.primary type.button text
      (color.disabled with color.disabled.text while it cannot be pressed), and under it Back to the start, centred, as an underlined bold color.link link in type.label.
  copy
    auth.complete.title         "Signing you in"            da "Vi logger dig ind"
    auth.complete.body          "This only takes a moment."   da "Det tager kun et øjeblik."
    auth.complete.pasteLink     "Sign-in link (emulator)"   da "Login-link (emulator)"
    auth.complete.errorTitle    "That link didn’t work"     da "Linket virkede ikke"
    auth.complete.invalid       "This isn’t a valid sign-in link. Ask for a new one."   da "Linket er ikke gyldigt. Bed om et nyt."
    auth.complete.failed        "The link has expired or was already used. Ask for a new one."   da "Linket er udløbet eller allerede brugt. Bed om et nyt."
    auth.complete.newLink       "Send a new link"           da "Send et nyt link"
    auth.complete.restart       "Back to the start"         da "Tilbage til start"
  binds
    props    link: text, the incoming address, or nothing
    state    result: "idle" | "working" | "invalid" | "failed", starting at "idle"
    events   with link and a kept address, signs in at once, and success opens the start; without a kept address, asks for it; Send a new link opens the email step; Back to the start opens the start
    role     the spinner is a progress bar named "Signing you in"; the lede is an alert when it says what went wrong
  uses EmailLinkConfirmAddress
  children EmailLinkConfirmAddress
  sources
    Code: "apps/mobile/app/auth/complete.tsx", "apps/mobile/app/+native-intent.tsx", "apps/mobile/src/features/auth/emailLink.ts", "apps/mobile/src/features/auth/AuthStep.tsx",
          "apps/mobile/src/i18n/en/auth.json", "apps/mobile/src/i18n/da/auth.json"
    Design: DESIGN §11 (email link), F10; "apps/mobile/preview/screens.json" app-auth-complete, app-auth-complete-confirm, app-auth-complete-invalid
    Screens: driven in the web preview, worlds signed-out and signed-out-link-pending, in English and Danish, on 27 November 2026. The preview takes a link with a code as a sign-in link
             and never fails one, so the expired message and the signed-in member's case were read from the code
```
