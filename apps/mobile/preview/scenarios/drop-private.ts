import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_PRIVATE, profileWorld, ts } from './_kit';

/**
 * Week 48: a proposal around the viewer's private interest "gravid" (storyboard 5.1). Sensitive-themed cards carry no
 * age span and no shared interests (core podCardDocSchema), so decliners can't work out who holds it.
 */
const scenario: Scenario = {
  id: 'drop-private',
  title: 'A pod proposal about a private interest (gravid), week 48',
  now: now('2026-11-26 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W48', outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_PRIVATE}`]: {
      state: 'proposed',
      myStatus: 'invited',
      themeLabel: 'gravid',
      themeSensitive: true,
      sizeTarget: 5,
      acceptedCount: 1,
      acceptBy: ts('2026-11-28 18:00'),
      reasons: [
        { code: 'THEME', yourWording: 'gravid' },
        { code: 'AREA', label: 'Aarhus C' },
        { code: 'NEAR_YOU', km: 10 },
      ],
      areaLabel: 'Aarhus C',
      photoShared: false,
    },
  }),
};

export default scenario;
