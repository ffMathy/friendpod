# Where do you live? (step 2)

Step 2 of 6: the member's area, from a postcode or the phone's approximate location, turned into a cell of about
5 km on the phone. Continue sends everything from steps 1 and 2 at once. The area card and the source question are
children of their own.

```ail
node AreaStep : flow   level: experience
  why   Pods meet near home, so Friendpod needs to know roughly where a member lives, and nothing more
        precise: the phone keeps the postcode or the position to itself (DESIGN §3.1 step 6, PRIVACY P2).   <- Onboarding
  what
    The postcode field keeps digits only, at most four. Four digits the bundled postcode table knows show the area card;
      four it does not know say We don't know that postcode. Use my approximate location asks for the phone's coarse position.
    Continue can be pressed once there is an area. It sends the basics of step 1 with the area and the optional source,
      then opens step 3 in a fresh stack, so there is no way back; the birth date is then dropped from the phone.
    While it is sent Continue is busy. If the server answers that the person is under 18, the step says so, its button becomes
      OK, which signs out, and every answer is dropped from the phone; any other refusal shows its reason.

    Scenario: The step starts with no area and Continue waits
      Given a new member who entered the first name Emil, the birth date 14 03 1991 and ticked the Terms on About you
      When they press Continue
      Then it reads Step 2 of 6 and Where do you live?, with Back
      And the postcode is empty, no area card shows, and Continue cannot be pressed
      And it ends Postal code data: GeoNames (www.geonames.org)

    Scenario: A known postcode gives an area
      Given a new member on Where do you live? after About you
      When they enter the postcode 8000
      Then Your area shows Aarhus C with Aarhus opens soon
      And Continue can be pressed

    Scenario: An unknown postcode is refused
      Given a new member on Where do you live? after About you
      When they enter the postcode 0000
      Then the step says We don't know that postcode.
      And no area card shows, and Continue cannot be pressed

    Scenario: No approximate location
      Given a new member on Where do you live? after About you, whose phone gives no location
      When they press Use my approximate location
      Then the step says We could not get your approximate location. Use your postcode instead.

    Scenario: Continue sends the basics and opens step 3
      Given a new member on Where do you live? after About you, with the postcode 8000
      When they press Continue
      Then step 3 opens, reading Step 3 of 6 and Sensitive interests, with no Back

    Scenario: Opened directly, the step cannot be finished
      Given a new member who opens Where do you live? without going through About you, so there is no Back
      When they enter the postcode 8000 and press Continue
      Then the step stays, reading Where do you live?

    Scenario: The step in Danish
      Given a new member whose app is in Danish, on Hvor bor du? after Om dig
      When they enter the postcode 8000
      Then it reads Trin 2 af 6, Postnummer, and Dit område with Aarhus C and Aarhus åbner snart

  how
    decide the postcode or the position becomes a cell of about 5 km on the phone, and only the cell is sent
      because the server receives only the cell and the postcode or coordinates are discarded (DESIGN §3.1 step 6; "apps/mobile/src/features/onboarding/draft.tsx")
    decide the postcode is the default and needs no permission; the location asks only for the coarse one
      because DESIGN §3.1 step 6: postcode (default, no permission needed) or approximate location (coarse permission)
    decide Continue sends steps 1 and 2 together, once
      because the server checks the age, keeps only the birth year and creates the profile in one go (DESIGN §3.1 step 6, §10.1)
    decide an under-18 answer leaves only OK, which signs out
      because the server has already deleted the sign-in, so another attempt from this session must not be possible ("apps/mobile/app/(onboarding)/area.tsx"; DESIGN §3.1 step 6)
    decide opened without step 1's answers, Continue can be pressed but does nothing
      because "unknown, confirm with the owner: should the step send the member back to About you, rather than ignore Continue, when step 1's answers are missing?"
  look
    The onboarding header and title. The postcode field: label (type.label, 700, color.text) over a size.input white (color.surface) input,
      border.field color.field, radius.input; its message in type.small, 700, color.danger.
    "or" between two border.hairline color.border rules, in type.caption, 600, color.text.muted.
    Use my approximate location: a full-width secondary button, size.button tall, radius.pill, a pin icon, border.control color.border.strong, color.text; its message under it in color.danger.
    Then the area card, the source question, any refusal, and the postcode table's credit in type.micro, color.text.muted.
  copy
    onboarding.area.title            "Where do you live?"    da "Hvor bor du?"
    onboarding.area.lede             "Pods meet near home. Your phone turns this into an area of about 5 km before anything is sent."   da "Pods mødes tæt på, hvor man bor. Din telefon laver det om til et område på ca. 5 km, før noget bliver sendt."
    onboarding.area.postcode         "Postcode"              da "Postnummer"
    onboarding.area.unknownPostcode  "We don't know that postcode."   da "Det postnummer kender vi ikke."
    common.or                        "or"                    da "eller"
    onboarding.area.useLocation      "Use my approximate location"   da "Brug min omtrentlige placering"
    onboarding.area.locationFailed   "We could not get your approximate location. Use your postcode instead."   da "Vi kunne ikke finde din omtrentlige placering. Brug dit postnummer i stedet."
    onboarding.area.underage         "Friendpod is only for people aged 18 and over. We have deleted your sign-in and kept nothing else about you."   da "Friendpod er kun for personer på 18 år og derover. Vi har slettet dit login og gemmer intet andet om dig."
    onboarding.area.attribution      "Postal code data: {{source}}"   da "Postnummerdata: {{source}}"
    common.ok                        "OK"                    da "OK"
  binds
    state    postcode: text, starting at ""; district: text or nothing; locating: boolean; locationFailed: boolean; heardFrom: a source or nothing
    fields   the postcode is labelled "Postcode", on a number pad, at most 4 characters
    events   Continue sends the onboarding call with the draft's first name and birth date, the app's language, the cell, the legal versions and heardFrom when chosen
  uses YourAreaCard, HeardFromQuestion
  children YourAreaCard, HeardFromQuestion
  sources
    Code: "apps/mobile/app/(onboarding)/area.tsx", "apps/mobile/src/features/onboarding/draft.tsx", "packages/core/src/geo/postcode.ts", "packages/core/src/geo/dk-postcodes.json"
    Design: DESIGN §3.1 step 6, §10.1 (the onboarding call); PRIVACY P2
    Screens: "apps/mobile/preview/screens.json" onb-area; driven in the web preview, world onboarding-start, in English and Danish, on 27 November 2026 (Chromium gives the preview no position, so the location always fails there)
```
