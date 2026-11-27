# Meetup chat: rules

The chat's window, limits and text check, shared by the app and the server
from `packages/core`.

```ail
node MeetupChatRules : fn   level: system
  why   The phone and the server must agree on when the chat is open and on what a message may
        say, so one rule serves both (DESIGN A28, §3.6, §4.6).                               <- MeetupChat
  what
    CHAT_MESSAGE_MAX: integer = 500
    CHAT_RATE_LIMIT_PER_HOUR: integer = 30
    CHAT_PUSH_THROTTLE_MS: integer = 600000
    CHAT_OPENS_BEFORE_MS: integer = 86400000
    CHAT_CLOSES_AFTER_MS: integer = 86400000
    CHAT_DELETE_AFTER_MS: integer = 259200000

    type ChatWindow = { opensAt: time, closesAt: time, deleteAt: time }
    type ChatWarning = "CONTACT_INFO_BEFORE_MEETUP"
    type ChatTextRejection = "BLOCKLIST" | "PII_CPR"
    type ChatTextCheck = { ok: true, warning?: ChatWarning } | { ok: false, code: ChatTextRejection }

    chatWindow(meetupAt: time) -> ChatWindow
      Opens CHAT_OPENS_BEFORE_MS before meetupAt, closes CHAT_CLOSES_AFTER_MS after it, and every message's deletion
      time is CHAT_DELETE_AFTER_MS after it. These are fixed lengths of time, not clock times.

    isChatOpen(meetupAt: time, now: time) -> boolean
      True when opensAt ≤ now and now < closesAt; never true for a time that is not a valid date.

    checkChatText(text: text, opts: { beforeMeetup: boolean }) -> ChatTextCheck
      Checked on a folded copy: Unicode NFKC, invisible format characters removed, other scripts' digits made 0–9.
      A CPR-like number anywhere is { ok: false, code: "PII_CPR" }; text on the shared blocklist, in its chat form, is
      { ok: false, code: "BLOCKLIST" } (words such as "escort" that are ordinary in a sentence count only in their
      blocked phrases). Otherwise, when beforeMeetup, a phone number, email address, handle or link is
      { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }, where links to the planner's map hosts, times, time ranges
      and dates standing alone, and a full stop typed without a space before a capitalised word are not contact
      details. Anything else is { ok: true }.

    examples
      chatWindow(2026-11-21 14:00:00) => { opensAt: 2026-11-20 14:00:00, closesAt: 2026-11-22 14:00:00, deleteAt: 2026-11-24 14:00:00 }
      isChatOpen(2026-11-21 14:00:00, 2026-11-20 13:59:59) => false
      isChatOpen(2026-11-21 14:00:00, 2026-11-20 14:00:00) => true
      isChatOpen(2026-11-21 14:00:00, 2026-11-21 13:58:00) => true
      isChatOpen(2026-11-21 14:00:00, 2026-11-22 13:59:59) => true
      isChatOpen(2026-11-21 14:00:00, 2026-11-22 14:00:00) => false
      checkChatText("On my way!", { beforeMeetup: true }) => { ok: true }
      checkChatText("20 30 40 50", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("20 30 40 50", { beforeMeetup: false }) => { ok: true }
      checkChatText("Ring på +45 20 30 40 50", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("emil@example.com", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("Skriv på insta @emil_aarhus", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("https://example.com/x", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("https://maps.app.goo.gl/abc123", { beforeMeetup: true }) => { ok: true }
      checkChatText("Vi ses 21.11 kl. 14.00-16.00", { beforeMeetup: true }) => { ok: true }
      checkChatText("tak.se", { beforeMeetup: true }) => { ok: true, warning: "CONTACT_INFO_BEFORE_MEETUP" }
      checkChatText("Tak.Se jer snart", { beforeMeetup: true }) => { ok: true }
      checkChatText("010190-1234", { beforeMeetup: false }) => { ok: false, code: "PII_CPR" }
      checkChatText("sugar daddy", { beforeMeetup: false }) => { ok: false, code: "BLOCKLIST" }
      checkChatText("escort service", { beforeMeetup: true }) => { ok: false, code: "BLOCKLIST" }
      checkChatText("I can escort you from the bus", { beforeMeetup: true }) => { ok: true }

    probes
      chatWindow(2026-10-25 14:00:00)

  how
    decide the window is fixed lengths of time around the meetup, so across a change to or from summer time the clock gap is 23 or 25 hours
      because the other meetup timers are absolute offsets too ("packages/core/src/time/schedule.ts")
    decide contact details only warn, and only before the meetup; CPR numbers and blocklisted text are always refused
      because DESIGN §3.6 "Before you have met" and "Always refused"; PRIVACY R17
    decide map links, times and dates are left out before looking for contact details
      because map links carry coordinates and "@" that read as phone numbers and handles, and times and dates such as "18.30-21.00" read as eight digits ("packages/core/src/chat/moderation.ts")
    decide the blocklist and the phone, email, handle and CPR patterns are the ones interest tags use
      because DESIGN §3.6: "the core blocklist and PII patterns, as for tags"
    decide 30 messages per member per pod per hour, and at most one "New message in your pod" push per member per pod every 10 minutes
      because DESIGN A28; the push never carries the text, the theme or a name (DESIGN §3.6 "Notifications")
  free [ helper names ]
  sources
    Code: "packages/core/src/chat/moderation.ts", "packages/core/src/chat/limits.ts", "packages/core/src/time/schedule.ts", "packages/core/src/schemas/callables.ts", "packages/core/src/interests/blocklist.ts", "packages/core/src/interests/pii.ts"
    Examples: run against the existing code with tsx in Europe/Copenhagen on 27 November 2026
    Design: DESIGN §3.6, §4.2, §4.6, A28, F29; PRIVACY R17
```
