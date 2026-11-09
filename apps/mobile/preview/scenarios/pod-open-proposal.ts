import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, OPEN_POD } from './_colours';

/**
 * Thursday 12 Nov, 18:30: an open-to-anyone pod proposal (no theme name), not answered; its colour comes from the pod
 * id (Blomme).
 */
const scenario: Scenario = {
  id: 'pod-open-proposal',
  title: 'An open-to-anyone pod proposal (colour from the pod id), not answered',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(OPEN_POD, 'proposal', locale),
};

export default scenario;
