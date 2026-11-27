# Interest rules

The text rules for an interest, shared by the phone and the server: how a typed
interest is tidied and how long it may be, which contact details are refused,
the possessive kinship pattern, and the blocklist. They live in
`packages/core/src/interests` today (normalize.ts, pii.ts, thirdParty.ts,
blocklist.ts); the server's `addInterests` repeats them, and the meetup chat and
"about me" reuse the contact patterns and the blocklist. Sensitivity itself is
the on-device model's (DESIGN F38), not a rule here.

```ail
node InterestRules : fn   level: system
  why   The phone refuses what the server would refuse, before anything is sent, and one copy of
        each rule serves both so they cannot drift (DESIGN §5.2 (0)–(2)).                     <- Interests
  what
    TAG_MIN_LENGTH: integer = 2
    TAG_MAX_LENGTH: integer = 40

    type NormalizeResult = { ok: true, norm: text, display: text } | { ok: false, code: "TAG_TOO_SHORT" | "TAG_TOO_LONG" }
    normalizeTag(text: text) -> NormalizeResult
      display: the text in Unicode NFKC with invisible format characters removed, each run of white space or control
      characters made one space, trimmed. norm: display with emoji removed, white space collapsed again, lower case,
      then punctuation other than # and & stripped from both ends (repeated until nothing changes). Diacritics stay.
      Its length in code points must be 2 to 40, else TAG_TOO_SHORT or TAG_TOO_LONG: refused, never cut.

    type PiiKind = "email" | "url" | "phone" | "handle" | "cpr"
    findPii(text: text) -> list of PiiKind
      The kinds of contact detail in the text (NFKC, lower case), in the order email, url, handle, cpr, phone:
      an email (also written with (at) and (dot)); a link (a scheme, www., or a domain on a list of common endings);
      an @handle, or a platform name followed by : or = and a handle; a CPR-like number (six digits whose first two
      are a day 1–31 and next two a month 1–12, then four more); else a phone number: 8 to 15 digits, a year range
      such as 1990-2000 excepted.
    containsPii(text: text) -> boolean — findPii(text) is not empty

    detectThirdParty(norm: text) -> { hit: boolean, matches: list of text }
      Each pair of a possessive (min, mit, mine, vores; my, our) followed by a kinship word (Danish with its genitive,
      definite and plural endings; English, singular or plural), apostrophe forms read as one word.

    isBlocklisted(norm: text, context: "tag" | "chat" = "tag") -> boolean
      True when a word, after leetspeak folding (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, @ a, $ s, € e), is a blocked word, or the
      words contain a blocked phrase. In "chat", escort and knald alone are allowed; only the phrases that use them are refused.

    examples
      normalizeTag("  Brætspil  ") => { ok: true, norm: "brætspil", display: "Brætspil" }
      normalizeTag("Board   Games") => { ok: true, norm: "board games", display: "Board Games" }
      normalizeTag("C++") => { ok: true, norm: "c++", display: "C++" }
      normalizeTag("D&D") => { ok: true, norm: "d&d", display: "D&D" }
      normalizeTag("¡Hola!") => { ok: true, norm: "hola", display: "¡Hola!" }
      normalizeTag("Sourdough 🍞") => { ok: true, norm: "sourdough", display: "Sourdough 🍞" }
      normalizeTag("ＦＵＬＬ") => { ok: true, norm: "full", display: "FULL" }
      normalizeTag("a") => { ok: false, code: "TAG_TOO_SHORT" }
      normalizeTag("🎲") => { ok: false, code: "TAG_TOO_SHORT" }
      normalizeTag("...!") => { ok: false, code: "TAG_TOO_SHORT" }
      normalizeTag("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") => { ok: true, norm: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", display: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
      normalizeTag("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") => { ok: false, code: "TAG_TOO_LONG" }
      findPii("call me 12345678") => ["phone"]
      findPii("+45 20 30 40 50") => ["phone"]
      findPii("insta: anna92") => ["handle"]
      findPii("www.x.dk") => ["url"]
      findPii("anna@x.dk") => ["email", "url"]
      findPii("anna (at) x (dot) dk") => ["email"]
      findPii("010190-1234") => ["cpr"]
      findPii("1990-2000") => []
      findPii("discord gaming") => []
      findPii("snap 2026") => []
      detectThirdParty("min datters diabetes") => { hit: true, matches: ["min datters"] }
      detectThirdParty("my son's autism") => { hit: true, matches: ["my sons"] }
      detectThirdParty("vores børns skole") => { hit: true, matches: ["vores børns"] }
      detectThirdParty("forælder til et barn med autisme") => { hit: false, matches: [] }
      detectThirdParty("parent of an autistic child") => { hit: false, matches: [] }
      isBlocklisted("escort") => true
      isBlocklisted("3sc0rt") => true
      isBlocklisted("sugar daddy") => true
      isBlocklisted("køb hash") => true
      isBlocklisted("hash") => false
      isBlocklisted("escort", "chat") => false
      isBlocklisted("søger knald", "chat") => true

  how
    decide 2 to 40 characters after tidying, refused rather than cut
      because shorter tags identify less (DESIGN A21, §5.2 (1) step 6: "Reject, never truncate")
    decide # and & survive at the ends ("C++" and "D&D"), and diacritics are never stripped
      because "får" is not "far" (DESIGN §5.2 (1))
    decide invisible format characters are removed too
      because they would let a word slip past the blocklist ("normalize.ts", marked as a deviation from DESIGN §5.2 (1))
    decide contact patterns are deliberately broad
      because a false positive costs a rewording, a miss leaks contact details into a pod ("pii.ts")
    decide the blocklist is phrases and a few words, not bare drug or illness words
      because those would also block recovery and support interests, which are core sensitive use cases ("blocklist.ts")
    decide the kinship pattern is not a sensitivity source; it only refuses a tag the model calls sensitive
      because a member's consent cannot cover a family member's sensitive data (DESIGN F38, PRIVACY §4.3)
  free [ helper names, the exact lists of platform names, kinship words, blocked words and phrases, as they are in "packages/core/src/interests" today ]
  sources
    Code: packages/core/src/interests/normalize.ts, pii.ts, thirdParty.ts, blocklist.ts; apps/mobile/src/features/interests/onDeviceCheck.ts
    Examples: run against the existing code on 27 November 2026 (npx tsx, from apps/mobile)
    Design: DESIGN §5.2 (0)–(2), A21, F38; PRIVACY §4.3
```
