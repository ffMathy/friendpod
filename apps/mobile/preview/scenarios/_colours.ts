/**
 * Pods in the other pod colours, so the riskiest parts of blend decisions 5, 6 and 10 are shot, not only the Tomat
 * brætspil pod: a Fjord pod ("far på barsel", the longest name: the 56/52/48 fit rule and a wrap at a space), a
 * Solsikke pod (sourdough: Ink type on the field, the Tomat sun, the Solsikke-deep ring on the badge in the tint band),
 * a Blad pod (trail running: the white sun) and an open-to-anyone pod (no theme name; its colour comes from the pod
 * id, which lands on Blomme: white type and Paper people on the field). Each comes as a proposal (the tint band) and
 * as the reveal (the base field), on the week-46 timeline of the brætspil pod. The colours follow from the fixture
 * concept ids (_kit.ts) and the pod id (podColorIndex); names are placeholders.
 */
import type { Locale } from '@grouper/core';
import type { DocData } from '../runtime/types';
import { FAR_PAA_BARSEL_CONCEPT, ME, profileWorld, roster, SOURDOUGH_CONCEPT, SOURDOUGH_MEMBERS, TRAIL_RUNNING_CONCEPT, ts, VIEWER } from './_kit';
import { WEEK46 } from './_pod';

type Member = { readonly uid: string; readonly firstName: string };

export interface ColourPod {
  readonly podId: string;
  /** The viewer's wording, as on their card; `null` for an open-to-anyone pod. */
  readonly label: string | null;
  /** The theme's concept id (the viewer's interest that holds it); absent for open-to-anyone. */
  readonly conceptId?: string;
  /** The four others; the viewer comes last. */
  readonly others: readonly Member[];
  readonly podInterests: { readonly da: readonly string[]; readonly en: readonly string[] };
}

/** Fjord (seed_dads_on_leave): "far på barsel". */
export const FJORD_POD: ColourPod = {
  podId: 'farpaabarselpod46aaa',
  label: 'far på barsel',
  conceptId: FAR_PAA_BARSEL_CONCEPT,
  others: [
    { uid: 'u_anders', firstName: 'Anders' },
    { uid: 'u_jakob', firstName: 'Jakob' },
    { uid: 'u_mikkel', firstName: 'Mikkel' },
    { uid: 'u_rune', firstName: 'Rune' },
  ],
  podInterests: { da: ['gåture', 'kaffe'], en: ['walks', 'coffee'] },
};

/** Solsikke (seed_bread_baking): sourdough, with the This week sourdough people and one more. */
export const SOLSIKKE_POD: ColourPod = {
  podId: 'sourdoughpodwk46aaaa',
  label: 'sourdough',
  conceptId: SOURDOUGH_CONCEPT,
  others: [SOURDOUGH_MEMBERS.laura, SOURDOUGH_MEMBERS.kasper, SOURDOUGH_MEMBERS.nadia, { uid: 'u_frida', firstName: 'Frida' }],
  podInterests: { da: ['brætspil', 'kaffe'], en: ['board games', 'coffee'] },
};

/** Blad (seed_trail_runs): trail running. */
export const BLAD_POD: ColourPod = {
  podId: 'trailrunpodwk46aaaaa',
  label: 'trail running',
  conceptId: TRAIL_RUNNING_CONCEPT,
  others: [
    { uid: 'u_ida', firstName: 'Ida' },
    { uid: 'u_oliver', firstName: 'Oliver' },
    { uid: 'u_freja', firstName: 'Freja' },
    { uid: 'u_lukas', firstName: 'Lukas' },
  ],
  podInterests: { da: ['vandring', 'kaffe'], en: ['hiking', 'coffee'] },
};

/** Open to anyone: no theme, the colour from the pod id ("openpodaarhusweek46a" → Blomme). */
export const OPEN_POD: ColourPod = {
  podId: 'openpodaarhusweek46a',
  label: null,
  others: [
    { uid: 'u_camilla', firstName: 'Camilla' },
    { uid: 'u_peter', firstName: 'Peter' },
    { uid: 'u_asger', firstName: 'Asger' },
    { uid: 'u_johanne', firstName: 'Johanne' },
  ],
  podInterests: { da: ['madlavning'], en: ['cooking'] },
};

function reasons(pod: ColourPod): DocData[] {
  return [
    pod.label === null ? { code: 'OPEN_TO_ANYONE' } : { code: 'THEME', yourWording: pod.label },
    { code: 'AREA', label: 'Aarhus C' },
    { code: 'NEAR_YOU', km: 10 },
    { code: 'AGE_SPAN', min: 30, max: 39 },
  ];
}

function card(pod: ColourPod, stage: 'proposal' | 'confirmed'): DocData {
  return {
    state: stage === 'proposal' ? 'proposed' : 'planning',
    myStatus: stage === 'proposal' ? 'invited' : 'accepted',
    themeLabel: pod.label,
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: stage === 'proposal' ? 2 : 5,
    acceptBy: ts(WEEK46.acceptBy),
    reasons: reasons(pod),
    areaLabel: 'Aarhus C',
    ageSpan: { min: 30, max: 39 },
  };
}

/**
 * The world of a coloured pod: the viewer's profile and, at `proposal`, their card (Thursday's drop, not answered);
 * at `confirmed`, the card and the shared pod document (confirmed at Saturday's deadline, no time suggested yet).
 */
export function colourPodWorld(pod: ColourPod, stage: 'proposal' | 'confirmed', locale: Locale): Record<string, DocData> {
  const members = [...pod.others, { uid: ME, firstName: VIEWER.firstName }];
  return {
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${pod.podId}`]: card(pod, stage),
    ...(stage === 'confirmed'
      ? {
          [`pods/${pod.podId}`]: {
            state: 'planning',
            weekId: WEEK46.weekId,
            areaLabel: 'Aarhus C',
            theme: pod.conceptId ? { kind: 'concept', conceptId: pod.conceptId, sensitive: false } : { kind: 'openToAnyone' },
            memberUids: members.map((m) => m.uid),
            roster: roster(members, false),
            podInterests: pod.podInterests,
            planning: { deadline: ts(WEEK46.planDeadline) },
            confirmedAt: ts(WEEK46.confirmedAt),
          },
        }
      : {}),
  };
}
