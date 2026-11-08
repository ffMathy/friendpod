import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, SOLSIKKE_POD } from './_colours';

/**
 * Sunday 15 Nov: the Solsikke pod (sourdough) was confirmed; the reveal on the Solsikke field: Ink type, Ink people and
 * a Tomat sun.
 */
const scenario: Scenario = {
  id: 'pod-solsikke-confirmed',
  title: 'Solsikke pod confirmed (sourdough): the reveal on the Solsikke field',
  now: now('2026-11-15 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(SOLSIKKE_POD, 'confirmed', locale),
};

export default scenario;
