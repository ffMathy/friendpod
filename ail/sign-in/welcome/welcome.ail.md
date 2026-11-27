# Welcome

The welcome screen: what Friendpod is, and sign-in in one tap. The Skov
poster at the top (lockup, language switch, mark, headline) is its child
WelcomePoster; this node holds the Paper part under it: the paragraph, the
three ways to sign in and the Terms line.

```ail
node Welcome : flow   level: experience
  why   The first screen says what Friendpod is and lets a person sign in in one tap, with no password and no
        phone number (DESIGN §3.1 steps 1–2, F10).                                                       <- SignIn
  what
    Continue with Apple shows on Apple phones only; Android shows Continue with Google and Continue with email.
    While Apple or Google is signing in, the pressed button shows it is busy and all three buttons wait.
    Closing Apple's or Google's own sign-in sheet changes nothing: no message shows.
    Once signed in, the app moves on by itself, to onboarding or to the tabs.
    Right after an account was deleted, the welcome shows, once, a note above the paragraph: Your account has been deleted.
    The language chosen on the poster is the one the app uses from then on; the welcome itself stores nothing.

    Scenario: Signing in with Apple leads to onboarding
      Given someone signed out, on the welcome screen of an Apple phone
      When they press Continue with Apple
      Then About you opens, reading Step 1 of 6

    Scenario: A sign-in that fails says so
      Given someone signed out, on the welcome screen, where Google sign-in fails
      When they press Continue with Google
      Then the welcome says Sign-in didn’t work. Please try again.
      And it still shows Continue with Google, which can be pressed again

    Scenario: Continue with email opens the email step
      Given someone signed out, on the welcome screen
      When they press Continue with email
      Then Sign in with email opens, with the Email address field

    Scenario: A failed sign-in in Danish
      Given someone signed out whose app is in Danish, where Google sign-in fails
      When they press Fortsæt med Google
      Then the welcome says Det lykkedes ikke at logge ind. Prøv igen.

  how
    decide welcome and sign-in are one screen
      because the storyboard Main draws them as one poster moment; the separate sign-in screen is gone ("apps/mobile/preview/screens.json", Main)
    decide Apple on Apple phones only; Google and an email link on both
      because Apple's web flow on Android adds setup for little gain (DESIGN F25, D10, answering Q9)
    decide no sign-in by text message
      because a text message costs money and needs a phone number (DESIGN F10)
    decide the Terms line says the Terms are accepted before starting, and has no tick
      because acceptance is the explicit tick on onboarding step 1 ("apps/mobile/preview/screens.json", Main)
    decide a closed sign-in sheet shows nothing
      because the person dismissed it, which screens treat as nothing happened ("apps/mobile/src/features/auth/errors.ts")
    decide on a screen shorter than 844 the mark's box gives up height, from 202 down to 120, before the page scrolls
      because the buttons and the Terms line stay in view ("apps/mobile/app/(auth)/index.tsx")
  look
    The page under the poster is Paper (color.page), side padding space.gutter, 20px top and 22px bottom padding; the paragraph at the top,
      the buttons and the Terms line at the bottom, at least space.gap between them.
    The paragraph in font.body, type.body, color.text.secondary.
    Buttons 10px apart, each full width, size.button tall, radius.pill, type.button in font.body 700:
      Apple color.ink with color.on.ink text; Google and email color.surface with color.text text and a border.control color.border.strong border.
    The Terms line centred in type.caption, color.text.muted, 19.5px a line, 4px under the buttons, "Terms" and "privacy notice" bold, underlined color.link links.
    A failed sign-in: a note above the buttons, color.surface with a border.control color.danger border, radius.lg, a color.danger alert icon and the text in type.small.text, color.text.
    The deletion note: color.surface with a border.hairline color.border border, radius.lg, a check icon, the text in type.caption.text, color.text.secondary.
  copy
    welcome.body           "Every Thursday we put together a pod of 4–⁠6 people near you who share something you care about. You meet in person."   da "Hver torsdag sætter vi en pod sammen: 4–⁠6 mennesker tæt på dig, der deler noget, du går op i. I mødes i virkeligheden."
    auth.signIn.apple      "Continue with Apple"     da "Fortsæt med Apple"
    auth.signIn.google     "Continue with Google"    da "Fortsæt med Google"
    auth.signIn.email      "Continue with email"     da "Fortsæt med e-mail"
    auth.signIn.failed     "Sign-in didn’t work. Please try again."   da "Det lykkedes ikke at logge ind. Prøv igen."
    welcome.legal          "You accept the <terms>Terms</terms> before you start. Read how we handle your data in the <privacy>privacy notice</privacy>."   da "Du skal acceptere vores <terms>vilkår</terms>, før du går i gang. Læs, hvordan vi behandler dine data, i <privacy>privatlivserklæringen</privacy>."
    settings.delete.done   "Your account has been deleted. Thanks for trying Friendpod."   da "Din konto er slettet. Tak, fordi du prøvede Friendpod."
  binds
    state    busy: "apple" | "google" | nothing, starting at nothing
    state    failed: boolean, starting at false
    events   Continue with Apple or Google sets busy and clears failed; a closed sheet only clears busy; any other error sets failed
    events   Continue with email opens the email step; Terms and privacy notice open the legal text with doc "terms" or "privacy"
    role     the failed note is an alert
  uses WelcomePoster
  children WelcomePoster
  sources
    Code: "apps/mobile/app/(auth)/index.tsx", "apps/mobile/src/features/auth/apple.ts", "apps/mobile/src/features/auth/google.ts", "apps/mobile/src/features/auth/errors.ts",
          "apps/mobile/src/components/Button.tsx", "apps/mobile/src/components/Card.tsx", "apps/mobile/src/i18n/en/auth.json", "apps/mobile/src/i18n/da/auth.json"
    Design: DESIGN §3.1 steps 1–2, F10, F25, §11 (auth); "apps/mobile/preview/screens.json" Main
    Screens: driven in the web preview, world signed-out (10 November 2026 12:00), in English and Danish, on 27 November 2026. The preview reports an Apple phone, so Apple shows;
             its build has no Google client id, so Continue with Google always fails there, which is how the failure scenarios are played
```
