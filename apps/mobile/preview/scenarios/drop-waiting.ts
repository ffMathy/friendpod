import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld } from './_kit';

/** Friday morning: the viewer said yes; 3 of 5 have, 4 are needed (storyboard 2.4). */
const scenario: Scenario = {
  id: 'drop-waiting',
  title: 'Accepted the proposal, waiting for the others (3 of 5 said yes)',
  now: now('2026-11-13 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ myStatus: 'accepted', acceptedCount: 3 }),
  }),
};

export default scenario;
