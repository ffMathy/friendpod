# Waitlist share card

The card on the city waitlist that invites others: share the city's link, or copy it.

```ail
node WaitlistShareCard : view   level: experience
  why   Every person who joins brings the city's opening closer, so the waitlist offers the
        phone's share sheet and Copy link, with a link that names the city only (DESIGN F34,
        §3.1 step 13).                                                               <- CityWaitlist
  what
    Share invite link opens the phone's share sheet with a fixed text that names the city and ends with the link, titled Friendpod in the city.
    Closing the share sheet does nothing.
    Copy puts the link on the clipboard and then reads Copied for as long as the screen is open.
    The link is shown without https://, on one line, shortened in the middle when it does not fit.

    Scenario: The share card for Odense
      Given a member in a city on the waitlist: Odense
      When Home opens
      Then it reads Help Odense open sooner and Know someone who'd like to meet new people? Every person who joins brings your first pod closer.
      And Share invite link, friendpod.dk/c/odense and Copy

  how
    decide the link is friendpod.dk/c/ and the city's id, and carries nothing about who shared it
      because no referral code, no user id, nothing to track who shared it (DESIGN F34)
    decide the brand domain, not the Hosting domain
      because the Hosting domain looks untrustworthy and off-brand in a share message, and is too long to sit on one line beside Copy ("apps/mobile/src/features/waitlist/cityLink.ts")
    decide the domain is friendpod.dk for now
      because "unknown, confirm with the owner: friendpod.dk is a placeholder until the company domain is fixed, and must be added to the production Hosting site before launch (the city link's code comment); which domain is it?"
  look
    A white card (color.surface, radius.card, border.hairline color.border, padding space.card):
      "Help Odense open sooner" in type.card.title, 800; the text in type.small.text, line height 21px, color.text.secondary;
      a full-width size.button.medium color.primary pill with a share icon and "Share invite link" in type.button, color.on.primary;
      under it a size.input.compact color.inset field (radius.md, 14px side padding) with the link in type.body.small, color.text.secondary,
      8px from a white "Copy" button of the same height (radius.md, border.control color.border.strong, type.button, color.text).
  copy
    waitlist.shareTitle        "Help {{city}} open sooner"                da "Hjælp {{city}} med at åbne hurtigere"
    waitlist.shareBody         "Know someone who'd like to meet new people? Every person who joins brings your first pod closer."   da "Kender du nogen, der gerne vil møde nye mennesker? Hver ny tilmelding bringer din første pod tættere på."
    waitlist.share             "Share invite link"                        da "Del invitationslink"
    waitlist.shareSheetTitle   "Friendpod in {{city}}"                    da "Friendpod i {{city}}"
    waitlist.shareMessage      "Friendpod forms small groups of people near you around a shared interest. Join the waitlist for {{city}}: {{link}}"   da "Friendpod samler små grupper af folk tæt på dig om en fælles interesse. Skriv dig på ventelisten for {{city}}: {{link}}"
    waitlist.copy              "Copy"                                     da "Kopiér"
    waitlist.copyLink          "Copy invite link"                         da "Kopiér invitationslink"
    waitlist.copied            "Copied"                                   da "Kopieret"
  binds
    route    "/" (the share card on the city waitlist, on Home)
    props    city: text, the city's area id
    state    copied: boolean, starting at false
    role     the link field is read as the shown link; the Copy button is named waitlist.copyLink, and waitlist.copied once copied
    events   Share invite link opens the share sheet with waitlist.shareMessage, the link "https://friendpod.dk" followed by cityLinkPath(the area id), and the title waitlist.shareSheetTitle;
             Copy puts that link on the clipboard and sets copied
  uses CityWaitlistRules
  sources
    Code: "apps/mobile/src/features/waitlist/WaitlistScreen.tsx", "apps/mobile/src/features/waitlist/cityLink.ts", "apps/mobile/src/i18n/en/onboarding.json", "apps/mobile/src/i18n/da/onboarding.json"
    Design: DESIGN F34, §3.1 step 13
    Screens: driven in the web preview, world waitlist-odense, in English and Danish, on 27 November 2026; the share sheet is a fake there, so its text was read from the code
```
