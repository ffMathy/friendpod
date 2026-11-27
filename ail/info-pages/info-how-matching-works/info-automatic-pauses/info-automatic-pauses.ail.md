# Automatic pauses

On How matching works: every automatic pause with its length, and what having
no human review means.

```ail
node InfoAutomaticPauses : view   level: experience
  why   Every automated pause is listed with its length, and the page says honestly what having no
        human review loses (DESIGN §3.7, PRIVACY §4.4 and §13).                         <- InfoHowMatchingWorks
  what
    Scenario: Every pause is listed with its length
      Given a member this week, on How matching works
      Then Automatic pauses lists, in this order:
        Two independent reports within 30 days, or one safety report: no drops for 28 days.
        A report marked “May be under 18”: no drops for 28 days. A new such report from another pod starts it again.
        Two missed meetups within 8 weeks: a 2-week pause. Three: no drops for 8 weeks.
        A report marked “Not a genuine member”: no pods about private interests for 28 days.
      And under No person reviews these decisions it says Nobody reads reports or what's written in them, and nobody is banned for good.

    Scenario: The pauses in Danish
      Given a member this week whose app is in Danish, on How matching works
      Then Automatiske pauser lists To udeblivelser inden for 8 uger: 2 ugers pause. Tre: ingen drops i 8 uger.
      And the report reasons read »Kan være under 18« and »Ikke et ægte medlem«
      And the last card is headed Ingen mennesker gennemgår afgørelserne

  how
    decide the numbers are the ones the server applies: reports within 30 days, a 28-day pause, the under-18 pause of 28 days, no-shows within 8 weeks, a 2-week pause and an 8-week suspension, the 28-day hold on private-interest pods
      because the page reads the same constants the server applies, so it cannot drift ("apps/mobile/app/info/how-matching-works.tsx"; DESIGN §3.7, §4.4, §6.1 S7)
    decide the two report reasons are quoted with the report sheet's own labels
      because the rule then names the button that was pressed ("apps/mobile/app/info/how-matching-works.tsx")
    decide the page says no person reviews these decisions, and that data protection rights still go to the privacy team
      because human review was removed (founder decision D2), and PRIVACY §4.4 and §13 ask the page to say what that loses; GDPR rights remain a legal duty
  look
    "Automatic pauses": a white card (color.surface, border.hairline color.border, radius.card, padding space.card) with its heading in type.body.small, 700, color.text,
      the explanation in type.small.text, color.text.secondary, then one bullet per pause: a size.badge Paper disc with a pause icon in color.text.secondary and the text in type.body.small, color.text.
    "No person reviews these decisions": a white card with the heading and two paragraphs in type.small.text, color.text, 8px apart.
  copy
    info.howMatchingWorks.pausesTitle           "Automatic pauses"   da "Automatiske pauser"
    info.howMatchingWorks.pauses                "Some pauses happen automatically, by fixed rules. Each comes with an explanation in Messages from Friendpod and ends by itself."   da "Nogle pauser sker automatisk efter faste regler. Hver pause kommer med en forklaring i Beskeder fra Friendpod og slutter af sig selv."
    info.howMatchingWorks.pauseList.reports     "Two independent reports within {{window}} days, or one safety report: no drops for {{days}} days."   da "To uafhængige anmeldelser inden for {{window}} dage eller én sikkerhedsanmeldelse: ingen drops i {{days}} dage."
    info.howMatchingWorks.pauseList.underage    "A report marked “{{reason}}”: no drops for {{days}} days. A new such report from another pod starts it again."   da "En anmeldelse med begrundelsen »{{reason}}«: ingen drops i {{days}} dage. En ny anmeldelse af samme slags fra en anden pod starter pausen forfra."
    info.howMatchingWorks.pauseList.noShow      "Two missed meetups within {{window}} weeks: a {{weeks}}-week pause. Three: no drops for {{suspension}} weeks."   da "To udeblivelser inden for {{window}} uger: {{weeks}} ugers pause. Tre: ingen drops i {{suspension}} uger."
    info.howMatchingWorks.pauseList.notGenuine  "A report marked “{{reason}}”: no pods about private interests for {{days}} days."   da "En anmeldelse med begrundelsen »{{reason}}«: ingen pods om private interesser i {{days}} dage."
    report.categories.underage                  "May be under 18"   da "Kan være under 18"
    report.categories.notGenuine                "Not a genuine member"   da "Ikke et ægte medlem"
    info.howMatchingWorks.reviewTitle           "No person reviews these decisions"   da "Ingen mennesker gennemgår afgørelserne"
    info.howMatchingWorks.noReview              "Nobody reads reports or what's written in them, and nobody is banned for good. A pause can't be appealed: if it was wrong, it simply runs out."   da "Ingen læser anmeldelser eller det, der står i dem, og ingen bliver udelukket for altid. En pause kan ikke ankes: Er den forkert, udløber den bare."
    info.howMatchingWorks.humanReview           "You can still use your data protection rights by contacting our privacy team (see the privacy notice)."   da "Du kan stadig bruge dine rettigheder efter databeskyttelsesreglerne ved at kontakte vores privatlivsteam (se privatlivserklæringen)."
  binds
    route    "/info/how-matching-works" (the automatic pauses on How matching works)
    props    reportWindowDays: integer (30), reportPauseDays: integer (28), underagePauseDays: integer (28), noShowWindowWeeks: integer (8),
             noShowPauseWeeks: integer (2), noShowSuspensionWeeks: integer (8), privateHoldDays: integer (28)
  sources
    Code: "apps/mobile/app/info/how-matching-works.tsx" (the pause list and its constants), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json", "apps/mobile/src/i18n/en/after.json" (report reasons)
    Design: DESIGN §3.7 (automated pauses, what is lost without review), §4.4 (no-show), §6.1 S7; PRIVACY §4.4, §13
    Screens: driven in the web preview (world this-week) on 27 November 2026, in English and Danish
```
