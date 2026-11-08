import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, OPEN_POD } from './_colours';

/**
 * Sunday 15 Nov: the open-to-anyone pod was confirmed; the reveal on the Blomme field (from the pod id): white type,
 * Paper people.
 */
const scenario: Scenario = {
  id: 'pod-open-confirmed',
  title: 'Open-to-anyone pod confirmed: the reveal on the Blomme field',
  now: now('2026-11-15 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(OPEN_POD, 'confirmed', locale),
};

export default scenario;
