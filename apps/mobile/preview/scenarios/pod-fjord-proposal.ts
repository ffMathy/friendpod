import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, FJORD_POD } from './_colours';

/**
 * Thursday 12 Nov, 18:30: a Fjord pod proposal ("far på barsel", the longest name), not answered: the Fjord tint band,
 * the deep name and badge.
 */
const scenario: Scenario = {
  id: 'pod-fjord-proposal',
  title: 'A Fjord pod proposal (far på barsel), not answered',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(FJORD_POD, 'proposal', locale),
};

export default scenario;
