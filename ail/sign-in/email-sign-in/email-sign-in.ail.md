# Email sign-in

Sign in with a link sent by email: type the address, get a link, open it on
this phone. Reached from Continue with email on the welcome screen, or from
Send a new link when a link did not work.

```ail
node EmailSignIn : flow   level: experience
  why   Someone without Apple or Google, or who would rather not use them, signs in with only an email address:
        no password and no phone number (DESIGN F10, §3.1 step 2).                                          <- SignIn
  what
    The send button waits for a whole address: one @, with something before it and something, a dot and something
      after it, and no spaces inside, ignoring spaces before and after. The address is sent and shown without those spaces.
    The address is kept on this phone only, until the link is used. When one is kept from an earlier link, the
      field starts with it, unless the person has already started typing.
    While the link is being sent, the button shows it is busy.
    If the link cannot be sent, a warning note says We couldn’t send the link. Check the address and try again.
    The link is sent again with the same button, which then reads Send a new link.

    Scenario: Send waits for a whole address
      Given someone signed out, on Sign in with email
      When they enter emil@example
      Then Send me a sign-in link cannot be pressed
      When they enter emil@example.com
      Then Send me a sign-in link can be pressed

    Scenario: Sending the link
      Given someone signed out, on Sign in with email
      When they enter emil@example.com with spaces around it and press Send me a sign-in link
      Then the step says Check your inbox and We sent a link to emil@example.com. Open it on this phone to sign in.
      And the button reads Send a new link

    Scenario: The return key sends the link
      Given someone signed out, on Sign in with email
      When they enter emil@example.com and press the return key
      Then the step says Check your inbox

    Scenario: An address kept from an earlier link fills the field
      Given someone signed out who asked for a link to emil@example.com earlier
      When Sign in with email opens
      Then the Email address field holds emil@example.com

    Scenario: Back returns to the welcome screen
      Given someone signed out who pressed Continue with email on the welcome screen
      When they press Back
      Then the welcome screen shows, with Continue with email

    Scenario: The email step in Danish
      Given someone signed out whose app is in Danish, on Log ind med e-mail
      When they enter emil@example.com and press Send mig et login-link
      Then the step says Tjek din indbakke and Vi har sendt et link til emil@example.com. Åbn det på denne telefon for at logge ind.

  how
    decide an email link and no phone number
      because a text message costs money and needs a phone number (DESIGN F10); the helper says so
    decide the pending address stays on this phone only, in its secure storage, until the link is used
      because the pending sign-in email stays on the device only (PRIVACY §12.1, "apps/mobile/src/features/auth/emailLink.ts")
    decide a kept address never overwrites what the person has started typing
      because the code says so ("apps/mobile/app/(auth)/email.tsx": "Never overwrite what the person has started typing.")
    decide Back returns to the screen before, or to the welcome screen when there is none
      because the step is reached from the welcome or from a link that did not work ("apps/mobile/app/(auth)/email.tsx")
    decide a calm pushed step on Paper, with no logo
      because the lockup is the welcome's alone, and this screen has no storyboard ("apps/mobile/preview/screens.json", app-auth-email; blend spec §7.1)
  look
    Paper (color.page), side padding space.gutter, blocks space.gap.loose apart. A size.hit back chevron 32px from the top;
      12px under it the title in font.display, type.title, 800, color.text, and 8px under that the lede in font.body, type.body, color.text.secondary.
    The field: "Email address" in type.label, 700, color.text, over a size.input color.surface input, border.field color.field border, radius.input,
      the placeholder you@example.com; the helper under it in type.caption.text, color.text.muted.
    Sent: a note under the field, color.surface with a border.hairline color.border border, radius.lg, a check icon, the title in 700 and the text in type.caption.text, color.text.secondary.
    Failed: a note with a border.control color.danger border, radius.lg, a color.danger alert icon, the text in type.small.text, color.text.
    The button pinned at the bottom: full width, size.button tall, radius.pill, type.button in font.body 700; color.primary with color.on.primary text, or color.disabled with color.disabled.text while it cannot be pressed.
  copy
    auth.email.title        "Sign in with email"        da "Log ind med e-mail"
    auth.email.intro        "We’ll email you a link. Open it on this phone and you’re in. No password needed."   da "Vi sender dig et link på e-mail. Åbn det på denne telefon, så er du logget ind. Du skal ikke bruge en adgangskode."
    auth.email.label        "Email address"             da "E-mailadresse"
    auth.email.placeholder  "you@example.com"           da "dig@example.com"
    auth.email.helper       "We never ask for your phone number."   da "Vi spørger aldrig om dit telefonnummer."
    auth.email.send         "Send me a sign-in link"    da "Send mig et login-link"
    auth.email.resend       "Send a new link"           da "Send et nyt link"
    auth.email.sentTitle    "Check your inbox"          da "Tjek din indbakke"
    auth.email.sent         "We sent a link to {{email}}. Open it on this phone to sign in."   da "Vi har sendt et link til {{email}}. Åbn det på denne telefon for at logge ind."
    auth.email.failed       "We couldn’t send the link. Check the address and try again."   da "Vi kunne ikke sende linket. Tjek adressen, og prøv igen."
    common.back             "Back"                      da "Tilbage"
  binds
    state    email: text, starting at "" or the kept address
    state    sending: "idle" | "sending" | "sent" | "failed", starting at "idle"
    events   the button, or the return key, sends a sign-in link to the trimmed address and keeps it on the phone; sent shows the note with that address
    role     the sent and failed notes are alerts
  sources
    Code: "apps/mobile/app/(auth)/email.tsx", "apps/mobile/src/features/auth/emailLink.ts", "apps/mobile/src/features/auth/AuthStep.tsx", "apps/mobile/src/components/TextField.tsx",
          "apps/mobile/src/i18n/en/auth.json", "apps/mobile/src/i18n/da/auth.json"
    Design: DESIGN F10, §3.1 step 2, §11 (email link); PRIVACY §12.1; "apps/mobile/preview/screens.json" app-auth-email and app-auth-email-sent
    Screens: driven in the web preview, worlds signed-out and signed-out-link-pending, in English and Danish, on 27 November 2026; the preview never fails to send, so the failed note was read from the code
```
