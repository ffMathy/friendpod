import type { DocData, Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, MEMBERS, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, ts } from './_kit';
import { CHAT_CALLABLES, localPlanOptions, LOCKED_VOTES, lockedPlanning, podChat, podMessage, WEEK46, week46Pod } from './_pod';

/**
 * Friday 20 Nov, 19:30, the day before the meetup (storyboard 3.4): plan locked on Tuesday for Saturday 14:00 at the
 * board game café, the chat is open (Friday 14:00 to Sunday 14:00) with three messages the viewer hasn't read ("3
 * new"), the viewer hasn't answered "Still coming?" (asked at 14:00), Sofie hasn't confirmed.
 */
const JONAS_FRIDAY = {
  en: "Count me in! I'll be there a few minutes early to grab a table.",
  da: 'Jeg er klar! Jeg kommer et par minutter før og finder et bord.',
} as const;
const scenario: Scenario = {
  id: 'pod-scheduled',
  title: 'Scheduled pod the day before: "Still coming?", chat open',
  now: now('2026-11-20 19:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  callables: CHAT_CALLABLES,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod({
      state: 'scheduled',
      planning: lockedPlanning(locale),
      attendance: {
        [ME]: 'pending',
        [MEMBERS.mette.uid]: 'coming',
        [MEMBERS.jonas.uid]: 'coming',
        [MEMBERS.sofie.uid]: 'unconfirmed',
        [MEMBERS.ahmed.uid]: 'coming',
      },
    }),
    ...localPlanOptions(POD_BRAETSPIL, locale, LOCKED_VOTES),
    // Mette's and Sofie's messages from the storyboard chat, and one from Jonas; the viewer hasn't written yet.
    ...withoutOwnMessages(podChat(POD_BRAETSPIL, 'friday', locale)),
    [`pods/${POD_BRAETSPIL}/messages/m3j`]: podMessage(MEMBERS.jonas.uid, JONAS_FRIDAY[locale], '2026-11-20 19:12'),
  }),
};

function withoutOwnMessages(docs: Record<string, DocData>): Record<string, DocData> {
  return Object.fromEntries(Object.entries(docs).filter(([, d]) => d.authorUid !== ME));
}

export default scenario;
