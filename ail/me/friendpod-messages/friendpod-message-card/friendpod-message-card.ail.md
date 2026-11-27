# A message from Friendpod

One message on Messages from Friendpod: an icon, when it was sent, a short
title and the text, all made on the phone from the message's code and its
dates; plus, by kind, the 112 line, the "decided automatically" note, or the
data download.

```ail
node FriendpodMessageCard : view   level: experience
  why   The server sends only a code and dates, never wording, so a message can be read in the member's
        own language and never carries someone else's text (DESIGN §5.2, §8.1 notices).   <- FriendpodMessages
  what
    Scenario: A safety report's receipt adds the 112 line
      Given a member with messages from Friendpod
      When Messages from Friendpod opens
      Then Thanks for your report says We've received your report. The person you reported won't find out who reported them.
      And under it, as an alert, In danger right now? Call 112.

    Scenario: An automated pause says it was decided automatically
      Given a member with messages from Friendpod
      When Messages from Friendpod opens
      Then Matching paused says You are paused from drops until Mon 26 Oct, 09:00 because you missed meetups without cancelling.
        When you're back, we'll ask you to commit to showing up.
      And under it This was decided automatically; no person reviewed it. The pause ends on its own. and Questions? Write to privacy@friendpod.example.

    Scenario: Ready data can be downloaded from its message
      Given a member with messages from Friendpod, whose data export is ready
      When Messages from Friendpod opens
      Then Your Friendpod data says Your data is ready to download. The file is deleted within 48 hours.
      And it offers Download the file

    Scenario: A download that does not work says so
      Given a member with messages from Friendpod, on a phone where the download does not work
      When they press Download the file
      Then the message says The download didn't work. Try again.

  how
    decide the icon sits on a quiet disc, with no alarm colour and no pod colour; the hold on private-interest pods gets the quiet private disc with a lock
      because a pause is a calm fact about the account, and a message belongs to no pod ("apps/mobile/src/features/notices/NoticeCard.tsx")
    decide a statement of reasons adds that it was decided automatically, with no human review, and where to write; it is never a review channel
      because of DSA Art. 17 statements of reasons (DESIGN §3.7, §5.2; PRIVACY §13); the address is a placeholder until the company domain is fixed ("apps/mobile/src/lib/support.ts")
    decide a safety report's receipt adds "In danger right now? Call 112."
      because it repeats after-report's safety alert ("apps/mobile/src/features/notices/NoticeCard.tsx")
    decide "your data is ready" offers the download while the file exists, and otherwise says it is gone and how to ask again
      because the file is kept for about a day and deleted within 48 hours (DESIGN §3.9)
    decide a code this version of the app does not know shows Message from Friendpod and asks to update the app
      because a newer server may send codes an older app cannot word ("apps/mobile/src/features/notices/NoticeCard.tsx")
  look
    A white card (color.surface, border.hairline color.border, radius.card, padding space.card), parts 12px apart. Its top row, 12px apart: a 32px color.page disc with a
      color.text.secondary icon (pause, lock on a color.private.bg disc with a color.private.border ring, check, flag, people, download or clock), then the time in type.caption, color.text.muted,
      the title in type.label, 700, color.text, and the text in type.small.text, color.text.
    The 112 line: a safety note (color.surface, border.control color.danger, radius.lg) with a color.danger phone icon and the text in type.small.text, color.text.
    The automated note: a color.page note (radius.md) with an info icon and its two lines in type.caption, color.text.secondary.
    Download the file: a small white secondary button with a download icon, lined up with the text; a gone file's line in type.caption, color.text.muted.
  copy
    notices.titles.PAUSE_NO_SHOW      "Matching paused"            da "Matchning sat på pause"
    notices.titles.SUSPENSION_NO_SHOW "Matching suspended"         da "Udelukket fra drops"
    notices.titles.SENSITIVE_HOLD_NOT_GENUINE "Pods about private interests paused"   da "Pods om private interesser er sat på pause"
    notices.titles.SANCTION_ENDED     "Welcome back"               da "Velkommen tilbage"
    notices.titles.REPORT_RECEIVED    "Thanks for your report"     da "Tak for din anmeldelse"
    notices.titles.POD_MEMBER_LEFT    "Your pod changed"           da "Din pod er ændret"
    notices.titles.EXPORT_READY       "Your Friendpod data"        da "Dine Friendpod-data"
    notices.titles.INACTIVITY_WARNING "Keep your account?"         da "Vil du beholde din konto?"
    notices.codes.PAUSE_NO_SHOW       "You are paused from drops until {{until}} because you missed meetups without cancelling. When you're back, we'll ask you to commit to showing up."   da "Du er sat på pause fra drops indtil {{until}}, fordi du er udeblevet fra møder uden at melde afbud. Når du er tilbage, beder vi dig love at møde op."
    notices.codes.SANCTION_ENDED      "Your pause has ended. You can be matched again from the next drop."   da "Din pause er slut. Du kan blive matchet igen fra næste drop."
    notices.codes.REPORT_RECEIVED     "We've received your report. The person you reported won't find out who reported them."   da "Vi har modtaget din anmeldelse. Den, du har anmeldt, får ikke at vide, hvem der anmeldte."
    notices.codes.POD_MEMBER_LEFT     "A member left one of your pods."   da "Et medlem har forladt en af dine pods."
    notices.codes.EXPORT_READY        "Your data is ready to download. The file is deleted within 48 hours."   da "Dine data er klar til download. Filen slettes inden for 48 timer."
    notices.automated   "This was decided automatically; no person reviewed it. The pause ends on its own."   da "Det blev afgjort automatisk, uden at et menneske har set på det. Pausen slutter af sig selv."
    notices.contact     "Questions? Write to {{email}}."   da "Spørgsmål? Skriv til {{email}}."
    notices.exportGone  "This file is no longer available. You can ask for a new one in Settings → Privacy."   da "Filen er ikke længere tilgængelig. Du kan bede om en ny under Indstillinger → Privatliv."
    notices.unknownTitle  "Message from Friendpod"   da "Besked fra Friendpod"
    notices.unknown     "You have a message from Friendpod. Update the app to read it."   da "Du har en besked fra Friendpod. Opdatér appen for at læse den."
    report.danger       "In danger right now? Call 112."   da "I fare lige nu? Ring 112."
    settings.privacy.exportDownload        "Download the file"   da "Hent filen"
    settings.privacy.exportDownloadFailed  "The download didn't work. Try again."   da "Filen kunne ikke hentes. Prøv igen."
  binds
    props    message: { kind: "statementOfReasons" | "system", code: text, dates, the export it names, the report's category }, exportReady: boolean
    shows    the time sent and any date in the text as weekday, day, month and time in Copenhagen ("Mon 26 Oct, 09:00", "man. 26. okt., 09.00")
    events   Download the file fetches the export through the signed-in account and hands it to the phone's share sheet; a failure shows under the button
  sources
    Code: "apps/mobile/src/features/notices/NoticeCard.tsx", "apps/mobile/src/features/account/ExportStatus.tsx", "apps/mobile/src/lib/format.ts", "apps/mobile/src/lib/support.ts", "apps/mobile/src/i18n/en/shell.json"
    Design: DESIGN §3.7, §3.9, §5.2, §8.1; PRIVACY §13; the other codes (PAUSE_REPORTS, PAUSE_SAFETY_REPORT, PAUSE_UNDERAGE_REPORT, INACTIVITY_WARNING's text) are in "apps/mobile/src/i18n/en/shell.json"
    Screens: driven in the web preview on 27 November 2026, world me-notices, in English and Danish; the web preview cannot save a file, so a download always fails there
```
