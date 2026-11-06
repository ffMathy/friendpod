/**
 * Shared pieces of the pod scenarios (pod-confirmed, pod-planning, pod-scheduled, pod-chat-open, pod-happened): the
 * week-46 timeline they share, the placeholder places in the preview's language, the plan, options and chat that use
 * them, and a `sendMessage` that warns about contact details before the meetup as the server does. Placeholders only,
 * never real venues.
 */
import { checkChatText, DAY_MS, type Locale } from '@grouper/core';
import type { CallableHandlers, DocData, PlaceFixture } from '../runtime/types';
import { Timestamp } from '../runtime/timestamp';
import { braetspilPod, chatMessages, ME, MEMBERS, place, ts } from './_kit';

/**
 * The brætspil pod's story, in Copenhagen time, so every screen tells the same one (§4.1, §4.6). The week-46 drop
 * goes out Thursday 12 Nov at 18:00 (drop-proposal) with answers due Saturday 14 Nov at 18:00 (drop-waiting is the
 * Friday in between). The pod is confirmed at that deadline, which starts the 72 h planning window: "Pick a time by
 * Tuesday 18:00" (pod-confirmed, Sunday) and "Voting closes Tuesday 18:00" (pod-planning, Monday) both mean Tuesday
 * 17 Nov. The plan locks then on the Saturday option, 21 Nov at 14:00 (the Sunday option is 22 Nov at 11:00). Less
 * than 4 days ahead, "Still coming?" is first asked at T−24 h, Friday 20 Nov at 14:00, when the chat opens
 * (pod-scheduled, Friday evening); it is open until Sunday 22 Nov at 14:00 (pod-chat-open is minutes before the
 * meetup), the feedback push comes Sunday at 10:00 (pod-happened), and the messages expire 72 h after the meetup.
 *
 * The storyboards date the meetup "Saturday 15 Nov", which is a Sunday in 2026 and before both the answer deadline and
 * the vote; the preview keeps the weekdays and moves the meetup to the Saturday after the planning window.
 */
export const WEEK46 = {
  weekId: '2026-W46',
  acceptBy: '2026-11-14 18:00',
  confirmedAt: '2026-11-14 18:00',
  planDeadline: '2026-11-17 18:00',
  saturdayOption: '2026-11-21 14:00',
  sundayOption: '2026-11-22 11:00',
  messagesExpire: '2026-11-24 14:00',
} as const;

/** `pods/{podId}` of the confirmed brætspil pod in week 46, planning until Tuesday 17 Nov 18:00 unless overridden. */
export function week46Pod(overrides: DocData = {}): DocData {
  return braetspilPod({ weekId: WEEK46.weekId, planning: { deadline: ts(WEEK46.planDeadline) }, confirmedAt: ts(WEEK46.confirmedAt), ...overrides });
}

/** The two option venues of storyboards 3.2 and 3.4, named in the preview's language. */
export function podPlaces(locale: Locale): { readonly boardGameCafe: DocData; readonly libraryCafe: DocData } {
  return locale === 'da'
    ? {
        boardGameCafe: place('placeholderBoardGameCafe', '[Brætspilscafé]', 'Aarhus C', 56.1572, 10.2079, 'cafe'),
        libraryCafe: place('placeholderLibraryCafe', '[Bibliotekscafé]', 'Aarhus Havn', 56.1535, 10.2142, 'library'),
      }
    : {
        boardGameCafe: place('placeholderBoardGameCafe', '[Board game café]', 'Aarhus C', 56.1572, 10.2079, 'cafe'),
        libraryCafe: place('placeholderLibraryCafe', '[Library café]', 'Aarhus harbour', 56.1535, 10.2142, 'library'),
      };
}

/** The locked plan (Saturday 21 Nov, 14:00, won with 3 yes at Tuesday's deadline) at the board game café. */
export function lockedPlanning(locale: Locale): DocData {
  return {
    deadline: ts(WEEK46.planDeadline),
    winningOptionId: 'optionSaturday',
    meetupAt: ts(WEEK46.saturdayOption),
    planLockedAt: ts(WEEK46.planDeadline),
    place: podPlaces(locale).boardGameCafe,
  };
}

type Votes = Readonly<Record<string, 'yes' | 'no'>>;

/**
 * The votes the plan locked on (pod-scheduled and after): Saturday won with Mette, Jonas and Ahmed. The viewer's yes
 * from Monday (pod-planning) was taken back before Tuesday's deadline, so at the lock they were `pending`, not coming
 * (attendanceAtPlanLock), and are asked "Still coming?" on Friday as the storyboard shows; Sofie, who said yes only to
 * Sunday, is pending too and ends up "Hasn't confirmed".
 */
export const LOCKED_VOTES: { readonly saturday: Votes; readonly sunday: Votes } = {
  saturday: { [MEMBERS.mette.uid]: 'yes', [MEMBERS.jonas.uid]: 'yes', [MEMBERS.ahmed.uid]: 'yes' },
  sunday: { [MEMBERS.sofie.uid]: 'yes', [MEMBERS.ahmed.uid]: 'yes' },
};

/**
 * The two options of "Plan the meetup" (storyboard 3.2), suggested on Sunday 15 Nov after the reveal: Mette's
 * Saturday 21 Nov at 14:00 at the board game café (yes from Mette, Jonas and the viewer) and Sofie's Sunday 22 Nov at
 * 11:00 at the library café (yes from Sofie and Ahmed), with the places in the preview's language. Other votes can be
 * passed in (the extension round).
 */
