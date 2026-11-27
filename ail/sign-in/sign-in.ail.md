# Sign in

How a person gets in, and where the app opens. Signed out, it opens on the
welcome screen; signed in but not onboarded, on onboarding; onboarded, on the
tabs. The three sign-in screens are children: the welcome (Apple, Google, or
email), the email step, and the landing that a sign-in link opens.

```ail
node SignIn : flow   level: experience
  why   Signing in needs no password and no phone number: Apple, Google or a link sent by email; then the
        app opens where the person is in their journey: the welcome, onboarding, or This week
        (DESIGN §3.1 steps 1–2, F10, F25).                                                          <- Friendpod
  what
    The app opens on one of three places, chosen by the session: signed out, the welcome screen; signed in but
      not onboarded, onboarding; onboarded, the tabs, on This week.
    A screen of another place cannot be opened directly: the app shows the place the session belongs to instead.
    The info pages, the legal texts and the email-link landing open from every place.
    A member counts as onboarded once the server has marked them so and they have finished the later onboarding
      steps on this phone. Partway, onboarding resumes at step 1 before the server's mark and at step 4 after it.
    When the phone cannot tell whether a member is onboarded (offline at start-up, or the account was deleted on
      the server), it treats them as not onboarded.
    The splash stays up until the session is known and the fonts are in; if the fonts fail, the app starts with
      the system font.
    A sign-in link opened from an email arrives on the email-link landing, carrying the whole link.

    Scenario: Signed out, the app opens on the welcome screen
      Given someone signed out
      When the app opens
      Then the welcome screen shows, reading Small groups. Real meetups. with Continue with email

    Scenario: Signed out, a member's screen shows the welcome screen instead
      Given someone signed out
      When they open the Pods tab directly
      Then the welcome screen shows, with Continue with email

    Scenario: A new member opens on step 1 of onboarding
      Given a new member, signed in but not onboarded
      When the app opens
      Then About you opens, reading Step 1 of 6

    Scenario: Partway through onboarding, the app resumes at the interests step
      Given a member choosing about private interests, marked onboarded by the server but not finished on this phone
      When the app opens
      Then step 4 opens, reading Step 4 of 6 and What are you into?

    Scenario: An onboarded member opens on This week
      Given a member this week
      When the app opens
      Then This week shows, reading Week 46

    Scenario: A member does not see the sign-in screens
      Given a member this week
      When they open the email sign-in step directly
      Then This week shows instead

  how
    decide three places, each shown only to its session: the welcome and sign-in, onboarding, and the tabs
      because the journey runs welcome and sign-in, then onboarding, then the app (DESIGN §3.1, §11 screens)
    decide onboarded needs both the server's mark and the later steps finished on this phone, kept per member
      because the later steps run after the server has marked the member onboarded, so the mark alone cannot tell; after a reinstall the optional steps simply show once more ("apps/mobile/src/features/session/onboardingFlag.ts")
    decide resume at step 1 before the server's mark, and at step 4 (interests) after it
      because "unknown, confirm with the owner: a member who closed the app before answering the private-interest consent resumes at step 4 and is never asked; should the consent step come first?"
    decide unknown claims count as not onboarded
      because offline at start-up or a user deleted on the server leaves the claims unknown ("apps/mobile/src/features/session/SessionProvider.tsx")
    decide sign-in links open the app through App Links and Universal Links on the Hosting domain, and land on the email-link landing
      because Dynamic Links shut down on 25 August 2025 (DESIGN §11)
  binds
    state    phase: "loading" | "signedOut" | "onboarding" | "ready", starting at "loading", from the signed-in member and their claims
    events   the member signs in, signs out or finishes onboarding: the phase is read again and the app shows that place
    events   an incoming address on the Hosting domain's sign-in path, or with mode=signIn, opens the landing with link set to that address
  uses Welcome, EmailSignIn, EmailLinkLanding
  children Welcome, EmailSignIn, EmailLinkLanding
  sources
    Code: "apps/mobile/app/_layout.tsx", "apps/mobile/app/(auth)/_layout.tsx", "apps/mobile/app/(onboarding)/index.tsx",
          "apps/mobile/app/+native-intent.tsx", "apps/mobile/src/features/session/SessionProvider.tsx", "apps/mobile/src/features/session/onboardingFlag.ts"
    Design: DESIGN §3.1 steps 1–2, §2.1 F10 and F25, §11 (navigation, auth, screens)
    Screens: driven in the web preview on 27 November 2026, worlds signed-out, onboarding-start, onboarding-consent, onboarding-interests, this-week
    No tickets: friendpod has no issues, and Asana has no Friendpod project
```
