# Meetup chat: writing a message

The field and Send at the bottom of the chat: text only, 1 to 500 characters,
with what is always refused said on the spot.

```ail
node MeetupChatComposer : flow   level: experience
  why   Enough for day-of coordination without becoming a social network: short text only, and
        nothing harmful such as a CPR number or blocklisted words is ever stored (DESIGN A28, §3.6).  <- MeetupChat
  what
    Send can be pressed while the chat is open and the message has 1 to 500 characters once spaces at its ends are left out; the field takes no more than 500 characters.
    From 400 characters a counter shows above the field, and it turns red at 500.
    A sent message appears at the end of the list and the field empties; anything typed while it was on its way stays in the field.
    A CPR number or words that are not allowed are refused on the phone with their reason, nothing is sent, and the text stays in the field.
    A refusal or error stays under the field until the member sends again.
    The server takes at most 30 messages a member writes in a pod per hour; the next one shows Too many attempts. Please wait a little.

    Scenario: A message is sent and the field empties
      Given a member just before a meetup, on Saturday 21 November at 13:58
      When they write On my way! and press Send
      Then the last message reads You · 13:58 and On my way!
      And the field is empty again

    Scenario: Only spaces cannot be sent
      Given a member just before a meetup, in the chat, who types three spaces
      Then Send cannot be pressed

    Scenario: The counter shows near the limit
      Given a member just before a meetup, in the chat
      When they type 399 characters
      Then no counter shows
      When they type a 400th
      Then the counter reads 400/500

    Scenario: A message stops at 500 characters
      Given a member just before a meetup, in the chat
      When they paste 520 characters
      Then the field holds 500 of them, the counter reads 500/500, and Send can be pressed

    Scenario: A CPR number is never sent
      Given a member just before a meetup, in the chat
      When they write 010190-1234 and press Send
      Then it reads This looks like a CPR number, so it wasn't saved. Never share CPR numbers on Friendpod.
      And no message is added, and the field still holds 010190-1234

    Scenario: Words that are not allowed are refused
      Given a member just before a meetup, in the chat
      When they write sugar daddy and press Send
      Then it reads This contains words that aren't allowed on Friendpod, so it wasn't saved.
      When they change the text to fine
      Then the refusal still shows

    Scenario: A CPR number in Danish
      Given a member just before a meetup whose app is in Danish
      When they write 010190-1234 and press Send
      Then it reads Det ligner et CPR-nummer, så det blev ikke gemt. Del aldrig CPR-numre på Friendpod.

  how
    decide text only, with no quick replies
      because a message never changes attendance (DESIGN F29, D14)
    decide CPR numbers and blocklisted words are checked on the phone with the server's own rule, and the server checks again
      because they are always refused, and are then never sent ("apps/mobile/src/features/chat/useSendMessage.ts"; DESIGN §3.6 "Always refused")
    decide the counter shows from 80% of the limit
      because the limit should be clear before it is reached ("apps/mobile/src/features/chat/Composer.tsx"; A28)
    decide a refusal stays shown while the member edits the text
      because "unknown, confirm with the owner: should a refusal disappear once the text changes, as the contact-details warning does?"
  look
    A row 8px apart: the field (min size.input.compact, at most 120px tall as it grows on a phone; in the web preview it keeps its minimum height and its text scrolls, radius.md, border.control color.field border,
      color.surface, type.body.small, color.text, 12px side padding, the placeholder in color.text.muted) and Send (size.input.compact tall,
      radius.md, color.primary, pressed color.primary.pressed, "Send" in type.button, color.on.primary, with an 18px arrow after it);
      Send stays solid color.primary while the chat is open, even with nothing to send yet, as the storyboard draws it.
    The counter right-aligned above the field in type.micro, 600, color.text.muted; color.danger at 500.
    A refusal above the field in color.danger. The footer under the list: color.surface, border.hairline color.border on top, 10px above, 16px at the sides, at least 26px below.
  copy
    chat.inputLabel   "Message"                         da "Besked"
    chat.placeholder  "Write to your pod"               da "Skriv til jeres pod"
    chat.send         "Send"                            da "Send"
    chat.counter      "{{length}}/{{max}}"              da "{{length}}/{{max}}"
    chat.counterLabel "{{length}} of {{max}} characters"   da "{{length}} af {{max}} tegn"
    errors.PII_CPR    "This looks like a CPR number, so it wasn't saved. Never share CPR numbers on Friendpod."   da "Det ligner et CPR-nummer, så det blev ikke gemt. Del aldrig CPR-numre på Friendpod."
    errors.BLOCKLIST  "This contains words that aren't allowed on Friendpod, so it wasn't saved."   da "Teksten indeholder ord, der ikke er tilladt på Friendpod, så den blev ikke gemt."
    errors.RATE_LIMITED "Too many attempts. Please wait a little."   da "For mange forsøg. Vent lidt."
    errors.CHAT_CLOSED  "This chat is closed."          da "Chatten er lukket."
    errors.NETWORK    "No connection. Please try again."   da "Ingen forbindelse. Prøv igen."
  binds
    route    "/pod/braetspilpodaarhus46/chat" (the field and Send at the bottom of the chat)
    state    draft: text, starting at ""; refusal: an error message or nothing, starting at nothing, cleared when Send is pressed
    role     a text field named "Message"; a button named "Send"
    events   Send checks the trimmed draft with checkChatText (as after the meetup); refused shows the reason, else sends it to the server
  uses MeetupChatRules, ContactDetailsWarning
  sources
    Code: "apps/mobile/src/features/chat/Composer.tsx", "apps/mobile/src/features/chat/useSendMessage.ts", "apps/mobile/app/pod/[podId]/chat.tsx", "packages/core/src/chat/limits.ts", "apps/mobile/src/i18n/en/shell.json"
    Design: DESIGN §3.6, §4.2 limits table, A28, F29; PRIVACY R17
    Screens: driven in the web preview (world pod-chat-open) in English and Danish on 27 November 2026; the rate limit is the server's and no world shows it
```
