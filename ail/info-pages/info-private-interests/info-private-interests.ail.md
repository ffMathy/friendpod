# Private interests (about)

What happens to an interest that says something sensitive: when it is saved,
where it is kept, who sees it, and how to change one's mind. Opened by Read
more on both consent screens, from Me's Good to know, and from a private pod
proposal.

```ail
node InfoPrivateInterests : view   level: experience
  why   Private interests are special category data that need explicit consent, so a member can read
        how they are protected before and after agreeing (PRIVACY §3).                 <- InfoPages
  what
    Scenario: The page says how private interests are protected
      Given a member this week, on Private interests
      Then the lede reads Some interests say more about you than others. This is how we look after them.
      And When you add an interest says such an interest is saved only with consent, kept private and used only as a pod's theme
      And the headings read What counts as private, Where we keep them, Who sees them and If you change your mind
      And Who sees them says Only people invited to a pod built around the interest, and only if they added it too.
      And the page ends We cannot verify who people are, so only share in a pod what you are comfortable with.

    Scenario: Private interests in Danish
      Given a member this week whose app is in Danish, on Private interests
      Then it reads Private interesser, Når du tilføjer en interesse, Hvad der tæller som privat, Hvor vi gemmer dem, Hvem der ser dem and Hvis du fortryder

  how
    decide the page calls them private interests, and says sensitive only where it names the consent or the legal category
      because the storyboards call these interests private ("apps/mobile/app/info/sensitive-interests.tsx")
    decide the note at the top says, in the page's own voice, what the standing notice at the interest field says, without its Tip and its pointer to Settings
      because the notice itself stays verbatim at the interest field, where it belongs (PRIVACY §3.2, "apps/mobile/app/info/sensitive-interests.tsx")
    decide the headed sections add only what the note leaves out, so each fact is said once
      because of the code's own reasoning ("apps/mobile/app/info/sensitive-interests.tsx")
    decide the page shows no consent text and nothing to tick
      because consent is given on its own screen with its fixed text (PRIVACY §3.1, §3.3); this page is information only
    decide the risk line is the last thing on the page
      because sign-up is unverified, and the residual risk is disclosed (PRIVACY §3.3; DESIGN A25)
  look
    Under the title, the lede in font.body, type.body, color.text.secondary.
    "When you add an interest": the private note, white (color.private.bg) with border.control color.private.border and radius.lg, a lock in color.text,
      the title in type.small.text, 700, color.text, the text in type.caption.text, color.text.secondary. Never a colour: private stays quiet.
    One white card (border.hairline color.border, radius.card, padding space.card) with four sections space.gap apart, each a heading in type.body.small, 700, color.text
      and 4px under it its text in type.small.text, color.text.
    Last, an info note (white, border.hairline color.border, radius.lg, an info icon) with the risk line in type.caption.text, color.text.secondary.
    The page has no links.
  copy
    info.sensitive.title            "Private interests"   da "Private interesser"
    info.sensitive.lede             "Some interests say more about you than others. This is how we look after them."   da "Nogle interesser siger mere om dig end andre. Sådan passer vi på dem."
    info.sensitive.noticeTitle      "When you add an interest"   da "Når du tilføjer en interesse"
    info.sensitive.notice           "If it says something about your health, beliefs, sexuality, politics, ethnic origin or union membership, we only save it if you have agreed to sensitive interests. We then keep it private and use it only as the theme of a pod. Only add things that are about you."   da "Siger den noget om dit helbred, din tro, din seksualitet, dine politiske holdninger, din etniske oprindelse eller dit fagforeningsmedlemskab, gemmer vi den kun, hvis du har sagt ja til følsomme interesser. Så holder vi den privat og bruger den kun som tema for en pod. Tilføj kun noget, der handler om dig selv."
    info.sensitive.headings.what    "What counts as private"   da "Hvad der tæller som privat"
    info.sensitive.what             "For example “pregnant”, “Ramadan” or “queer book club”. The law calls this special category data and asks for your explicit consent."   da "Fx »gravid«, »ramadan« eller »queer læseklub«. Loven kalder det særlige kategorier af personoplysninger og kræver dit udtrykkelige samtykke."
    info.sensitive.headings.where   "Where we keep them"   da "Hvor vi gemmer dem"
    info.sensitive.where            "On your account only, marked with a lock. They are never shown on any profile."   da "Kun på din konto, markeret med en hængelås. De vises aldrig på nogen profil."
    info.sensitive.headings.who     "Who sees them"   da "Hvem der ser dem"
    info.sensitive.who              "Only people invited to a pod built around the interest, and only if they added it too."   da "Kun dem, der er inviteret til en pod bygget op om interessen, og kun hvis de selv har tilføjet den."
    info.sensitive.headings.withdraw "If you change your mind"   da "Hvis du fortryder"
    info.sensitive.withdraw         "You can withdraw your consent at any time. We then delete all your private interests and take you out of pods built around them. To stop one interest only, remove it."   da "Du kan til enhver tid trække dit samtykke tilbage. Så sletter vi alle dine private interesser og tager dig ud af pods, der er bygget op om dem. Vil du kun stoppe én interesse, så fjern den."
    info.sensitive.risk             "We cannot verify who people are, so only share in a pod what you are comfortable with."   da "Vi kan ikke kontrollere, hvem folk er, så del kun det i en pod, som du er tryg ved."
  binds
    role     the title and the four section headings are headings
  sources
    Code: "apps/mobile/app/info/sensitive-interests.tsx", "apps/mobile/src/components/Card.tsx" (the private note), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: PRIVACY §1, §3.1–3.5 (one blanket consent, the standing notice, withdrawal), DESIGN §6.1 S5–S7, A25
    Screens: driven in the web preview (app-info-sensitive-interests, world this-week; and from onboarding-consent's Read more) on 27 November 2026, in English and Danish
```
