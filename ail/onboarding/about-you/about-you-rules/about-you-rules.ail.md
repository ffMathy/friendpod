# About you: rules

Which first names and birth dates step 1 accepts. They are compiled into
`packages/core`, which the app and the server both use: the server's
`firstNameSchema` (`completeOnboarding`, `updateProfile`) is built on
`firstNameFrom`, and its `MIN_AGE` is this one.

```ail
node AboutYouRules : fn   level: system
  why   The phone refuses what the server would refuse, before anything is
        sent, so a mistake is shown at once.                                   <- AboutYou
  what
    MIN_AGE: integer = 18
    MAX_PLAUSIBLE_AGE: integer = 120

    firstNameFrom(typed: text) -> text or nothing
      The first name as it is kept: Unicode NFC, each run of white space made one space, trimmed at both ends.
      It is something only when that has at least 1 character, starts with a letter or a combining mark, and
      holds only letters, combining marks, spaces, apostrophes (' and ’), full stops and hyphens. There is no
      upper limit on its length.

    birthDateFrom(day: text, month: text, year: text) -> text or nothing
      The birth date as "YYYY-MM-DD", or nothing. Nothing until all three are typed and the year has exactly four
      characters. Then day and month are padded with zeros to two characters, and the result is a birth date only
      when it is a real calendar date.

    ageOn(birthDate: text, today: time) -> integer
      Whole years from birthDate to today, in today's own calendar day: one less when today's month and day
      come before the birthday's.

    isAdult(birthDate: text, today: time) -> boolean — ageOn(birthDate, today) ≥ MIN_AGE

    isPlausible(birthDate: text, today: time) -> boolean
      True when birthDate is not after today's calendar day and ageOn(birthDate, today) ≤ MAX_PLAUSIBLE_AGE.

    examples
      firstNameFrom("Emil") => "Emil"
      firstNameFrom("  Emil  ") => "Emil"
      firstNameFrom("Emil  Bo") => "Emil Bo"
      firstNameFrom("Anne-Marie O’Brien") => "Anne-Marie O’Brien"
      firstNameFrom("D'Angelo") => "D'Angelo"
      firstNameFrom("Emil2") => nothing
      firstNameFrom("-Emil") => nothing
      firstNameFrom("emil@x.dk") => nothing
      firstNameFrom(" ") => nothing
      firstNameFrom("") => nothing
      firstNameFrom("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") => "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      firstNameFrom("Maria Josefine Augusta Wilhelmine Charlotte") => "Maria Josefine Augusta Wilhelmine Charlotte"
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
      isPlausible("1991-03-14", 2026-11-04 19:55:00) => true
      isPlausible("2026-11-04", 2026-11-04 19:55:00) => true
      isPlausible("2026-11-05", 2026-11-04 19:55:00) => false
      isPlausible("1906-11-04", 2026-11-04 19:55:00) => true
      isPlausible("1905-11-04", 2026-11-04 19:55:00) => false
      isPlausible("1900-01-01", 2026-11-04 19:55:00) => false
      isPlausible("0199-03-14", 2026-11-04 19:55:00) => false

    probes
      ageOn("2008-02-29", 2026-02-28 12:00:00)

  how
    decide these rules are compiled into packages/core, and its firstNameSchema and MIN_AGE are built on them
      because the server repeats every check (DESIGN A7: every write is a callable with one validation layer), and one rule for phone and server cannot drift
      rejected compiling them into the app only, because the server's copy of the first-name rule would then be kept in step by hand
    decide only letters, marks, spaces, apostrophes, full stops and hyphens
      because a first name must never carry contact details (the message says "No contact details"; PRIVACY.md: first names only)
    decide no upper limit on a first name's length
      because the owner removed the 30-character limit, which had no recorded reason (27 November 2026)
    decide a birth date after today, or more than MAX_PLAUSIBLE_AGE years ago, is not plausible
      because the owner asked to refuse such dates (27 November 2026), and the server already rejects them as a typo, not an age (completeOnboarding, MAX_PLAUSIBLE_AGE = 120)
      rejected a fixed earliest year such as 1900, because it would drift from the server's rule as the years pass
    decide the age is counted on the phone's own calendar day
      because the server repeats the check in Copenhagen time and is authoritative (dob.ts: "the server repeats this check")
  free [ helper names ]
  sources
    Code: packages/core/src/schemas/common.ts (firstNameSchema, ymdDateSchema), packages/core/src/schemas/profile.ts (MIN_AGE),
          apps/mobile/src/features/onboarding/dob.ts (composeDob, ageOn, isAdult), apps/mobile/app/(onboarding)/about.tsx (when the date is composed),
          functions/src/callables/completeOnboarding.ts (MAX_PLAUSIBLE_AGE, future dates)
    Examples: run against the existing code on 27 November 2026 (firstNameSchema.safeParse, composeDob, ageOn, isAdult)
    Interview: the owner, 27 November 2026: refuse weird dates; remove the first-name limit
    Design: docs/DESIGN.md §3.1 steps 4–6, §2.2 A7
```
