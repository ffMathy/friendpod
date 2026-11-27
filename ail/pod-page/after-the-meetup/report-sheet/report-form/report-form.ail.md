# Report form

What the report sheet shows: its title, the 112 alert, the reasons, the
optional note and Send report.

```ail
node ReportForm : view   level: experience
  why   A calm, short form: safety first, one reason, an optional note that warns against sensitive
        details, and the promise that nobody learns who reported (DESIGN §3.7).          <- ReportSheet
  how
    decide the reasons are white rows with a radio, the chosen one outlined in Skov
      because the storyboard draws them so ("apps/mobile/preview/screens.json", after-report; "apps/mobile/src/features/after/parts.tsx")
    decide the title names the member when the pod still knows them, else Report a member; a suggestion or a message has its own title
      because a report names what it is about ("apps/mobile/app/sheets/report.tsx")
    decide the note's counter turns red at the limit, and the field takes no more
      because the note holds at most 500 characters (DESIGN §3.7; "apps/mobile/src/features/after/parts.tsx")
  look
    Paper page (color.page), side padding space.gutter.compact, blocks 14px apart, 32px above the title; no tab bar.
    Title row: the title in font.display, type.title.modal, 800, color.text, and the close cross (a size.hit target) at the right.
    The alert: white (color.surface), border.control color.danger, radius.lg, 12px by 14px padding, a color.danger phone icon,
      "In danger right now? Call 112." in type.small.text, 700, color.text.
    For a message, a note under it: white, border.hairline color.border, radius.lg, a color.text.secondary info icon and the copy text in type.caption.text, color.text.secondary.
    "What happened?" in type.label, 700, color.text, then the reasons 8px apart: white rows at least 48px tall, radius.lg, border.control color.border.strong,
      a 24px radio (border.control color.field) and the reason in type.body.small, color.text; the chosen one border.strong color.primary,
      its radio color.primary with a size.dot dot, its label type.label, 600.
    Tell us more: "Tell us more" in type.label, 700 with " (optional)" in 500, color.text.muted, and at the right "n / 500" in type.micro, 600, color.text.muted
      (color.danger at 500); 6px under it a three-line field (type.body, color.surface, border.control color.field, radius.md, 12px by 14px padding;
      border.strong color.link when focused), the placeholder in color.text.muted; under it the warning in type.caption, color.text.muted.
    Send report pinned at the bottom, 28px above the edge: full width, size.button tall, radius.pill, type.button 700, color.primary with color.on.primary,
      color.disabled with color.disabled.text until a reason is chosen.
  copy
    report.titleName          "Report {{name}}"        da "Anmeld {{name}}"
    report.titleMember        "Report a member"        da "Anmeld et medlem"
    report.titleOption        "Report a suggestion"    da "Anmeld et forslag"
    report.titleMessage       "Report a message"       da "Anmeld en besked"
    report.danger             "In danger right now? Call 112."   da "I fare lige nu? Ring 112."
    report.messageCopy        "We keep a copy of this message with your report for 12 months, also after the chat is deleted."   da "Vi gemmer en kopi af beskeden sammen med din anmeldelse i 12 måneder, også efter chatten er slettet."
    report.question           "What happened?"         da "Hvad skete der?"
    report.categories.harassment  "Harassment or disrespect"   da "Chikane eller respektløs opførsel"
    report.categories.safety      "I felt unsafe"              da "Jeg følte mig utryg"
    report.categories.noShow      "Didn't show up"             da "Mødte ikke op"
    report.categories.content     "Something they wrote"       da "Noget, personen skrev"
    report.categories.underage    "May be under 18"            da "Kan være under 18"
    report.categories.notGenuine  "Not a genuine member"       da "Ikke et ægte medlem"
    report.textLabel          "Tell us more"           da "Fortæl mere"
    common.optional           "(optional)"             da "(valgfrit)"
    report.textPlaceholder    "What happened, and when?"   da "Hvad skete der, og hvornår?"
    report.textWarningName    "Please don't include health or other sensitive details. {{name}} will not know who reported."   da "Skriv ikke noget om helbred eller andre følsomme ting. {{name}} får ikke at vide, hvem der har anmeldt."
    report.textWarning        "Please don't include health or other sensitive details. Nobody is told who reported."   da "Skriv ikke noget om helbred eller andre følsomme ting. Ingen får at vide, hvem der har anmeldt."
    report.send               "Send report"            da "Send anmeldelse"
    common.close              "Close"                  da "Luk"
  binds
    route    the report sheet, with the pod and one of: a member, a suggestion (and its author), or a message
    route    "/sheets/report?podId=braetspilpodaarhus46&uid=u_jonas" or "/sheets/report?podId=braetspilpodaarhus46&optionId=optionSaturday" or "/sheets/report?podId=braetspilpodaarhus46&messageId=m4" or "/sheets/report?podId=privatepodaarhusweek&uid=u_line"
    state    reason: one of the reasons or nothing, starting at nothing; note: text, starting at ""
    role     the reasons are a radio group named "What happened?"; the note is a text field labelled "Tell us more"
    events   Send report, once a reason is chosen, sends the report with the trimmed note when it has one, waits, then goes back; an error shows above the button
  sources
    Code: "apps/mobile/app/sheets/report.tsx", "apps/mobile/src/features/after/parts.tsx" (OptionRow, NoteField), "apps/mobile/src/components/Card.tsx" (Note tones)
    Screens: "apps/mobile/preview/screens.json" after-report, app-sheets-report-message; driven in the web preview on 27 November 2026
```
