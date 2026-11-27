# Interests step: your interests

The member's interests on step 4 as chips: ordinary ones in their pod colour, private ones quiet with a lock, each
with its own remove cross. Tapping one offers to change whether it is private.

```ail
node InterestsStepChips : view   level: experience
  why   A member sees at once which interests pods can form around, and which stay private, and can
        change that on any of them (DESIGN §3.1 step 8, §5.2 (5), F18).                       <- InterestsStep
  what
    Your interests, with the count added once there is one, and Tap an interest to change whether it's private.; No interests yet. when there are none.
    The chips: ordinary interests first, then private ones. An interest whose Did you mean is still open is drawn dashed, without colour.
    Each chip's cross removes it at once. Tapping a chip opens its options under the chips; tapping it again, or another chip, closes them or switches.
    An ordinary interest offers Keep this private; a private one offers This isn't sensitive for me, which makes it ordinary for this member only.
    Under them, while there are fewer than 5: Add at least 3. 5 or more gives better pods.

    Scenario: Tapping a private interest offers to make it ordinary
      Given a member adding interests, with the private gravid
      When they press gravid
      Then it says “gravid” is private and only used as a pod's theme. If it isn't sensitive for you, make it an ordinary interest.
      And it offers This isn't sensitive for me

    Scenario: Tapping an ordinary interest offers to keep it private
      Given a member adding interests, with brætspil
      When they press brætspil
      Then it says Does “brætspil” say something sensitive about you? Keep it private and it's only used as a pod's theme.
      And it offers Keep this private

    Scenario: The nudge stays until five interests
      Given a member adding interests, with four interests
      Then it says Add at least 3. 5 or more gives better pods.
      When they enter kayak and press Add
      Then the nudge is gone

    Scenario: The chips in Danish
      Given a member adding interests whose app is in Danish
      Then it says Tryk på en interesse for at ændre, om den er privat.
      When they press gravid
      Then it offers Den er ikke følsom for mig

  how
    decide an ordinary chip takes the pod colour of its own word, the same everywhere and for everyone
      because the same word has the same colour for everyone (pull request 6: "Colour interests and pods from the word shown")
    decide private chips stay quiet: white with an ink lock, never a colour
      because with the consent a private interest shows only a lock (DESIGN F18: "only a lock icon"), "quiet (white, Ink lock), never a colour" ("apps/mobile/src/features/interests/InterestManager.tsx")
    decide a hint line says that a tap changes whether an interest is private
      because the storyboard's note says "Tap an interest to change that", and the locked notice above cannot ("apps/mobile/src/features/interests/InterestManager.tsx")
  look
    Your interests in type.label, 700, color.text, with " · 4 added" in color.text.muted; the hint in type.caption, color.text.muted.
    Chips wrap, 8px apart, size.chip tall, radius.pill, type.label 600, each with a remove cross:
      ordinary chips on their pod colour's tint (pod.tomat.tint for brætspil, pod.solsikke.tint for sourdough, pod.fjord.tint for far på barsel) with a border.hairline border,
      a size.dot dot in the colour's base ringed in its deep, and color.text;
      private chips color.private.bg with a border.control color.private.border border, a lock and color.private.text; an unsettled chip dashed in color.field, without colour.
    The options: a card under the chips with the question in type.small, color.text.secondary, and the action as an underlined color.link link.
  copy
    interests.yours               "Your interests"   da "Dine interesser"
    interests.addedCount_other    "{{count}} added"  da "{{count}} tilføjet"
    interests.tapToChange         "Tap an interest to change whether it's private."   da "Tryk på en interesse for at ændre, om den er privat."
    interests.empty               "No interests yet."   da "Ingen interesser endnu."
    interests.optionsLocked       "“{{name}}” is private and only used as a pod's theme. If it isn't sensitive for you, make it an ordinary interest."   da "»{{name}}« er privat og bruges kun som tema for en pod. Er den ikke følsom for dig, kan du gøre den til en almindelig interesse."
    interests.optionsOrdinary     "Does “{{name}}” say something sensitive about you? Keep it private and it's only used as a pod's theme."   da "Siger »{{name}}« noget følsomt om dig? Hold den privat, så bruges den kun som tema for en pod."
    interests.keepPrivate         "Keep this private"   da "Hold den privat"
    interests.notSensitiveForMe   "This isn't sensitive for me"   da "Den er ikke følsom for mig"
    interests.nudge               "Add at least 3. 5 or more gives better pods."   da "Tilføj mindst 3. Med 5 eller flere får du bedre pods."
    interests.privateLabel        "{{name}}, private"   da "{{name}}, privat"
    interests.removeNamed         "Remove {{name}}"     da "Fjern {{name}}"
  binds
    route    "/add-interests" (the chips on What are you into?)
    state    open: the tapped interest or nothing
    role     each chip a button named by its word (a private one "gravid, private"), each cross a button "Remove brætspil"
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (onboarding mode), "apps/mobile/src/features/interests/parts.tsx", "apps/mobile/src/lib/podColor.ts"
    Design: DESIGN §3.1 step 8, §5.2 (5), F18
    Pull request: "https://github.com/ffMathy/friendpod/pull/6"
    Screens: "apps/mobile/preview/screens.json" onb-interests, app-onb-interests-chip; driven in the web preview, world onboarding-interests, in English and Danish, on 27 November 2026
```
