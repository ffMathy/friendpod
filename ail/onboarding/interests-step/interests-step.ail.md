# What are you into? (step 4)

Step 4 of 6: interests in the member's own words, at least three. The field and its answers, the member's
interests as chips, and the suggestions ("Did you mean", "Popular in …") are children of their own. The Interests
tab shows the same interests as a list; the rules every interest goes through are `InterestRules`.

```ail
node InterestsStep : flow   level: experience
  why   Pods form around one thing everyone in them shares, said in people's own words, so the
        member gives a few interests before the first drop (DESIGN §3.1 step 8, §5.2).            <- Onboarding
  what
    Under the title: the field, then Your interests with the count added, the chips, and the suggestions; Continue pinned under them.
    Continue can be pressed once the member has at least 3 interests, private ones included, and opens step 5.
    Each interest is saved as soon as it is added; Continue sends nothing more.
    Back opens step 3: the one before it, or, after a resume, the private-interests step in its place.

    Scenario: Three or more interests let the member continue
      Given a member adding interests, with brætspil, sourdough, far på barsel and the private gravid
      When What are you into? opens
      Then it reads Step 4 of 6, and Your interests · 4 added
      And the chips brætspil, sourdough, far på barsel and gravid show
      And Continue can be pressed

    Scenario: Below three interests Continue waits
      Given a member adding interests, with four interests
      When they remove brætspil and sourdough
      Then it reads Your interests · 2 added
      And Continue cannot be pressed

    Scenario: An added interest joins the chips
      Given a member adding interests, with four interests
      When they enter kayak and press Add
      Then the step says Added.
      And kayak is among the chips, and it reads Your interests · 5 added

    Scenario: No interests yet
      Given a member choosing about private interests, who has no interests
      When What are you into? opens
      Then Your interests says No interests yet.
      And Continue cannot be pressed

    Scenario: Continue opens step 5
      Given a member adding interests, with four interests
      When they press Continue
      Then step 5 opens, reading Step 5 of 6 and Who would you like to meet?

    Scenario: The step in Danish
      Given a member adding interests whose app is in Danish
      When What are you into? opens
      Then it reads Trin 4 af 6, Hvad går du op i? and Dine interesser · 4 tilføjet

  how
    decide at least 3 interests to continue, nudged towards 5
      because DESIGN §3.1 step 8: "minimum 3 interests, nudged towards 5"
    decide each interest is saved as it is added, not on Continue
      because every interest is checked on the phone and then by the server one by one ("apps/mobile/src/features/interests/useAddInterest.ts", DESIGN §5.2)
    decide Continue is pinned at the bottom, and the list scrolls above it
      because the locked interest notice is longer than the storyboard's note ("apps/mobile/preview/screens.json", onb-interests)
    decide after a resume Back opens the private-interests step in this one's place
      because Back goes to the consent step, as on the storyboard, and from there the member carries on here again ("apps/mobile/app/(onboarding)/add-interests.tsx")
  look
    The onboarding header and title, then the field block, Your interests, and the suggestions, 16px apart; Continue as every step's.
  copy
    onboarding.interests.title   "What are you into?"   da "Hvad går du op i?"
    onboarding.interests.lede    "In your own words, Danish or English. Pods form around one thing you all share."   da "Med dine egne ord, på dansk eller engelsk. En pod samles om én ting, I alle deler."
  binds
    state    the member's interests and private interests, read live from their profile
    events   Continue, when there are at least 3, opens step 5; Back opens step 3
  uses InterestsStepField, InterestsStepChips, InterestsStepSuggestions, InterestRules
  children InterestsStepField, InterestsStepChips, InterestsStepSuggestions
  sources
    Code: "apps/mobile/app/(onboarding)/add-interests.tsx", "apps/mobile/src/features/interests/InterestManager.tsx" (onboarding mode)
    Design: DESIGN §3.1 step 8, §5.2
    Screens: "apps/mobile/preview/screens.json" onb-interests, app-onb-interests-chip; driven in the web preview, worlds onboarding-interests and onboarding-consent, in English and Danish, on 27 November 2026
```
