# Onboarding

The six steps a new member goes through before their first pod, as one flow: the order, the "Step n of 6" header,
where the app resumes, and what reaches the server at which step. Each step is a child of its own, `about-you/`
first.

```
about-you/                 AboutYou: step 1, first name, birth date, the Terms (nothing sent)
area-step/                 AreaStep: step 2, where you live and where you heard of Friendpod (the basics are sent)
sensitive-interests-step/  SensitiveInterestsStep: step 3, the blanket consent for private interests
interests-step/            InterestsStep: step 4, at least three interests in your own words
preferences-step/          PreferencesStep: step 5, who you would like to meet
final-step/                FinalStep: step 6, photo, About me, notifications, the safety pledge, Finish
```

```ail
node Onboarding : flow   level: experience
  why   Joining asks only for what forming a pod needs, a little at a time, and each step says how
        far along the member is (DESIGN §3.1 steps 3–12).                                          <- Friendpod
  what
    The steps run in this order: About you, Where do you live?, Sensitive interests, What are you into?,
      Who would you like to meet?, Almost done. Each opens the next with its own main action.
    Every step's header reads Step n of 6 with six segments, the first n filled.
    What reaches the server, and when: nothing on step 1; on step 2's Continue the first name, the birth date,
      the app's language, the area cell, the versions of the Terms and the privacy notice and the optional source,
      all at once, after which steps 1 and 2 cannot be changed from onboarding; on step 3 the consent, only with I agree;
      on step 4 each interest as it is added; on step 5 the preferences on Continue; on step 6 the photo when one is
      picked, and About me on Finish when it changed.
    The answers of step 1 live only on the phone, in memory, until step 2 sends them.
    Finishing is remembered on the phone only: after a reinstall a member sees steps 4 to 6 once more.

    Scenario: A new member starts at About you
      Given a new member who has just signed in
      When the app opens
      Then step 1 shows, reading Step 1 of 6 and About you

    Scenario: A member who sent the basics resumes at the interests
      Given a member choosing about private interests, whose basics are already sent
      When the app opens
      Then step 4 shows, reading Step 4 of 6 and What are you into?

    Scenario: Back from resumed interests opens the private-interests step
      Given a member choosing about private interests, resumed at What are you into?
      When they press Back
      Then step 3 shows, reading Step 3 of 6 and Sensitive interests, with no Back
      When they press Not now
      Then What are you into? shows again

    Scenario: Resuming in Danish
      Given a member choosing about private interests whose app is in Danish
      When the app opens
      Then it reads Trin 4 af 6 and Hvad går du op i?

  how
    decide six steps, in the storyboards' order, each with its own "Step n of 6"
      because the storyboards draw six onboarding steps, onb-about to onb-final (pull request 4; "apps/mobile/app/(onboarding)/_layout.tsx")
    decide the basics are sent once, together, on step 2, and the consent only after that
      because the server needs the area to create the profile (DESIGN §3.1 step 6), and recording the consent needs the profile the basics create ("apps/mobile/app/(onboarding)/sensitive-consent.tsx")
    decide resuming opens step 1 before the basics are sent and step 4 after, skipping step 3
      because "unknown, confirm with the owner: should a resumed member who never answered the private-interests step see it before the interests, rather than only behind Back?"
    decide Back returns to the step before when there is one on screen; after a resume, or once the basics are sent, there is none, and only steps 1 and 4 still offer Back
      because steps 1 and 2 are on the server once sent and cannot be changed from here; the consent step starts afresh ("apps/mobile/app/(onboarding)/area.tsx", "apps/mobile/src/features/onboarding/OnboardingStep.tsx")
    decide steps 3 to 6 are marked finished on the phone, not on the server
      because the server's onboarded mark is set by step 2 and cannot tell whether the later steps were done ("apps/mobile/src/features/session/onboardingFlag.ts")
  look
    Every step: Paper (color.page), side padding space.gutter, blocks space.step apart, the main action pinned at the bottom 20px above the edge.
    The header: a size.hit back chevron on the left (an empty size.hit space when there is none) and "Step n of 6" in type.caption, 600, color.text.muted on the right;
      8px under it six size.segment segments with radius.pill ends, the done ones color.primary, the rest color.track; space.step under them.
    The step title in font.display, type.title, 700, color.text; its lede 4px under it in type.lede, color.text.secondary.
  copy
    common.stepOf    "Step {{step}} of {{total}}"   da "Trin {{step}} af {{total}}"
    common.back      "Back"                         da "Tilbage"
    common.continue  "Continue"                     da "Fortsæt"
  uses AboutYou, AreaStep, SensitiveInterestsStep, InterestsStep, PreferencesStep, FinalStep
  children AboutYou, AreaStep, SensitiveInterestsStep, InterestsStep, PreferencesStep, FinalStep
  sources
    Code: "apps/mobile/app/(onboarding)/_layout.tsx", "apps/mobile/app/(onboarding)/index.tsx", "apps/mobile/src/features/onboarding/OnboardingStep.tsx",
          "apps/mobile/src/features/onboarding/draft.tsx", "apps/mobile/src/features/session/SessionProvider.tsx", "apps/mobile/src/features/session/onboardingFlag.ts", "apps/mobile/app/_layout.tsx"
    Design: DESIGN §3.1 steps 3–12, §10.1 (the onboarding call)
    Pull request: "https://github.com/ffMathy/friendpod/pull/4" ("onboarding, now the storyboards' 6 steps")
    Screens: driven in the web preview, worlds onboarding-start and onboarding-consent, in English and Danish, on 27 November 2026
```
