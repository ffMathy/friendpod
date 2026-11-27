# Where did you hear about Friendpod?

The optional source question on step 2, under the area card: one answer or none, sent once with the basics and only
ever counted.

```ail
node HeardFromQuestion : view   level: experience
  why   Friendpod learns which channels bring people in without keeping the answer on anyone's
        profile (DESIGN F37, §3.1 step 6, §6.8).                                                  <- AreaStep
  what
    Eight answers, in this order: A dads' or parents' group, A newcomer event, University or school, A poster at a café or venue,
      A friend, Social media, News or press, Somewhere else.
    At most one is chosen: pressing an answer chooses it, pressing the chosen one again clears it. Continue never waits for it.
    The chosen answer goes with the basics on Continue; the server only adds one to a count per city and week.

    Scenario: The question lists eight answers and is optional
      Given a new member on Where do you live? after About you
      Then it asks Where did you hear about Friendpod? (optional)
      And it says We only count the answers per city and week; it is not saved on your profile.
      And it offers A dads' or parents' group, A newcomer event, University or school, A poster at a café or venue, A friend, Social media, News or press and Somewhere else

    Scenario: The question in Danish
      Given a new member whose app is in Danish, on Hvor bor du? after Om dig
      Then it asks Hvor hørte du om Friendpod? (valgfrit)
      And it offers En ven and Et andet sted

  how
    decide optional, one fixed choice or none
      because DESIGN F37 and §3.1 step 6: "one choice of …; skippable"
    decide the answer is sent once and only counted, never stored on the member
      because DESIGN F37: "never stored on the user"; §10.1: the answer is stored nowhere but in that count
    decide it sits under the area card, after what the storyboard draws
      because it is the app's own question, not on the storyboard ("apps/mobile/preview/screens.json", app-onb-area-heard-from)
  look
    The question as a heading in type.label, 700, color.text, with "(optional)" in 500, color.text.muted; the hint under it in type.small, color.text.secondary.
    The answers as size.chip pills that wrap, 8px apart, in type.small.text, 700: unchosen white (color.surface) with a border.control color.border.strong outline and color.text;
      chosen color.ink with color.on.ink text.
  copy
    onboarding.heardFrom.question       "Where did you hear about Friendpod?"   da "Hvor hørte du om Friendpod?"
    common.optional                     "(optional)"                da "(valgfrit)"
    onboarding.heardFrom.hint           "We only count the answers per city and week; it is not saved on your profile."   da "Vi tæller kun svarene pr. by og uge; svaret gemmes ikke på din profil."
    onboarding.heardFrom.dadsGroup      "A dads' or parents' group"   da "En fædre- eller forældregruppe"
    onboarding.heardFrom.newcomerEvent  "A newcomer event"          da "Et arrangement for nytilflyttere"
    onboarding.heardFrom.university     "University or school"      da "Universitet eller skole"
    onboarding.heardFrom.venuePoster    "A poster at a café or venue"   da "En plakat på en café eller et spillested"
    onboarding.heardFrom.friend         "A friend"                  da "En ven"
    onboarding.heardFrom.socialMedia    "Social media"              da "Sociale medier"
    onboarding.heardFrom.press          "News or press"             da "Nyheder eller presse"
    onboarding.heardFrom.other          "Somewhere else"            da "Et andet sted"
  binds
    props    chosen: "dadsGroup" | "newcomerEvent" | "university" | "venuePoster" | "friend" | "socialMedia" | "press" | "other" or nothing, onChange(chosen)
    role     a radio group named "Where did you hear about Friendpod?", each answer a radio
  sources
    Code: "apps/mobile/app/(onboarding)/area.tsx", "packages/core/src/metrics/funnel.ts" (the eight sources)
    Design: DESIGN F37, §3.1 step 6, §6.8, §10.1
    Screens: "apps/mobile/preview/screens.json" app-onb-area-heard-from; driven in the web preview, world onboarding-start, in English and Danish, on 27 November 2026
```
