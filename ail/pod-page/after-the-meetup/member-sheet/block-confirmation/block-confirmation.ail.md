# Block confirmation

Block on the member sheet, and the question it asks first inside the sheet:
in an active pod, what should happen to the pod. Someone already blocked can
be unblocked here instead.

```ail
node BlockConfirmation : flow   level: experience
  why   A block is immediate and two-way, so the member confirms it first and, while the pod is
        still active, chooses whether the other person or they themselves leave it (DESIGN §3.7).   <- MemberSheet
  what
    Scenario: Block asks first and takes the member out by default
      Given a member the morning after a meetup, while the meetup chat is still open, on Jonas's sheet
      When they press Block Jonas
      Then it asks Block Jonas? with You'll never be matched again, and photos are hidden both ways.
      And What should happen to the pod? offers Take Jonas out of the pod and Leave the pod myself instead, with no re-plan
      And it says The others only see that the pod changed.
      And Report Jonas is gone, leaving Block Jonas and Cancel

    Scenario: Leaving instead keeps the member in the pod
      Given a member on Jonas's Block confirmation, the morning after a meetup
      When they choose Leave the pod myself instead
      Then it says Jonas stays in the pod. The others only see “A member left”.

    Scenario: A scheduled meetup can be re-planned
      Given a member the day before a meetup, on Mette's sheet
      When they press Block Mette and choose Take them out and re-plan the meetup
      Then it says They already know where and when you're meeting. Re-planning picks a new time and place within 48 hours.

    Scenario: In a past pod, Block asks without choices
      Given a member this week, on Sofie's sheet in their past bouldering pod
      Then Block Sofie says You'll never be matched again, and photos are hidden both ways., with no leave note
      When they press Block Sofie
      Then it asks Block Sofie? with no question about the pod, only Block Sofie and Cancel

    Scenario: Cancel returns to the sheet
      Given a member on Jonas's Block confirmation, the morning after a meetup
      When they press Cancel
      Then the sheet shows Block Jonas and Report Jonas again

    Scenario: Confirming the block closes the sheet
      Given a member on Jonas's Block confirmation, the morning after a meetup, who opened the sheet from a link
      When they press Block Jonas
      Then the brætspil pod shows, with no sheet over it

    Scenario: Someone already blocked can be unblocked
      Given a member this week who blocked Rasmus, who has since left their past bouldering pod
      When they open Rasmus's sheet in that pod
      Then it shows Former member, with Unblock this person and You've blocked this person.
      When they press Unblock this person
      Then it shows Block this person

    Scenario: The confirmation in Danish
      Given a member the morning after a meetup whose app is in Danish, on Jonas's sheet
      When they press Bloker Jonas
      Then it asks Bloker Jonas? and Hvad skal der ske med poden?, offering Tag Jonas ud af poden and Forlad hellere selv poden, with Annullér

  how
    decide in an active pod the blocked member is taken out by default; the blocker may leave instead
      because the app's rules cannot hide one member's fields or messages from another, so the two cannot stay in one active pod (DESIGN §3.7)
    decide re-plan is offered only once the meetup is scheduled
      because then the blocked person knows the plan; re-planning reopens planning with a 48-hour deadline (DESIGN §3.7)
    decide the confirmation's buttons are Block in danger outline and a secondary Cancel, never two filled buttons
      because a destructive sheet never has two filled buttons ("apps/mobile/preview/screens.json", app-member-block, spec 6.14)
    decide after a confirmed block the sheet closes and the device forgets the member's photo at once
      because the photo must leave this device's caches now, not at the next app open (DESIGN §9 Photos; "apps/mobile/app/pod/[podId]/member/[uid].tsx")
  look
    Block: a full-width size.button outline button, radius.pill, border.control color.danger, a block icon and "Block {{name}}" in color.danger,
      type.button 700, its line 8px under it in type.caption.text, color.text.secondary; Unblock is the same shape, secondary (color.text on white).
    The confirmation replaces the buttons, its parts 18px apart: "Block {{name}}?" in font.display, type.headline, 700, then the block line in type.body.small,
      color.text.secondary; "What should happen to the pod?" in type.label, 700; the choices as white rows 8px apart, at least 48px tall, radius.lg,
      border.control color.border.strong, a 24px radio and the label in type.body.small; the chosen row border.strong color.primary, its radio color.primary
      with a size.dot dot, its label 600; the hint in type.caption.text, color.text.secondary. Then the Block outline button and a secondary Cancel, 10px apart.
  copy
    member.blockName          "Block {{name}}"     da "Bloker {{name}}"
    member.blockActive        "You'll never be matched again. {{name}} is taken out of this pod and only sees that the pod changed."   da "I bliver aldrig matchet igen. {{name}} tages ud af poden og ser kun, at den har ændret sig."
    member.blockBody          "You'll never be matched again, and photos are hidden both ways."   da "I bliver aldrig matchet igen, og billeder skjules begge veje."
    member.unblockName        "Unblock {{name}}"   da "Fjern blokeringen af {{name}}"
    member.blockedAlready     "You've blocked {{name}}."   da "Du har blokeret {{name}}."
    member.blockTitle         "Block {{name}}?"    da "Bloker {{name}}?"
    member.whatHappens        "What should happen to the pod?"   da "Hvad skal der ske med poden?"
    member.choiceRemove       "Take {{name}} out of the pod"   da "Tag {{name}} ud af poden"
    member.choiceRemoveHint   "The others only see that the pod changed."   da "De andre ser kun, at poden har ændret sig."
    member.leaveInstead       "Leave the pod myself instead"   da "Forlad hellere selv poden"
    member.leaveHint          "{{name}} stays in the pod. The others only see “A member left”."   da "{{name}} bliver i poden. De andre ser kun, at et medlem er gået."
    member.replan             "Take them out and re-plan the meetup"   da "Tag personen ud, og planlæg mødet igen"
    member.replanExplainer    "They already know where and when you're meeting. Re-planning picks a new time and place within 48 hours."   da "Personen ved allerede, hvor og hvornår I mødes. Ny planlægning finder et nyt tidspunkt og sted inden for 48 timer."
    common.cancel             "Cancel"             da "Annullér"
  binds
    route    "/pod/braetspilpodaarhus46/member/u_jonas" or "/pod/braetspilpodaarhus46/member/u_mette" or "/pod/climbingpodaarhus42a/member/u_sofie" or "/pod/climbingpodaarhus42a/member/u_rasmus"
    state    confirming: boolean, starting at false; choice: "removeThem" | "leave" | "replan", starting at "removeThem", shown as the radio group "What should happen to the pod?"
    events   Block (confirmed) blocks the member, with leave or replan when chosen, then closes the sheet; Unblock unblocks at once, with no question
  sources
    Code: "apps/mobile/app/pod/[podId]/member/[uid].tsx", "apps/mobile/src/features/after/parts.tsx" (OptionRow)
    Design: DESIGN §3.7, §9 Photos; "apps/mobile/preview/screens.json" app-member-block
    Screens: driven in the web preview, worlds pod-happened, pod-scheduled and this-week, in English and Danish, on 27 November 2026
```
