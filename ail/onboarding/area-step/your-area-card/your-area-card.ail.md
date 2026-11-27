# Your area card

The white card on step 2 once there is an area: the district, whether Friendpod runs there, a drawing of the cell,
and what is stored.

```ail
node YourAreaCard : view   level: experience
  why   A member sees exactly what leaves the phone, an area and never an address, and whether
        Friendpod runs there yet (DESIGN §3.1 step 6, PRIVACY P2).                              <- AreaStep
  what
    The name is the postcode's district (Aarhus C); after the approximate location it is the launch area's name, or Near you outside every launch area.
    The pill says the launch area's state, from the app's own bundled list of launch areas: Aarhus is live, Aarhus opens soon (with the city's name),
      or Not open here yet outside every launch area, which also adds You can still sign up; we'll tell you when we open near you.

    Scenario: A postcode in another launch city
      Given a new member on Where do you live? after About you
      When they enter the postcode 5000
      Then Your area shows Odense C with Odense opens soon
      And it says We store only this area, never your address or exact location. Nobody is ever shown how far away you live.

    Scenario: A postcode outside every launch area
      Given a new member on Where do you live? after About you
      When they enter the postcode 9990
      Then Your area shows Skagen with Not open here yet
      And it says You can still sign up; we'll tell you when we open near you. before what is stored

    Scenario: The card in Danish
      Given a new member whose app is in Danish, on Hvor bor du? after Om dig
      When they enter the postcode 2100
      Then Dit område shows København Ø with København åbner snart

  how
    decide the state comes from the launch areas bundled in the app, not from the server
      because the area's record on the server can only be read after onboarding ("apps/mobile/src/features/onboarding/AreaCard.tsx")
    decide every launch city reads opens soon today, though the storyboard draws Aarhus is live
      because the bundled list has every launch area on the waitlist ("apps/mobile/preview/screens.json", onb-area)
    decide live is the ink pill with a check; opens soon and not open are quiet outline pills, never the needs-you yellow
      because there is nothing for the member to do ("apps/mobile/src/features/onboarding/AreaCard.tsx")
    decide the district is shown but never stored or sent
      because only the cell leaves the phone (DESIGN §3.1 step 6; "apps/mobile/app/(onboarding)/area.tsx")
  look
    A white card (color.surface), radius.card, padding space.card, labelled "Your area".
    Top row: "Your area" in type.caption, 600, color.text.muted over the name in type.card.title, 800, color.text; the pill on the right, radius.pill, size.tag tall:
      live is color.ink with color.on.ink text and a check; opens soon has a clock, and not open no icon, both with a border.control color.border.strong outline and color.text.
    A 104px map, as wide as the card's content, radius.md: color.separator crossed by white streets, the cell a 104 by 72 outline in border.strong color.text.secondary with a 12px radius, no fill. Decorative: hidden from screen readers.
    The note under it in type.caption, color.text.secondary.
  copy
    onboarding.area.yourArea     "Your area"           da "Dit område"
    onboarding.area.nearYou      "Near you"            da "Tæt på dig"
    onboarding.area.live         "{{city}} is live"    da "Åben i {{city}}"
    onboarding.area.opensSoon    "{{city}} opens soon" da "{{city}} åbner snart"
    onboarding.area.notOpen      "Not open here yet"   da "Ikke åben her endnu"
    onboarding.area.storedNote   "We store only this area, never your address or exact location. Nobody is ever shown how far away you live."   da "Vi gemmer kun det her område – aldrig din adresse eller præcise placering. Ingen får nogensinde at se, hvor langt væk du bor."
    onboarding.area.outsideHint  "You can still sign up; we'll tell you when we open near you."   da "Du kan stadig tilmelde dig. Vi giver besked, når vi åbner i nærheden af dig."
  binds
    route    "/about" (the area card on Where do you live?, reached with Continue on About you)
    props    name: text, area: { label: text, status: "live" | "waitlist" | "beta" } or nothing
  sources
    Code: "apps/mobile/src/features/onboarding/AreaCard.tsx", "apps/mobile/app/(onboarding)/area.tsx", "packages/core/src/geo/areas.ts", "packages/core/src/geo/areas.json"
    Design: DESIGN §3.1 step 6, §6.4
    Screens: "apps/mobile/preview/screens.json" onb-area; driven in the web preview, world onboarding-start, postcodes 8000, 5000, 2100, 9990 and 0000, in English and Danish, on 27 November 2026
```
