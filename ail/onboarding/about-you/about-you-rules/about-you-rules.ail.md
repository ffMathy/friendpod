# About you: rules

Which first names and birth dates step 1 accepts. The first-name rule is
shared with the server (`firstNameSchema` in `packages/core`), which repeats
it in `completeOnboarding` and `updateProfile`.

```ail
node AboutYouRules : fn   level: system
  why   The phone refuses what the server would refuse, before anything is
        sent, so a mistake is shown at once.                                   <- AboutYou
  what
    MIN_AGE: integer = 18

    firstNameFrom(typed: text) -> text or nothing
      The first name as it is kept: Unicode NFC, each run of white space made one space, trimmed at both ends.
      It is something only when that has 1 to 30 characters (counted as code points), starts with a letter or a
      combining mark, and holds only letters, combining marks, spaces, apostrophes (' and ’), full stops and hyphens.

    birthDateFrom(day: text, month: text, year: text) -> text or nothing
      The birth date as "YYYY-MM-DD", or nothing. Nothing until all three are typed and the year has exactly four
      characters. Then day and month are padded with zeros to two characters, and the result is a birth date only
      when it is a real calendar date.

    ageOn(birthDate: text, today: time) -> integer
      Whole years from birthDate to today, in today's own calendar day: one less when today's month and day
      come before the birthday's.

    isAdult(birthDate: text, today: time) -> boolean — ageOn(birthDate, today) ≥ MIN_AGE

    examples
      firstNameFrom("Emil") => "Emil"
      firstNameFrom("  Emil  ") => "Emil"
      firstNameFrom("Emil  Bo") => "Emil Bo"
      firstNameFrom("Anne-Marie O’Brien") => "Anne-Marie O’Brien"
      firstNameFrom("D'Angelo") => "D'Angelo"
      firstNameFrom("J.") => "J."
      firstNameFrom("Æsa") => "Æsa"
      firstNameFrom("Emil2") => nothing
      firstNameFrom("-Emil") => nothing
      firstNameFrom("emil@x.dk") => nothing
      firstNameFrom(" ") => nothing
      firstNameFrom("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") => nothing
      birthDateFrom("14", "3", "1991") => "1991-03-14"
      birthDateFrom("29", "2", "2000") => "2000-02-29"
      birthDateFrom("29", "2", "2001") => nothing
      birthDateFrom("31", "2", "1991") => nothing
      birthDateFrom("0", "1", "1990") => nothing
      birthDateFrom("14", "13", "1990") => nothing
      birthDateFrom("14", "3", "199") => nothing
      birthDateFrom("14", "3", "0199") => "0199-03-14"
      birthDateFrom("ab", "3", "1991") => nothing
      birthDateFrom("", "3", "1991") => nothing
      ageOn("2008-11-04", 2026-11-04 19:55:00) => 18
      ageOn("2008-11-05", 2026-11-04 19:55:00) => 17
      ageOn("1991-03-14", 2026-11-04 19:55:00) => 35
      isAdult("2008-11-04", 2026-11-04 19:55:00) => true
      isAdult("2008-11-05", 2026-11-04 19:55:00) => false
      isAdult("0199-03-14", 2026-11-04 19:55:00) => true

    probes
      ageOn("2008-02-29", 2026-02-28 12:00:00)

  how
    decide the first-name rule is one rule for phone and server
      because the server repeats every check (DESIGN A7: every write is a callable with one validation layer), and the phone shows the same answer first
    decide only letters, marks, spaces, apostrophes, full stops and hyphens
      because a first name must never carry contact details (the message says "No contact details"; PRIVACY.md: first names only)
    decide 30 characters at most
      because "unknown, confirm with the owner: why 30?"
    decide the age is counted on the phone's own calendar day
      because the server repeats the check and is authoritative (dob.ts: "the server repeats this check")
    decide a year of four characters is enough, even 0199
      because "unknown, confirm with the owner"
  free [ helper names ]
  sources
    Code: packages/core/src/schemas/common.ts (firstNameSchema, ymdDateSchema), packages/core/src/schemas/profile.ts (MIN_AGE),
          apps/mobile/src/features/onboarding/dob.ts (composeDob, ageOn, isAdult), apps/mobile/app/(onboarding)/about.tsx (when the date is composed)
    Examples: run against the existing code on 2026-11-27 (firstNameSchema.safeParse, composeDob, ageOn, isAdult)
    Design: docs/DESIGN.md §3.1 steps 4–6, §2.2 A7
```
