import type { Scenario } from '../runtime/types';
import {
  braetspilPod,
  CAST_PHOTOS,
  chatMessages,
  LOCKED_PLANNING,
  ME,
  MEMBERS,
  now,
  ONBOARDED_USER,
  planOptions,
  POD_BRAETSPIL,
  podCard,
  profileWorld,
  ts,
} from './_kit';

/**
 * Friday 13 Nov, 19:30, the day before the meetup (storyboard 3.4): plan locked for Saturday 14:00 at the board game
 * café, the chat is open (Friday 14:00 to Sunday 14:00), the viewer hasn't answered "Still coming?", Sofie hasn't
 * confirmed.
 */
const scenario: Scenario = {
  id: 'pod-scheduled',
  title: 'Scheduled pod the day before: "Still coming?", chat open',
  now: now('2026-11-13 19:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'MAX_ACTIVE_PODS' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod({
      state: 'scheduled',
      planning: LOCKED_PLANNING,
      attendance: {
        [ME]: 'pending',
        [MEMBERS.mette.uid]: 'coming',
        [MEMBERS.jonas.uid]: 'coming',
        [MEMBERS.sofie.uid]: 'unconfirmed',
        [MEMBERS.ahmed.uid]: 'coming',
      },
    }),
    ...planOptions(POD_BRAETSPIL),
    ...chatMessages(POD_BRAETSPIL, 'friday', locale),
  }),
};

export default scenario;
