import type { Locale } from '@grouper/core';
import type { DocData, Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, place, POD_PRIVATE, profileWorld, roster, ts, VIEWER } from './_kit';
import { CHAT_CALLABLES } from './_pod';

/**
 * Friday 4 Dec, 19:30: the week-48 pod about the viewer's private interest "gravid" (pod-private-confirmed a week on).
 * The plan locked on Tuesday for Saturday 5 Dec at 14:00 at a placeholder café; the chat is open (Friday 14:00 to
 * Sunday 14:00) with one message the viewer hasn't read. The viewer is coming; Nikolaj hasn't confirmed. Private stays
 * quiet: the white band with an Ink border and a lock, Ink 2 avatars (nobody has shown a photo), Paper and white chat
 * bubbles. Names and places are placeholders.
 */
const LINE = { uid: 'u_line', firstName: 'Line' } as const;
const MADS = { uid: 'u_mads', firstName: 'Mads' } as const;
const SARA = { uid: 'u_sara', firstName: 'Sara' } as const;
const NIKOLAJ = { uid: 'u_nikolaj', firstName: 'Nikolaj' } as const;
const MEMBERS = [LINE, MADS, SARA, NIKOLAJ, { uid: ME, firstName: VIEWER.firstName }];

const MEETUP = '2026-12-05 14:00';
const EXPIRES = '2026-12-08 14:00';

/** The chat, in the preview's language ("kl. 14" keeps its no-break space). */
const CHAT: readonly (readonly [string, string, string, Readonly<Record<Locale, string>>])[] = [
  ['p1', LINE.uid, '2026-12-04 15:10', {
    en: "Hi all, looking forward to tomorrow! I'll find a table by the window.",
    da: 'Hej alle sammen, jeg glæder mig til i morgen! Jeg finder et bord ved vinduet.',
  }],
  ['p2', SARA.uid, '2026-12-04 17:45', {
    en: "Lovely. It'll be good to talk to people in the same situation.",
    da: 'Dejligt. Det bliver rart at snakke med nogen, der står i samme situation.',
  }],
  ['p3', ME, '2026-12-04 18:20', { en: 'Same here. See you at 14!', da: 'Også mig. Vi ses kl. 14!' }],
  ['p4', MADS.uid, '2026-12-04 19:05', { en: 'Count me in. I might be five minutes late.', da: 'Jeg er med. Jeg kommer måske fem minutter for sent.' }],
];

function chat(locale: Locale): Record<string, DocData> {
  return Object.fromEntries(
    CHAT.map(([id, authorUid, createdAt, text]) => [`pods/${POD_PRIVATE}/messages/${id}`, { authorUid, text: text[locale], createdAt: ts(createdAt), expiresAt: ts(EXPIRES) }]),
  );
}

const scenario: Scenario = {
  id: 'pod-private-scheduled',
  title: 'A scheduled pod about a private interest (gravid), the day before: chat open, the private band and bubbles',
  now: now('2026-12-04 19:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  callables: CHAT_CALLABLES,
  // Anything before the viewer's own 18:20 message counts as seen, so Mads's 19:05 message is "1 new".
  docs: ({ locale }) => {
    const cafe = place('placeholderCafePrivate', locale === 'da' ? '[Cafénavn]' : '[Café name]', 'Aarhus C', 56.1566, 10.2101, 'cafe');
    return {
      ...profileWorld({ locale, lastDrop: { weekId: '2026-W48', outcome: 'proposed' } }),
      [`users/${ME}/pods/${POD_PRIVATE}`]: {
        state: 'scheduled',
        myStatus: 'accepted',
        themeLabel: 'gravid',
        themeSensitive: true,
        sizeTarget: 5,
        acceptedCount: 5,
        acceptBy: ts('2026-11-28 18:00'),
        reasons: [
          { code: 'THEME', yourWording: 'gravid' },
          { code: 'AREA', label: 'Aarhus C' },
          { code: 'NEAR_YOU', km: 10 },
        ],
        areaLabel: 'Aarhus C',
        photoShared: false,
      },
      [`pods/${POD_PRIVATE}`]: {
        state: 'scheduled',
        weekId: '2026-W48',
        areaLabel: 'Aarhus C',
        theme: { kind: 'concept', conceptId: 'c_9f8e7d6c5b4a39281706_p', sensitive: true },
        memberUids: MEMBERS.map((m) => m.uid),
        // S6: no photo versions until each member shows theirs; nobody has yet.
        roster: roster(MEMBERS, false),
        podInterests: { da: ['gåture', 'kaffe'], en: ['walks', 'coffee'] },
        planning: {
          deadline: ts('2026-12-01 18:00'),
          winningOptionId: 'optionPrivateSaturday',
          meetupAt: ts(MEETUP),
          planLockedAt: ts('2026-12-01 18:00'),
          place: cafe,
        },
        attendance: { [ME]: 'coming', [LINE.uid]: 'coming', [MADS.uid]: 'coming', [SARA.uid]: 'coming', [NIKOLAJ.uid]: 'unconfirmed' },
        confirmedAt: ts('2026-11-28 18:00'),
      },
      [`pods/${POD_PRIVATE}/options/optionPrivateSaturday`]: {
        authorUid: LINE.uid,
        startsAt: ts(MEETUP),
        place: cafe,
        votes: { [ME]: 'yes', [LINE.uid]: 'yes', [MADS.uid]: 'yes', [SARA.uid]: 'yes' },
        createdAt: ts('2026-11-29 12:00'),
      },
      ...chat(locale),
    };
  },
};

export default scenario;
