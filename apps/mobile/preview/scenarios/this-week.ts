import type { Scenario } from '../runtime/types';
import {
  BAKERY_CAFE,
  BLOCKED,
  CAST_PHOTOS,
  INTEREST_IDS,
  interestDocs,
  ME,
  MEMBERS,
  now,
  ONBOARDED_USER,
  place,
  POD_SOURDOUGH,
  profileWorld,
  roster,
  SOURDOUGH_CONCEPT,
  SOURDOUGH_MEMBERS,
  ts,
  VIEWER,
} from './_kit';

const POD_CLIMBING = 'climbingpodaarhus42a';
/** The past climbing pod's theme concept: podColorIndex gives Bær, so the Pods tab shows two pods in two colours. */
const CLIMBING_CONCEPT = 'seed_rock_climbing';

/**
 * An ordinary Tuesday in week 46 (storyboard 2.1 and the Me/Privacy screens 5.2–5.4): next drop Thursday 18:00, one
 * active pod (sourdough, Saturday 14:00 at a bakery café in Frederiksbjerg), a past pod, 5 interests of which one is
 * private, one blocked person, two notices and a ready data export.
 */
const climbingMembers = [MEMBERS.sofie, SOURDOUGH_MEMBERS.kasper, { uid: ME, firstName: VIEWER.firstName }];
const sourdoughMembers = [SOURDOUGH_MEMBERS.laura, SOURDOUGH_MEMBERS.kasper, SOURDOUGH_MEMBERS.nadia, { uid: ME, firstName: VIEWER.firstName }];

const scenario: Scenario = {
  id: 'this-week',
  title: 'Onboarded member on Tuesday of week 46: one scheduled pod, settings data',
  now: now('2026-11-10 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  pushPermission: 'granted',
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W45', outcome: 'proposed' } }),
    // Storyboard 5.2: "far på barsel" was once treated as sensitive and the viewer chose "This isn't sensitive for me",
    // so its row offers "Keep this private" at hand.
    [`users/${ME}/interests/${INTEREST_IDS.farPaaBarsel}`]: {
      ...interestDocs()[`users/${ME}/interests/${INTEREST_IDS.farPaaBarsel}`],
      notSensitiveForMe: true,
    },
    [`users/${ME}/pods/${POD_SOURDOUGH}`]: {
      state: 'scheduled',
      myStatus: 'accepted',
      themeLabel: 'sourdough',
      themeSensitive: false,
      sizeTarget: 4,
      acceptedCount: 4,
      acceptBy: ts('2026-11-07 18:00'),
      reasons: [
        { code: 'THEME', yourWording: 'sourdough' },
        { code: 'AREA', label: 'Aarhus C' },
        { code: 'NEAR_YOU', km: 5 },
      ],
      areaLabel: 'Aarhus C',
      ageSpan: { min: 30, max: 41 },
    },
    [`pods/${POD_SOURDOUGH}`]: {
      state: 'scheduled',
      weekId: '2026-W45',
      areaLabel: 'Aarhus C',
      theme: { kind: 'concept', conceptId: SOURDOUGH_CONCEPT, sensitive: false },
      memberUids: sourdoughMembers.map((m) => m.uid),
      roster: roster(sourdoughMembers),
      podInterests: { da: ['kaffe'], en: ['coffee'] },
      planning: {
        deadline: ts('2026-11-10 18:00'),
        winningOptionId: 'optionBakery',
        meetupAt: ts('2026-11-14 14:00'),
        planLockedAt: ts('2026-11-09 12:30'),
        // A placeholder in the reader's language: no real venue, and no English inside Danish copy.
        place: locale === 'da' ? place('placeholderBakeryCafe01', '[Bagericafé]', 'Frederiksbjerg, Aarhus C', 56.147, 10.203, 'bakery') : BAKERY_CAFE,
      },
      attendance: Object.fromEntries(sourdoughMembers.map((m) => [m.uid, 'pending'])),
      confirmedAt: ts('2026-11-06 20:10'),
    },
    [`users/${ME}/pods/${POD_CLIMBING}`]: {
      state: 'archived',
      myStatus: 'accepted',
      themeLabel: 'climbing',
      themeSensitive: false,
      sizeTarget: 4,
      acceptedCount: 4,
      acceptBy: ts('2026-10-24 18:00'),
      reasons: [{ code: 'THEME', yourWording: 'climbing' }],
      areaLabel: 'Aarhus C',
      ageSpan: { min: 27, max: 39 },
    },
    // The past pod's shared document (members may still read it): the Pods tab draws it in its concept's colour with
    // the remaining members' avatars. Rasmus left on 31 Oct (the viewer blocked him; see the notice below).
    [`pods/${POD_CLIMBING}`]: {
      state: 'archived',
      weekId: '2026-W43',
      areaLabel: 'Aarhus C',
      theme: { kind: 'concept', conceptId: CLIMBING_CONCEPT, sensitive: false },
      memberUids: climbingMembers.map((m) => m.uid),
      roster: roster(climbingMembers),
      podInterests: { da: ['løb'], en: ['running'] },
      planning: { deadline: ts('2026-10-27 18:00'), meetupAt: ts('2026-10-31 14:00'), planLockedAt: ts('2026-10-27 18:00') },
      confirmedAt: ts('2026-10-23 19:40'),
      archivedAt: ts('2026-11-03 14:00'),
    },
    [`users/${ME}/blocks/${BLOCKED.uid}`]: { firstName: BLOCKED.firstName, podId: POD_CLIMBING, since: ts('2026-10-31 21:00') },
    [`users/${ME}/notices/noticeExport`]: {
      type: 'system',
      code: 'EXPORT_READY',
      params: { exportId: 'exportNov' },
      createdAt: ts('2026-11-09 09:12'),
      expiresAt: ts('2026-11-10 09:12'),
    },
    [`users/${ME}/notices/noticeMemberLeft`]: {
      type: 'system',
      code: 'POD_MEMBER_LEFT',
      params: { podId: POD_CLIMBING },
      createdAt: ts('2026-10-31 21:00'),
      readAt: ts('2026-11-01 08:00'),
      expiresAt: ts('2026-12-01 21:00'),
    },
    [`users/${ME}/exports/exportNov`]: { status: 'ready', path: `exports/${ME}/exportNov.zip`, expiresAt: ts('2026-11-10 21:12') },
  }),
};

export default scenario;
