import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_PRIVATE, profileWorld, roster, ts, VIEWER } from './_kit';

/**
 * Sunday 29 Nov, 11:00: the week-48 pod about the viewer's private interest "gravid" (storyboard 5.1's proposal) was
 * confirmed at Saturday's answer deadline. The privacy sticky note: "Photos stay hidden in those pods until each person
 * chooses to show theirs" (S6), so the roster has no photo version for anyone but Line, who has chosen to show hers,
 * and the viewer's own "Show my photo to this pod" is off. Nobody has suggested a time yet. Names are placeholders.
 */
const LINE = { uid: 'u_line', firstName: 'Line' } as const;
const MADS = { uid: 'u_mads', firstName: 'Mads' } as const;
const SARA = { uid: 'u_sara', firstName: 'Sara' } as const;
const NIKOLAJ = { uid: 'u_nikolaj', firstName: 'Nikolaj' } as const;
const MEMBERS = [LINE, MADS, SARA, NIKOLAJ, { uid: ME, firstName: VIEWER.firstName }];

/** A placeholder photo that reads as one (a head and shoulders), not as an initial: Line's, the one shown. */
function silhouette(bg: string, skin: string, top: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${bg}"/><ellipse cx="128" cy="256" rx="92" ry="70" fill="${top}"/><circle cx="128" cy="112" r="50" fill="${skin}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ABOUT_LINE = {
  en: 'Moved to Aarhus in the summer, always up for a walk by the water',
  da: 'Flyttede til Aarhus i sommer og er altid frisk på en gåtur ved vandet',
} as const;

const scenario: Scenario = {
  id: 'pod-private-confirmed',
  title: 'A confirmed pod about a private interest (gravid): photos hidden until each member shows theirs',
  now: now('2026-11-29 11:00'),
  user: ONBOARDED_USER,
  photos: { ...CAST_PHOTOS, [LINE.uid]: silhouette('#CFC6EE', '#F4C2B0', '#4B3A8F') },
  docs: ({ locale }) => {
    const people = roster(MEMBERS, false) as Record<string, Record<string, unknown>>;
    return {
      ...profileWorld({ locale, lastDrop: { weekId: '2026-W48', outcome: 'proposed' } }),
      [`users/${ME}/pods/${POD_PRIVATE}`]: {
        state: 'planning',
        myStatus: 'accepted',
        themeLabel: 'gravid',
        themeSensitive: true,
        sizeTarget: 5,
        acceptedCount: 5,
        acceptBy: ts('2026-11-28 18:00'),
        reasons: [
          { code: 'THEME', yourWording: 'gravid' },
          { code: 'AREA', label: 'Aarhus C' },
          { code: 'NEAR_YOU', km: 10 },
        ],
        areaLabel: 'Aarhus C',
        photoShared: false,
      },
      [`pods/${POD_PRIVATE}`]: {
        state: 'planning',
        weekId: '2026-W48',
        areaLabel: 'Aarhus C',
        theme: { kind: 'concept', conceptId: 'c_9f8e7d6c5b4a39281706_p', sensitive: true },
        memberUids: MEMBERS.map((m) => m.uid),
        roster: { ...people, [LINE.uid]: { firstName: LINE.firstName, photoV: 1, aboutMe: ABOUT_LINE[locale] } },
        podInterests: { da: ['gåture', 'kaffe'], en: ['walks', 'coffee'] },
        planning: { deadline: ts('2026-12-01 18:00') },
        confirmedAt: ts('2026-11-28 18:00'),
      },
    };
  },
};

export default scenario;
