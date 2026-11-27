# Birth date

The date of birth on About you: three fields, checked on the phone. Only the
birth year is ever kept (by the server).

```ail
node BirthDate : view   level: experience
  why   Friendpod is for adults, and pods match people of similar ages; the
        phone checks the date so only the birth year needs to leave it
        (DESIGN §3.1 step 4, PRIVACY P2).                                     <- AboutYou
  what
    Scenario: A date that does not exist is refused
      Given a new member on About you with the first name Emil and the Terms ticked
      When they enter the birth date 31 02 1991
      Then the step says That is not a valid date.
      And Continue cannot be pressed

    Scenario: Someone under 18 is told, and may still continue
      Given today is 4 November 2026
      And a new member on About you with the first name Emil and the Terms ticked
      When they enter the birth date 05 11 2008, a day short of 18
      Then the step says Friendpod is only for people aged 18 and over.
      And Continue can still be pressed

    Scenario: Turning 18 today is old enough
      Given today is 4 November 2026
      And a new member on About you
      When they enter the birth date 04 11 2008
      Then no message is shown about the birth date

  how
    decide three fields, day, month and year, checked once all three are filled and the year has four characters
      because the storyboard draws Day, Month and Year with sub-labels, and a date is only worth checking once it is whole (about.tsx)
    decide a birth date under 18 shows its message but does not stop Continue
      because the server repeats the check and is authoritative: it deletes the sign-in, answers that the person is under 18, and keeps 30-day markers so a retry gets the same answer (DESIGN §3.1 step 6; about.tsx)
      because "unknown, confirm with the owner: should Continue stay possible while the step already says the person is too young?"
    decide a year such as 0199 is taken as a real birth year, of someone far over 18
      because "unknown, confirm with the owner: keep it, or refuse years before, say, 1900?"
    decide letters typed into the day, month or year show no message; Continue just stays unavailable
      because "unknown, confirm with the owner: the fields ask for a number pad on phones, but nothing refuses letters"
  look
    Under the first name: the label "Date of birth" (type.label, 700, color.text), then Day, Month and Year sub-labels
      (type.caption, 600, color.text.muted) 6px over three equal size.input white (color.surface) inputs, space.dob apart,
      each with a border.field color.field border and radius.input.
    The help text under them in type.small, color.text.secondary; a date message under the help in type.small, 700, color.danger.
  copy
    onboarding.about.dob         "Date of birth"                                     da "Fødselsdato"
    onboarding.about.day         "Day"                                               da "Dag"
    onboarding.about.month       "Month"                                             da "Måned"
    onboarding.about.year        "Year"                                              da "År"
    onboarding.about.dobHelp     "We check that you're 18 or older, then keep only your birth year, to match people of similar ages."   da "Vi tjekker, at du er fyldt 18, og gemmer derefter kun dit fødselsår, så vi kan matche dig med folk på din alder."
    onboarding.about.dobInvalid  "That is not a valid date."                         da "Det er ikke en gyldig dato."
    onboarding.about.underage    "Friendpod is only for people aged 18 and over."    da "Friendpod er kun for personer på 18 år og derover."
  binds
    state    day: text, month: text, year: text, starting at the draft's birth date split into its parts, or ""
    fields   day and month take at most 2 characters and the year 4, on a number pad; each field is labelled "Date of birth, Day", "Date of birth, Month" or "Date of birth, Year"
    shows    the date message when all three are typed, the year has four characters and birthDateFrom(day, month, year) is nothing; else the under-18 message when isAdult(that date, now) is false
  uses AboutYouRules
  sources
    Code: "apps/mobile/app/(onboarding)/about.tsx", "apps/mobile/src/features/onboarding/dob.ts"
    Design: DESIGN §3.1 steps 4 and 6; PRIVACY P2 and the under-18 markers
    Screens: driven in the web preview, world onboarding-start (4 November 2026 19:55), on 27 November 2026
```
