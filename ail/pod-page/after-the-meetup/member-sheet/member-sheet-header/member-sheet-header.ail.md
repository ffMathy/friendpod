# Member sheet header

The top of the member sheet: the member's avatar or photo, their first name,
which pod they share with the viewer, and their "about me".

```ail
node MemberSheetHeader : view   level: experience
  why   The sheet says plainly who is about to be blocked or reported, and in which pod, without
        revealing anything a confirmed pod does not already show (DESIGN §3.4, §3.7).     <- MemberSheet
  how
    decide the theme sits in the sentence as the pod's chip: the pod's colours, or the quiet private chip with a lock in a private pod
      because a private pod's theme is never coloured (DESIGN §6.1 S6; "apps/mobile/src/components/Chip.tsx"), and the sentence is read aloud as one ("apps/mobile/app/pod/[podId]/member/[uid].tsx")
    decide the avatar is the member's photo when they share one and are not blocked, else their initial on the pod's deep tone
      because a block hides photos both ways (DESIGN §3.7), and the after screens draw initials in the pod's deep tone ("apps/mobile/preview/screens.json", after-member)
    decide a pod with no theme word says In your pod
      because "unknown, confirm with the owner: which pods have no theme word on the member's card, and is In your pod the right fallback?"
  look
    One row, 14px gaps: a 72px round avatar (the photo, or a white initial on the pod's deep tone, pod.tomat.deep for brætspil; color.text.secondary (Ink 2) in a private pod or when the member is unknown),
      then the first name in font.display, type.title, 800, color.text (at most two lines) with the pod line 6px under it, then the close cross
      (a size.hit target, color.text) at the top right.
    The pod line in type.small, color.text.secondary, wrapping around the chip, 6px apart: "In your", the chip, "pod".
      The pod chip: size.tag tall, radius.pill, the pod's tint (pod.tomat.tint) with a border.hairline border in its base at 40 %, a size.dot dot in its base
      with a deep ring, the word in type.chip, 600, color.text. The private chip: color.private.bg, border.control color.private.border, a 14px lock and the word in color.text.
    About me under the row: an inset note (color.page, radius.md, 10px by 12px padding, 4px gap), "ABOUT ME" in type.eyebrow, 800, upper case,
      color.text.secondary, then the text in type.body.small, color.text.
    Own sheet: That's you in type.small, color.text.secondary under the name.
  copy
    member.formerMember  "Former member"          da "Tidligere medlem"
    member.thisPerson    "this person"            da "denne person"
    member.you           "That's you"             da "Det er dig"
    member.inPod         "In your {{theme}} pod"  da "I din pod om {{theme}}"
    member.inYourPod     "In your pod"            da "I din pod"
    member.aboutMe       "About me"               da "Om mig"
    common.private       "Private"                da "Privat"
    common.close         "Close"                  da "Luk"
  binds
    route    "/pod/braetspilpodaarhus46/member/u_jonas" (the top of the member sheet)
    props    name: the roster's first name, or Former member; theme: the viewer's word for the pod, or nothing; private: whether the pod is about a private interest;
             photo: the member's photo version unless blocked; aboutMe: text or nothing
    role     the pod line is one element labelled "In your {{theme}} pod"; the lock is an image named "Private"; the cross is a button named "Close"
  sources
    Code: "apps/mobile/app/pod/[podId]/member/[uid].tsx" (InPodLine), "apps/mobile/src/components/Chip.tsx", "apps/mobile/src/features/pods/MemberAvatar.tsx"
    Design: DESIGN §3.4, §3.7, §6.1 S6; "apps/mobile/preview/screens.json" after-member, app-member-private
    Screens: driven in the web preview, worlds pod-happened and pod-private-confirmed, in English and Danish, on 27 November 2026
```
