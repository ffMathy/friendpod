# Almost done (step 6)

Step 6 of 6: an optional photo and About me, notifications, and the safety pledge, which Finish needs. Finish ends
onboarding and opens Home. The About me field and the three cards are children of their own.

```ail
node FinalStep : flow   level: experience
  why   Before the first pod a member can add what helps others recognise them, chooses whether to hear
        about their drop, and promises to meet safely (DESIGN §3.1 steps 10–12).                <- Onboarding
  what
    In order: the photo card, About me, the notifications card, the safety pledge; Finish pinned under them.
    Finish can be pressed once the pledge is ticked and About me has nothing refused. It saves About me first when it changed,
      then marks onboarding finished on this phone and opens Home: the city's waitlist while the area is not open, This week once it is.
      It is busy meanwhile; if saving About me fails, the reason shows under the field and onboarding is not finished.
    Until the profile has loaded the step shows Loading.

    Scenario: Finish waits for the safety pledge
      Given a member on the last onboarding step
      When Almost done opens
      Then it reads Step 6 of 6 and Almost done
      And the pledge I'll meet in public places, treat people with respect, and use Report if something feels wrong. is not ticked
      And Finish cannot be pressed
      When they tick the pledge
      Then Finish can be pressed

    Scenario: Finishing opens Home
      Given a member on the last onboarding step, in Aarhus, which is open
      When they tick the pledge and press Finish
      Then Home opens on This week

    Scenario: The step in Danish
      Given a member on the last onboarding step whose app is in Danish
      When Næsten færdig opens
      Then it reads Trin 6 af 6, and Færdig cannot be pressed

  how
    decide photo and About me are optional, the pledge is needed
      because DESIGN §3.1 steps 10–11: both optional; the safety pledge checkbox
    decide Finish saves About me only when it changed
      because "apps/mobile/app/(onboarding)/almost-done.tsx": Finish saves "About me" if it changed
    decide notifications are asked with a secondary button, so Finish is the one main action
      because "apps/mobile/app/(onboarding)/almost-done.tsx": "Turn on notifications" is secondary so Finish (Skov) is the one main action
    decide Home is the waitlist while the city is not open
      because DESIGN §3.1 steps 12–13: in a waitlist area Home is the waitlist screen on every app open
  look
    The onboarding header and title, no lede; white cards on Paper, space.step apart; Finish as every step's main action.
  copy
    onboarding.final.title   "Almost done"   da "Næsten færdig"
    onboarding.final.finish  "Finish"        da "Færdig"
    common.loading           "Loading"       da "Indlæser"
  binds
    route    "/almost-done"
    state    pledged: boolean, starting at false; finishing: boolean
    events   Finish, when pledged and About me is fine, saves About me if it changed, marks onboarding finished on the phone, and the app opens on its main tabs
  uses FinalStepAboutMe, FinalStepCards
  children FinalStepAboutMe, FinalStepCards
  sources
    Code: "apps/mobile/app/(onboarding)/almost-done.tsx", "apps/mobile/src/features/onboarding/FinalStepCards.tsx", "apps/mobile/src/features/session/SessionProvider.tsx"
    Design: DESIGN §3.1 steps 10–13
    Screens: "apps/mobile/preview/screens.json" onb-final; driven in the web preview, world onboarding-final, in English and Danish, on 27 November 2026
```
