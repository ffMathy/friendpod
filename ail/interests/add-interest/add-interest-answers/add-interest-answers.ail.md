# What the server answers

What the Interests tab shows once the server has decided about an interest the
phone let through. The web preview's server adds every text it is sent and
never answers any of these, so none of them can be played there yet: they come
from the app's code and the server's.

```ail
node AddInterestAnswers : view   level: experience
  why   The server repeats every check and is the only one that knows what a member already holds,
        the limits, the blocklist and the words other members use (DESIGN §5.2 (1)–(6)).   <- AddInterest
  what
    An interest the member already holds, in any wording that tidies to the same text, is not added again: You already have this interest.
    A member who holds 20 interests, private ones included, is told You have reached 20 interests. Remove one to add another.
    A text on the blocklist is refused: This interest isn't allowed on Friendpod.
    A text about someone else (my son's …, min datters …) that the phone does not find sensitive is added, with Added. Please only add interests about yourself.
    With consent to private interests, a text the phone finds sensitive is saved as a private interest without asking, and shows in the private card.
    At most 3 private interests can be added in a week: You can add at most 3 sensitive interests per week.
    When the server refuses a sensitive text for want of consent, the message says it was not saved, never that nothing was sent.
    When the server knows the interest by another word, Did you mean asks in place of Added., and the new interest's dot is dashed until it is answered:
      Yes, same thing joins it to that word, No, keep it keeps the member's own, and either one closes the question and the message.
    When the server cannot be reached, the tab shows the app's error message for it under the add row.

  how
    decide every outcome is one message under the add row, from the reason the server gives
      because rejections at input time are shown as a statement of reasons from the reason code, and nothing is stored (DESIGN §5.2 (2), DSA Art. 17)
    decide a text about someone else is refused only when it is sensitive, and only warned about otherwise
      because a member's own consent cannot cover a family member's sensitive data (PRIVACY §4.3, DESIGN §5.2 (2))
    decide Did you mean replaces Added. and leaves the interest's colour open until answered
      because the interest has no settled meaning until then ("apps/mobile/src/features/interests/InterestManager.tsx": "no settled concept yet and is drawn dashed")
    decide saying yes is suggested because it puts the member with more people
      because the message itself gives that reason (the interests copy)
  look
    The same white note as every other message, under the add row.
    Did you mean: a white note with the needs-you marker (color.needs.you, a border.control color.ink ring) at the start of its first line, in type.small.text, color.text,
      the suggested word in 700; under it Yes, same thing (color.primary, color.on.primary) beside No, keep it (color.surface, a border.control color.border.strong border),
      both size.button.small tall with radius.pill.
  copy
    interests.duplicate           "You already have this interest."       da "Den interesse har du allerede."
    interests.limit               "You have reached 20 interests. Remove one to add another."   da "Du har nået 20 interesser. Fjern en for at tilføje en ny."
    interests.thirdPartyWarning   "Added. Please only add interests about yourself."   da "Tilføjet. Tilføj kun interesser om dig selv."
    moderation.BLOCKLIST          "This interest isn't allowed on Friendpod."   da "Denne interesse er ikke tilladt på Friendpod."
    moderation.SENSITIVE_ADD_LIMIT   "You can add at most 3 sensitive interests per week."   da "Du kan højst tilføje 3 følsomme interesser om ugen."
    moderation.SENSITIVE_UNAVAILABLE   "Sensitive interests can't be added yet."   da "Følsomme interesser kan ikke tilføjes endnu."
    moderation.INTEREST_LIMIT     "You have reached 20 interests."        da "Du har nået 20 interesser."
    moderation.ART9_CONSENT_REQUIRED_SERVER   "This interest may be sensitive, so we only save it if you've agreed to sensitive interests. We didn't save it. You can give consent in Settings → Privacy."   da "Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. Vi gemte den ikke. Du kan give samtykke under Indstillinger → Privatliv."
    interests.didYouMean          "Did you mean <b>{{label}}</b> by “{{typed}}”? Saying yes puts you with more people."   da "Mente du <b>{{label}}</b> med »{{typed}}«? Siger du ja, kan vi matche dig med flere."
    interests.useSuggestion       "Yes, same thing"                       da "Ja, samme ting"
    interests.keepOwnWording      "No, keep it"                           da "Nej, behold den"
  binds
    shows    the message for the server's answer: added (or added with the third-party warning), duplicate, limit, or rejected with its reason
    events   Yes, same thing confirms the suggested word for the new interest; No, keep it only closes the question
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (the answers and their messages), "apps/mobile/src/features/interests/parts.tsx" (the Did you mean note), "functions/src/interests/pipeline.ts", "functions/src/interests/persist.ts"
    Design: DESIGN §5.2 (1)–(6), A21; PRIVACY §4.3
    Preview: "apps/mobile/preview/runtime/callables.ts" adds every text; only the onboarding world answers Did you mean
```
