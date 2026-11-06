import type { Scenario } from '../runtime/types';
import {
  braetspilPod,
  CAST_PHOTOS,
  ME,
  now,
  ONBOARDED_USER,
  POD_BRAETSPIL,
  podCard,
  profileWorld,
  ts,
} from './_kit';

/** Sunday 8 Nov: the brætspil pod is confirmed with 5 people; nobody has suggested a time yet (storyboard 3.1). */
const scenario: Scenario = {
  id: 'pod-confirmed',
  title: 'Pod confirmed: members revealed, plan the meetup by Tuesday 18:00',
  now: now('2026-11-08 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W45', outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'planning', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod(),
  }),
};

export default scenario;
