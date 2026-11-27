# Waiting for the others

Home after the member said yes, until the pod is confirmed (storyboard drop-waiting): how many have said yes,
how many are needed, and Okay to fold the card away.

```ail
node DropWaiting : flow   level: experience
  why   Saying yes is not yet a pod: it is confirmed only when enough people say yes, so the
        member sees the seats light up one per yes, without seeing who (DESIGN §3.3, §3.4;
        pull request 5 "Seats light up one per yes").                               <- Home
  what
    Okay folds the card away for the rest of the session: Home goes back to this week, with the pod under Your pods.
    Changed your mind? Leave this pod asks Leave this pod? You can't join it again afterwards., with Cancel and Leave;
    Leave takes the member out of the pod.

    Scenario: Waiting for the others
      Given a member waiting for the others: brætspil, 3 of 5 said yes, open until Saturday 14 November 18:00
      When Home opens on Friday 13 November 2026 at 10:00
      Then it reads Your weekly drop and Week 46
      And the card reads You're in, Open until Sat 18:00, A pod around and brætspil
      And 3 of 5 said yes, with You, two lit seats and two open ones, and 4 needed
      And We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits.
      And Okay, with Changed your mind? Leave this pod under the card

    Scenario: Okay moves the pod to Your pods
      Given a member waiting for the others, on Home on Friday 13 November 2026 at 10:00
      When they press Okay
      Then Home reads This week, Next drop and in 6 days and 8 hours
      And Your pods · 0 of 2 active lists brætspil with Waiting for the others · 3 of 5 said yes

    Scenario: The waiting pod opens from Your pods
      Given a member waiting for the others who pressed Okay
      When they press brætspil under Your pods
      Then the pod's page opens, reading 3 of 5 said yes

    Scenario: Waiting in Danish
      Given a member waiting for the others whose app is in Danish
      When Home opens
      Then it reads Ugens drop, Du er med, Åben til lør. kl. 18.00 and 3 af 5 har sagt ja
      And 4 skal sige ja, Okay and Fortrudt? Forlad poden

  how
    decide one seat lights per yes in the pod's colour, with a bracket under the seats that must light, and never a name
      because the card never shows who has accepted (DESIGN §3.2), and seats light one per yes (pull request 5)
    decide Okay is remembered only while the app is open
      because "unknown, confirm with the owner: after a restart the waiting card is back on Home even after Okay; is that intended?" ("app/(tabs)/index.tsx": "acknowledged with Okay in this session")
    decide leaving needs a confirmation that says it cannot be undone
      because a member who leaves cannot join again ("apps/mobile/src/features/pods/ProposalCard.tsx"; DESIGN §3.8)
  look
    As the proposal card, but the band holds the ink "You're in" badge with a tick and, at its right, a clock with "Open until Sat 18:00" in type.caption, 700, color.text.secondary.
    Under the band, 12px apart: "3 of 5 said yes" in font.display, type.headline, 700; the seats (You in color.ink, the yes seats filled pod.tomat.base with a pod.tomat.deep ring,
      the rest dashed color.field) over a thin bracket under the first 4 with "4 needed" in type.caption, 700; then the text in type.small.text, line height 21px, color.text.secondary.
    Okay: a full-width color.primary pill, size.button tall. "Changed your mind? Leave this pod" centred under the card, underlined, type.label, 700, color.text.secondary.
  copy
    pods.youreIn      "You're in"                               da "Du er med"
    pods.openUntil    "Open until {{dayShort}} {{time}}"        da "Åben til {{dayShort}}. kl. {{time}}"
    pods.saidYes      "{{accepted}} of {{size}} said yes"       da "{{accepted}} af {{size}} har sagt ja"
    pods.needed       "{{count}} needed"                        da "{{count}} skal sige ja"
    pods.waitingBody  "We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits."   da "Vi giver dig besked, så snart poden er bekræftet. Hvis nogen siger nej tak, inviterer vi måske en anden, der passer ind."
    pods.okay         "Okay"                                    da "Okay"
    pods.leaveLink    "Changed your mind? Leave this pod"       da "Fortrudt? Forlad poden"
    pods.leaveTitle   "Leave this pod?"                         da "Forlad poden?"
    pods.leaveBody    "You can't join it again afterwards."     da "Du kan ikke komme med igen bagefter."
    pods.leaveConfirm "Leave"                                   da "Forlad"
    pods.saidNo       "You said no"                             da "Du sagde nej tak"
  binds
    route    "/" (Home, after the member said yes)
    role     "3 of 5 said yes" is read with the threshold ("3 of 5 said yes. 4 needed."); the seats are hidden from screen readers
    events   Okay adds the pod to Home's acknowledged set; the leave link opens a system alert, whose Leave asks the server to take the member out
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.3, §3.4, §3.8; pull request 5
    Storyboard: drop-waiting ("apps/mobile/preview/screens.json": the home tab after saying yes, 3 of 5, 4 needed)
    Screens: driven in the web preview, world drop-waiting, in English and Danish, on 27 November 2026; the leave alert does nothing there, so its texts were read from the code
```