export function localPlanOptions(podId: string, locale: Locale, votes: { readonly saturday?: Votes; readonly sunday?: Votes } = {}): Record<string, DocData> {
  const places = podPlaces(locale);
  return {
    [`pods/${podId}/options/optionSaturday`]: {
      authorUid: MEMBERS.mette.uid,
      startsAt: ts(WEEK46.saturdayOption),
      place: places.boardGameCafe,
      votes: votes.saturday ?? { [MEMBERS.mette.uid]: 'yes', [MEMBERS.jonas.uid]: 'yes', [ME]: 'yes' },
      createdAt: ts('2026-11-15 12:10'),
    },
    [`pods/${podId}/options/optionSunday`]: {
      authorUid: MEMBERS.sofie.uid,
      startsAt: ts(WEEK46.sundayOption),
      place: places.libraryCafe,
      votes: votes.sunday ?? { [MEMBERS.sofie.uid]: 'yes', [MEMBERS.ahmed.uid]: 'yes' },
      createdAt: ts('2026-11-15 15:40'),
    },
  };
}

/**
 * The storyboard chat (3.5) as the pod scenarios show it: the Friday before the meetup and the Saturday itself (20 and
 * 21 Nov), deleted 72 h after the meetup. In Danish, Sofie answers Mette's "glæder mig til i morgen" with "Glæder mig
 * også!" ("I lige måde" reads like returning a greeting), and "kl. 14" keeps its no-break space so "14!" never wraps
 * onto a line of its own.
 */
export function podChat(podId: string, upTo: 'friday' | 'saturday', locale: Locale): Record<string, DocData> {
  const expiresAt = ts(WEEK46.messagesExpire);
  const danish: Readonly<Record<string, string>> = {
    m2: 'Glæder mig også! Det er første gang, jeg prøver sådan noget, så jeg er lidt nervøs.',
    m3: 'Også mig, det skal nok gå. Vi ses kl.\u00a014!',
  };
  return Object.fromEntries(
    Object.entries(chatMessages(podId, upTo, locale)).map(([path, doc]) => {
      // The kit's chat is dated a week earlier (the storyboard's dates): the same wall-clock times, seven days on.
      const createdAt = Timestamp.fromMillis((doc.createdAt as Timestamp).toMillis() + 7 * DAY_MS);
      const id = path.slice(path.lastIndexOf('/') + 1);
      const text = locale === 'da' ? (danish[id] ?? doc.text) : doc.text;
      return [path, { ...doc, text, createdAt, expiresAt }];
    }),
  );
}

/** A chat message at a Copenhagen wall-clock time ("2026-11-20 19:12"), deleted with the others. */
export function podMessage(authorUid: string, text: string, createdAt: string): DocData {
  return { authorUid, text, createdAt: ts(createdAt), expiresAt: ts(WEEK46.messagesExpire) };
}

/**
 * Place search results for "Suggest a time" (storyboard 3.3). The address is the area only: the app writes the kind
 * of place in front of it ("Café · Aarhus C"). The preview's search matches typed words against the name, so each
 * name holds "café" to come up for the storyboard's "café latin" ("[Café bar name]" stands in for its coffee bar).
 */
export function placeResults(locale: Locale): readonly PlaceFixture[] {
  const da = locale === 'da';
  return [
    { placeId: 'placeholderCafeLatinQ', name: da ? '[Cafénavn], Latinerkvarteret' : '[Café name], Latin Quarter', address: 'Aarhus C', lat: 56.1588, lng: 10.2085, primaryType: 'cafe' },
    { placeId: 'placeholderCoffeeBar1', name: da ? '[Cafébarens navn]' : '[Café bar name]', address: 'Aarhus C', lat: 56.1561, lng: 10.2095, primaryType: 'cafe' },
    { placeId: 'placeholderBakeryCafe2', name: da ? '[Bagericaféens navn]' : '[Bakery café name]', address: 'Aarhus C', lat: 56.1502, lng: 10.2061, primaryType: 'bakery' },
  ];
}

/**
 * `sendMessage` as the server answers it (§3.6): before the meetup, contact details (a phone number, an email, a
 * handle or a link) are not stored until "Send anyway" resends with `ackContactWarning`.
 */
export const CHAT_CALLABLES: CallableHandlers = {
  sendMessage: ({ podId, text, ackContactWarning }, ctx) => {
    const pod = ctx.store.get(`pods/${podId}`);
    const meetupAt = (pod?.planning as { meetupAt?: Timestamp } | undefined)?.meetupAt?.toMillis() ?? ctx.now;
    const check = checkChatText(text.trim(), { beforeMeetup: ctx.now < meetupAt });
    if (check.ok && check.warning && ackContactWarning !== true) return { warnings: [check.warning] };
    const messageId = ctx.store.newId('message');
    ctx.store.set(`pods/${podId}/messages/${messageId}`, {
      authorUid: ctx.uid ?? ME,
      text,
      createdAt: Timestamp.fromMillis(ctx.now),
      expiresAt: Timestamp.fromMillis(meetupAt + 72 * 3_600_000),
    });
    return { messageId };
  },
};
