# Email link: confirm the address

The landing's form for a sign-in link opened on a phone that does not keep the
address it was sent to: the person types the address, and signs in.

```ail
node EmailLinkConfirmAddress : flow   level: experience
  why   A link opened on another phone, or after the kept address was cleared, still signs in, once the person
        says which address it was sent to (DESIGN §11).                                                  <- EmailLinkLanding
  what
    Sign in waits for an address that is not only spaces; the address is sent without spaces before and after.
    A link that does not work shows its message as a warning under the field, and the form stays.

    Scenario: A link opened on another phone asks for the address
      Given someone signed out, with no address kept on this phone
      When they open the sign-in link
      Then it reads Finish signing in and Enter the email address the link was sent to, and we’ll sign you in.
      And Sign in cannot be pressed, and Back to the start is offered
      When they enter emil@example.com and press Sign in
      Then they are signed in, and onboarding opens on About you

    Scenario: A link that does not work, on another phone
      Given someone signed out, with no address kept on this phone
      When they open a link that is not a sign-in link, enter emil@example.com and press Sign in
      Then Finish signing in stays, with the warning This isn’t a valid sign-in link. Ask for a new one.

    Scenario: Back to the start instead of the address
      Given someone signed out, with no address kept on this phone, on Finish signing in
      When they press Back to the start
      Then the welcome screen shows, with Continue with email

    Scenario: Confirming the address in Danish
      Given someone signed out whose app is in Danish, with no address kept on this phone
      When they open the sign-in link
      Then it reads Gør dit login færdigt, E-mailadresse, Log ind and Tilbage til start

  how
    decide ask for the address, with Back to the start as a way out
      because a link opened on the wrong phone, or an address the person no longer remembers, needs a way out ("apps/mobile/app/auth/complete.tsx")
    decide the address is asked for, not taken from the link
      because the address that asked for the link is needed to complete it when the link is opened on another device ("apps/mobile/src/features/auth/emailLink.ts")
  look
    As the landing: Paper, side padding space.gutter, no back chevron, the title 40px from the top in font.display, type.title, 800, color.text, the lede in type.body, color.text.secondary.
    The field: "Email address" in type.label, 700, color.text, over a size.input color.surface input, border.field color.field border, radius.input, placeholder you@example.com.
    A warning note under it when the link fails: color.surface, border.control color.danger border, radius.lg, a color.danger alert icon, the text in type.small.text, color.text.
    Pinned at the bottom: Sign in, full width, size.button tall, radius.pill, color.primary with color.on.primary type.button text, or color.disabled with color.disabled.text while it cannot be pressed;
      under it Back to the start, centred, an underlined bold color.link link in type.label.
  copy
    auth.complete.confirmTitle  "Finish signing in"         da "Gør dit login færdigt"
    auth.complete.confirmBody   "Enter the email address the link was sent to, and we’ll sign you in."   da "Skriv den e-mailadresse, linket blev sendt til, så logger vi dig ind."
    auth.complete.continue      "Sign in"                   da "Log ind"
    auth.complete.restart       "Back to the start"         da "Tilbage til start"
    auth.email.label            "Email address"             da "E-mailadresse"
    auth.email.placeholder      "you@example.com"           da "dig@example.com"
  binds
    state    email: text, starting at ""
    events   Sign in, when the link and the trimmed address are not empty, signs in with them; success opens the start
    events   Back to the start opens the start
    role     Back to the start is a link; the warning note is an alert
  sources
    Code: "apps/mobile/app/auth/complete.tsx", "apps/mobile/src/features/auth/emailLink.ts", "apps/mobile/src/components/TextField.tsx", "apps/mobile/src/components/Button.tsx"
    Design: DESIGN §11 (email link); "apps/mobile/preview/screens.json" app-auth-complete-confirm
    Screens: driven in the web preview, world signed-out, in English and Danish, on 27 November 2026
```
