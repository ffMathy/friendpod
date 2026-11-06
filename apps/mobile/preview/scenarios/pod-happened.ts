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

/**
 * Sunday 15 Nov, 10:05, the morning after (storyboards 4.1–4.3): the "How did it go?" push has just arrived; the
 * member sheet and the report sheet open from here.
 */
const scenario: Scenario = {
  id: 'pod-happened',
  title: 'The morning after the meetup: feedback, block or report',
  now: now('2026-11-15 10:05'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'MAX_ACTIVE_PODS' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'happened', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod({
      state: 'happened',
      planning: LOCKED_PLANNING,
      attendance: Object.fromEntries([ME, ...Object.values(MEMBERS).map((m) => m.uid)].map((uid) => [uid, 'coming'])),
    }),
    ...chatMessages(POD_BRAETSPIL, 'saturday', locale),
  }),
};

export default scenario;
