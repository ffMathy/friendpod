# About you

Step 1 of the six onboarding steps: first name, birth date and the Terms.
Nothing is sent from this step; the answers wait on the phone until step 2
("Where do you live?") sends them with the area. The birth date and the Terms
are children of their own.

```ail
node AboutYou : flow   level: experience
  why   A new member gives only what pods need: the name pod members will see, proof of
        being an adult, and consent to the Terms as a contract (DESIGN §3.1 steps 3–5).   <- Friendpod
  what
    Scenario: The step starts empty and Continue waits
      Given a new member who has just signed in
      When About you opens
      Then it reads Step 1 of 6 and About you
      And the first name and the day, month and year of the birth date are empty
      And I accept the Terms is not ticked
      And Continue cannot be pressed

    Scenario: The basics lead to step 2
      Given a new member on About you
      When they enter the first name Emil and the birth date 14 03 1991
      And they tick I accept the Terms
      Then Continue can be pressed
      When they press Continue
      Then step 2 opens, reading Where do you live?

    Scenario: A first name with a digit is refused
      Given a new member on About you with the birth date 14 03 1991 and the Terms ticked
      When they enter the first name Emil2
      Then the step says Use letters only. No contact details.
      And Continue cannot be pressed

    Scenario: A long first name is accepted
      Given a new member on About you
      When they enter the first name Maria Josefine Augusta Wilhelmine Charlotte
      Then the field keeps the whole name, scrolling it sideways when it is longer than the field
      And no message is shown about the name

    Scenario: Going back from the first step signs out
      Given a new member who has just signed in, on About you
      When they press Back
      Then the welcome screen shows, with Continue with email

    Scenario: The step in Danish
      Given a new member whose app is in Danish
      When About you opens
      Then it reads Trin 1 af 6, Om dig and Fornavn
      When they enter the first name Emil2
      Then the step says Brug kun bogstaver. Ingen kontaktoplysninger.

  how
    decide the first name, the birth date and the Terms are one step, not three
      because the storyboards draw six onboarding steps, and onb-about holds all three (pull request 4), replacing a step each as DESIGN §3.1 numbers them
    decide Continue needs a first name the rules accept, a plausible adult birth date and the Terms ticked, and nothing more
      because the step refuses what the server would refuse, and the server repeats every check and is authoritative (DESIGN §3.1 step 6)
    decide the first-name field has no length limit
      because the owner removed the 30-character limit (27 November 2026)
    decide Back on this step signs out and returns to the welcome screen when there is no earlier step to return to
      because nothing has been saved yet, so leaving step 1 means leaving the sign-in (about.tsx)
    decide nothing is sent to the server from this step
      because the answers wait on the phone and are sent on step 2, together with the area (about.tsx, DESIGN §3.1 step 6)
  look
    Paper page (color.page), side padding space.gutter, blocks space.step apart, as the onb-about storyboard at 390×844.
    Header: a size.hit back chevron on the left and "Step 1 of 6" (type.caption, 600, color.text.muted) on the right;
      under it six size.segment segments with radius.pill ends, the first color.primary and the other five color.track.
    Title "About you" in font.display, type.title, 700, color.text; the lede 4px under it in font.body, type.lede, color.text.secondary.
    First name: label (type.label, 700, color.text) over a size.input white (color.surface) input with a border.field color.field border and radius.input;
      the helper under it in type.small, color.text.secondary. While it has focus the border is border.strong color.link; with an error it is border.strong color.danger, with the message in type.small, 700, color.danger.
    Continue pinned at the bottom, 20px above the edge: full width, size.button tall, radius.pill, type.button in font.body 700;
      color.primary with color.on.primary text when it can be pressed, color.disabled with color.disabled.text when it cannot.
  copy
    common.stepOf                      "Step {{step}} of {{total}}"                         da "Trin {{step}} af {{total}}"
    onboarding.about.title             "About you"                                          da "Om dig"
    onboarding.about.lede              "Just the basics. Nobody sees this until you're in a confirmed pod together."   da "Kun det mest nødvendige. Ingen ser det, før I er i en bekræftet pod sammen."
    onboarding.about.firstName         "First name"                                         da "Fornavn"
    onboarding.about.firstNameHelp     "Only people in a confirmed pod with you see it."    da "Kun dem, der er i en bekræftet pod med dig, kan se det."
    onboarding.about.firstNameInvalid  "Use letters only. No contact details."             da "Brug kun bogstaver. Ingen kontaktoplysninger."
    common.continue                    "Continue"                                           da "Fortsæt"
    common.back                        "Back"                                               da "Tilbage"
  binds
    state    firstName: text, starting at the draft's first name or ""
    events   Continue (under the birth date and Terms blocks), when firstNameFrom(firstName) and BirthDate's date are something and Terms is ticked, stores { firstName: the cleaned name, dob: the birth date, legalAccepted: true } in the onboarding draft and opens step 2 (the area route)
    events   Back returns to the previous screen when there is one, else signs out
  uses AboutYouRules, BirthDate, TermsAcceptance
  children AboutYouRules, BirthDate, TermsAcceptance
  sources
    Code: "apps/mobile/app/(onboarding)/about.tsx", "apps/mobile/src/features/onboarding/OnboardingStep.tsx", "apps/mobile/src/i18n/en/onboarding.json", "apps/mobile/src/i18n/da/onboarding.json"
    Design: DESIGN §3.1 steps 3–6
    Pull request: "https://github.com/ffMathy/friendpod/pull/4" ("onboarding as the storyboards' 6 steps")
    Screens: driven in the web preview, world onboarding-start (4 November 2026 19:55), in English and Danish, on 27 November 2026
    Interview: the owner, 27 November 2026: remove the first-name limit
    No tickets: friendpod has no issues, and Asana has no Friendpod project
```
