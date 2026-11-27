# Meeting safely

The safety tips: the emergency number, habits before and at the meetup, and,
for a member, the pledge they agreed to. Opened from Me, a confirmed pod's
safety note and a scheduled meetup's plan card.

```ail
node InfoMeetingSafely : view   level: experience
  why   Strangers meet in person, so a few habits are shown at confirmation and the day before, with
        the emergency number first (DESIGN §4.5, §3.7).                                   <- InfoPages
  what
    Scenario: The tips for a member, with the pledge
      Given a member this week, on Meeting safely
      Then it reads A few habits that keep every meetup comfortable. and then In danger right now? Call 112.
      And Before you go lists Meet in a public place in daytime or early evening., Arrange your own transport.,
        Tell a friend where you are going. and Never share your home address.
      And At the meetup lists You can leave at any time., Drink only if you want to, and at your own pace.
        and Use Report in the pod if something feels wrong.
      And the page ends with Our safety pledge: I'll meet in public places, treat people with respect, and use Report if something feels wrong.

    Scenario: Signed out, the tips without the pledge
      Given someone signed out, on Meeting safely
      Then Before you go and At the meetup show
      And Our safety pledge does not

    Scenario: Meeting safely in Danish
      Given a member this week whose app is in Danish, on Meeting safely
      Then it reads Mød hinanden trygt, I fare lige nu? Ring 112., Inden mødet, Under mødet and Vores sikkerhedsløfte

  how
    decide the emergency note comes first, in the safety note with a phone icon
      because safety reports and the tips say call 112 in an emergency (DESIGN §3.7, §4.5); the note is after-report's safety alert ("apps/mobile/app/info/safety.tsx")
    decide Never share your home address is marked with a no-entry sign, every other tip with a tick
      because a tick is a "do", and a "never" with a tick would read as approval ("apps/mobile/app/info/safety.tsx")
    decide the tips are split into before and at the meetup, in the order above
      because "unknown, confirm with the owner: DESIGN §4.5 lists the tips in another order, says Drink responsibly; there is no pressure to drink, and ends with call 112; is the page's wording and order the one to keep?"
    decide signed in, the page ends with the safety pledge from onboarding, as a reminder with nothing to tick
      because the member agreed to it at onboarding ("apps/mobile/app/info/safety.tsx"); someone signed out has agreed to nothing
  look
    Under the title, the lede in font.body, type.body, color.text.secondary.
    The emergency note: white (color.surface) with border.control color.danger, radius.lg, a phone icon in color.danger, the text in type.small.text, 700, color.text.
    "Before you go" and "At the meetup": white cards (border.hairline color.border, radius.card, padding space.card), the heading in type.body.small, 700, color.text,
      each tip a size.badge Paper disc (color.page) with a check (or a no-entry sign for the home address) in color.text.secondary and the tip in type.body.small, color.text.
    Signed in, "Our safety pledge": a white card with a shield in color.text before its heading, and the pledge in type.small.text, color.text.secondary.
  copy
    info.safety.title           "Meeting safely"   da "Mød hinanden trygt"
    info.safety.lede            "A few habits that keep every meetup comfortable."   da "Et par gode vaner, så alle føler sig godt tilpas, når I mødes."
    info.safety.emergency       "In danger right now? Call 112."   da "I fare lige nu? Ring 112."
    info.safety.beforeTitle     "Before you go"   da "Inden mødet"
    info.safety.tips.public     "Meet in a public place in daytime or early evening."   da "Mød hinanden på et offentligt sted om dagen eller tidligt på aftenen."
    info.safety.tips.transport  "Arrange your own transport."   da "Sørg selv for transport."
    info.safety.tips.tellFriend "Tell a friend where you are going."   da "Fortæl en ven, hvor du skal hen."
    info.safety.tips.address    "Never share your home address."   da "Del aldrig din hjemadresse."
    info.safety.atTitle         "At the meetup"   da "Under mødet"
    info.safety.tips.leave      "You can leave at any time."   da "Du kan altid gå."
    info.safety.tips.drink      "Drink only if you want to, and at your own pace."   da "Drik kun, hvis du har lyst, og i dit eget tempo."
    info.safety.tips.report     "Use Report in the pod if something feels wrong."   da "Brug Anmeld i poden, hvis noget føles forkert."
    onboarding.final.pledgeTitle "Our safety pledge"   da "Vores sikkerhedsløfte"
    onboarding.final.pledge     "I'll meet in public places, treat people with respect, and use Report if something feels wrong."   da "Jeg mødes på offentlige steder, behandler andre med respekt og bruger Anmeld, hvis noget føles forkert."
  binds
    props    signedIn: boolean
    role     the title, Before you go, At the meetup and Our safety pledge are headings; the page has no links
  sources
    Code: "apps/mobile/app/info/safety.tsx", "apps/mobile/src/features/shell/parts.tsx", "apps/mobile/src/components/Card.tsx" (the safety note), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json", "apps/mobile/src/i18n/en/onboarding.json"
    Design: DESIGN §4.5 (safety tips), §3.7 (call 112)
    Screens: driven in the web preview (app-info-safety, world this-week; and signed-out) on 27 November 2026, in English and Danish
```
