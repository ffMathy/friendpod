import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld } from './_kit';

/** Thursday 12 Nov, 18:30: the week-46 drop brought a brætspil pod proposal (storyboards 2.2, 2.3). */
const scenario: Scenario = {
  id: 'drop-proposal',
  title: 'The drop is out: a brætspil pod proposal, not answered yet',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard(),
  }),
};

export default scenario;
