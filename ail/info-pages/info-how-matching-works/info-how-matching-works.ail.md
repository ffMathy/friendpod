# How matching works

The page that says what decides who a member meets: what is used, what never
is, the rules for private interests, every automatic pause (a child), and that
matching can be paused. Opened from Me, This week, Why this pod and Privacy.

```ail
node InfoHowMatchingWorks : view   level: experience
  why   Pods are formed by automated profiling, so the page discloses its inputs, what it never uses,
        and the rules for private interests (PRIVACY §4.4, transparency under GDPR Art. 13).   <- InfoPages
  what
    Scenario: The page says what is used and what never is
      Given a member this week, on How matching works
      Then the lede reads Every Thursday we put together pods of 4–6 people near you who share an interest.
      And What we use lists Your interests, Your approximate area (a map cell), Your birth year and the age range you chose,
        How far you'll travel, your meetup languages and when you're free, and How reliably you show up
      And it says Meet again answers let a pair be matched again after 4 weeks
      And What we never use names photos, About me and anything inferred, and gender only for same-gender pods
      And Private interests says they are used only with consent, only as a pod's theme, after 14 days and a meetup

    Scenario: How matching works in Danish
      Given a member this week whose app is in Danish, on How matching works
      Then it reads Sådan matcher vi, Det bruger vi, Det bruger vi aldrig, Private interesser and Sæt matchning på pause
      And the Meet again line says efter 4 uger

  how
    decide what is used is shown as ticks, with Meet again as a people bullet after them
      because the page reuses drop-why's disc bullets, and Meet again is an effect on matching, not an input ("apps/mobile/app/info/how-matching-works.tsx")
    decide what is never used and the private-interest rules are notes, the latter in the quiet private note
      because private stays quiet, never a colour ("apps/mobile/app/info/how-matching-works.tsx"); PRIVACY §4.4 lists both
    decide the Meet again period comes from the launch matching profile, 4 weeks today
      because the page reads the same value the matcher applies (DESIGN §6.1 H5, "apps/mobile/app/info/how-matching-works.tsx")
    decide the 14 days and the one meetup in the private-interest note are written into the text, not read from the rules
      because "unknown, confirm with the owner: should the 14 days and one attended meetup follow the matcher's rule (DESIGN §6.1 S5) like the pauses do, rather than being fixed in the text?"
    decide no pod colour on the page
      because the page is about every pod ("apps/mobile/app/info/how-matching-works.tsx")
  look
    Under the title, the lede in font.body, type.body, color.text.secondary.
    "What we use": a white card (color.surface, border.hairline color.border, radius.card, padding space.card) with its heading in type.body.small, 700, color.text,
      then one bullet per input: a size.badge Paper disc (color.page) with a check in color.text.secondary and the text in type.body.small, color.text, 14px apart;
      Meet again last, with a people icon.
    "What we never use": an info note, white with border.hairline color.border and radius.lg, an info icon in color.text.secondary, the title in type.small.text, 700, color.text,
      the text in type.caption.text, color.text.secondary.
    "Private interests": the private note, white (color.private.bg) with border.control color.private.border and radius.lg, a lock in color.text, the same title and text styles.
    Then InfoAutomaticPauses. Last, signed in: a white list row (radius.card) with a pause icon, "Pause matching" in type.body, 700, the sentence under it in type.caption.text, color.text.muted, and a chevron;
      signed out: the same sentence in an info note with a pause icon.
  copy
    info.howMatchingWorks.title          "How matching works"   da "Sådan matcher vi"
    info.howMatchingWorks.intro          "Every Thursday we put together pods of 4–6 people near you who share an interest. This is what decides who you meet."   da "Hver torsdag sætter vi pods sammen med 4–6 personer nær dig, som deler en interesse. Her er, hvad der afgør, hvem du møder."
    info.howMatchingWorks.usedTitle      "What we use"   da "Det bruger vi"
    info.howMatchingWorks.used.interests "Your interests"   da "Dine interesser"
    info.howMatchingWorks.used.area      "Your approximate area (a map cell)"   da "Dit omtrentlige område (et felt på kortet)"
    info.howMatchingWorks.used.age       "Your birth year and the age range you chose"   da "Dit fødselsår og det aldersinterval, du har valgt"
    info.howMatchingWorks.used.prefs     "How far you'll travel, your meetup languages and when you're free"   da "Hvor langt du vil tage, hvilke sprog du kan mødes på, og hvornår du kan"
    info.howMatchingWorks.used.reliability "How reliably you show up"   da "Hvor stabilt du møder op"
    info.howMatchingWorks.meetAgain      "Your “Meet again” answers: if you both say yes, you can be matched again after {{weeks}} weeks; if either says no, never again. Nobody sees your answer."   da "Dine svar på »Ses igen«: Siger I begge ja, kan I blive matchet igen efter {{weeks}} uger. Siger en af jer nej, sker det aldrig igen. Ingen ser dit svar."
    info.howMatchingWorks.neverTitle     "What we never use"   da "Det bruger vi aldrig"
    info.howMatchingWorks.notUsed        "Photos, your “About me”, or anything we infer about you. We use your gender only if you have turned on “Same-gender pods only”."   da "Billeder, din »Om mig« eller noget, vi udleder om dig. Køn bruger vi kun, hvis du har slået »Kun pods med samme køn« til."
    info.howMatchingWorks.sensitiveTitle "Private interests"   da "Private interesser"
    info.howMatchingWorks.sensitive      "Private interests are only used if you have agreed to sensitive interests, only as the theme of a pod whose members all added them, and only after your account is 14 days old and you have attended a meetup."   da "Private interesser bruges kun, hvis du har sagt ja til følsomme interesser, kun som tema for en pod, hvor alle medlemmer har tilføjet dem, og først når din konto er 14 dage gammel, og du har været til et møde."
    info.howMatchingWorks.pauseLink      "Pause matching"   da "Sæt matchning på pause"
    info.howMatchingWorks.pause          "You can pause matching at any time."   da "Du kan altid sætte matchning på pause."
  binds
    props    signedIn: boolean, meetAgainWeeks: integer (4)
    role     the title and the two card headings are headings; signed in, Pause matching is a link
    events   Pause matching returns to Me
  uses InfoAutomaticPauses
  children InfoAutomaticPauses
  sources
    Code: "apps/mobile/app/info/how-matching-works.tsx", "apps/mobile/src/features/shell/parts.tsx", "apps/mobile/src/components/Card.tsx" (notes), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: PRIVACY §4.4 (what the page covers), DESIGN §6.1 H5 and S5, §11
    Screens: driven in the web preview (app-info-how-matching-works, world this-week; and signed-out) on 27 November 2026, in English and Danish
```
