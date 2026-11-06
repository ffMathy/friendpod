import type { DocData, Scenario } from '../runtime/types';
import { braetspilPod, CAST_PHOTOS, ME, MEMBERS, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, ts } from './_kit';
import { CHAT_CALLABLES, localPlanOptions, lockedPlanning, podChat } from './_pod';

/**
 * Friday 13 Nov, 19:30, the day before the meetup (storyboard 3.4): plan locked for Saturday 14:00 at the board game
 * café, the chat is open (Friday 14:00 to Sunday 14:00) with three messages the viewer hasn't read ("3 new"), the
 * viewer hasn't answered "Still coming?", Sofie hasn't confirmed.
 */
const JONAS_FRIDAY = {
  en: "Count me in! I'll be there a few minutes early to grab a table.",
  da: 'Jeg er klar! Jeg kommer et par minutter før og finder et bord.',
} as const;
const scenario: Scenario = {
  id: 'pod-scheduled',
  title: 'Scheduled pod the day before: "Still coming?", chat open',
  now: now('2026-11-13 19:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  callables: CHAT_CALLABLES,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'MAX_ACTIVE_PODS' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod({
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
    ...localPlanOptions(POD_BRAETSPIL, locale),
    // Mette's and Sofie's messages from the storyboard chat, and one from Jonas; the viewer hasn't written yet.
    ...withoutOwnMessages(podChat(POD_BRAETSPIL, 'friday', locale)),
    [`pods/${POD_BRAETSPIL}/messages/m3j`]: {
      authorUid: MEMBERS.jonas.uid,
      text: JONAS_FRIDAY[locale],
      createdAt: ts('2026-11-13 19:12'),
      expiresAt: ts('2026-11-17 14:00'),
    },
  }),
};

function withoutOwnMessages(docs: Record<string, DocData>): Record<string, DocData> {
  return Object.fromEntries(Object.entries(docs).filter(([, d]) => d.authorUid !== ME));
}

export default scenario;
