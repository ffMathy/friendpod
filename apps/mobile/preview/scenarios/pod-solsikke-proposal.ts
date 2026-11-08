import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, SOLSIKKE_POD } from './_colours';

/**
 * Thursday 12 Nov, 18:30: a Solsikke pod proposal (sourdough), not answered: the Solsikke tint band and the badge whose
 * sun keeps its Solsikke-deep ring.
 */
const scenario: Scenario = {
  id: 'pod-solsikke-proposal',
  title: 'A Solsikke pod proposal (sourdough), not answered',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(SOLSIKKE_POD, 'proposal', locale),
};

export default scenario;
