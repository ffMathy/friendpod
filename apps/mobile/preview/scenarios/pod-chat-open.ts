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
  POD_BRAETSPIL,
  podCard,
  profileWorld,
  ts,
} from './_kit';

/** Saturday 14 Nov, 13:58, just before the meetup: everyone is coming, the chat has five messages (storyboard 3.5). */
const scenario: Scenario = {
  id: 'pod-chat-open',
  title: 'Meetup day, minutes before 14:00: chat open with five messages',
  now: now('2026-11-14 13:58'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'MAX_ACTIVE_PODS' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod({
      state: 'scheduled',
      planning: LOCKED_PLANNING,
      attendance: Object.fromEntries([ME, ...Object.values(MEMBERS).map((m) => m.uid)].map((uid) => [uid, 'coming'])),
    }),
    ...chatMessages(POD_BRAETSPIL, 'saturday', locale),
  }),
};

export default scenario;
