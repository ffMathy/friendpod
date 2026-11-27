# Declining a proposal

Not this time on the proposal card: an optional reason, then Decline this pod or Cancel.

```ail
node ProposalDecline : flow   level: experience
  why   A member can say no to a pod without explaining; an optional reason helps only the
        anonymous statistics (DESIGN §3.3: "Decline takes an optional reason chip, used for
        aggregate metrics only").                                                    <- DropProposal
  what
    Declining replaces the two buttons, inside the card, with the reason chips and Cancel and Decline this pod.
    At most one reason is chosen; pressing the chosen one again clears it.
    Decline this pod sends the answer, with the reason when one is chosen, and the proposal leaves Home.

    Scenario: Declining asks why, optionally
      Given a member with a pod proposal, on Home
      When they press Not this time
      Then the card reads Optional: why? (used only for anonymous statistics)
      And offers Not this week, Not this interest, Too far, Group size and Other
      And Cancel and Decline this pod, and no I'm in

    Scenario: Cancel keeps the proposal
      Given a member with a pod proposal who pressed Not this time
      When they press Cancel
      Then the card offers Not this time and I'm in again

    Scenario: Declining leaves the proposal behind
      Given a member with a pod proposal, on Thursday 12 November 2026 at 18:30, who pressed Not this time
      When they choose Too far and press Decline this pod
      Then Home reads This week, Next drop and in 6 days and 23 hours
      And the brætspil proposal is not shown; brætspil is left only as an interest under What we'll match on

    Scenario: Declining in Danish
      Given a member with a pod proposal whose app is in Danish, on Home
      When they press Ikke nu
      Then the card reads Valgfrit: hvorfor? (bruges kun til anonym statistik)
      And offers Ikke i denne uge, Ikke denne interesse, For langt væk, Gruppens størrelse and Andet
      And Annullér and Sig nej tak til poden

  how
    decide the reason is optional, and said to be anonymous
      because it is used for aggregate metrics only (DESIGN §3.3)
    decide Decline this pod is the filled button
      because "unknown, confirm with the owner: Decline this pod is drawn as the primary (filled green) button; is the stronger look intended for a no?"
    decide a declined proposal is not shown on Home afterwards
      because Home shows only open invitations and pods the member said yes to ("app/(tabs)/index.tsx")
  look
    Inside the card, 12px apart: the prompt in type.caption, color.text.muted; five choice chips (size.chip, radius.pill, type.chip,
      white with a border.control color.border.strong border, the chosen one filled color.ink with color.on.ink text), wrapping 8px apart;
      then Cancel (a white secondary pill) and Decline this pod (a color.primary pill), size.button tall, growing 1 : 1.4, 10px apart.
  copy
    pods.declineReasonPrompt         "Optional: why? (used only for anonymous statistics)"   da "Valgfrit: hvorfor? (bruges kun til anonym statistik)"
    pods.declineReasons.notThisWeek  "Not this week"          da "Ikke i denne uge"
    pods.declineReasons.theme        "Not this interest"      da "Ikke denne interesse"
    pods.declineReasons.distance     "Too far"                da "For langt væk"
    pods.declineReasons.groupSize    "Group size"             da "Gruppens størrelse"
    pods.declineReasons.other        "Other"                  da "Andet"
    common.cancel                    "Cancel"                 da "Annullér"
    pods.confirmDecline              "Decline this pod"       da "Sig nej tak til poden"
  binds
    state    declining: boolean, starting at false; reason: "notThisWeek" | "theme" | "distance" | "groupSize" | "other" or nothing, starting at nothing
    role     each reason is a radio button named by its text
    events   Not this time sets declining; Cancel clears it; a chip sets reason, or clears it when it is the chosen one;
             Decline this pod asks the server to answer no, with the reason when there is one
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "packages/core" (DECLINE_REASONS), "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.3
    Screens: driven in the web preview, world drop-proposal, in English and Danish, on 27 November 2026
```
