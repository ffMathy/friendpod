import type { Scenario } from '../runtime/types';
import { BRAETSPIL_MEMBERS, CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, roster, ts } from './_kit';
import { WEEK46, week46Pod } from './_pod';

/**
 * Sunday 15 Nov: the brætspil pod was confirmed with 5 people at Saturday's answer deadline; nobody has suggested a
 * time yet, and the 72 h planning window runs until Tuesday 17 Nov 18:00 (storyboard 3.1, see WEEK46 in _pod.ts).
 */
const scenario: Scenario = {
  id: 'pod-confirmed',
  title: 'Pod confirmed: members revealed, plan the meetup by Tuesday 18:00',
  now: now('2026-11-15 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'planning', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod({ roster: roster(BRAETSPIL_MEMBERS, false) }),
  }),
};

export default scenario;
