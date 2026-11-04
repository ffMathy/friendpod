/**
 * Firestore document schemas (DESIGN.md §8). Client-readable documents first (§8.1), then server-only (§8.2).
 * Vector and Bytes fields are typed `unknown`: their SDK classes differ between firebase-admin and RNFirebase.
 */
import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  CARD_MEMBER_STATUSES,
  CONSENT_ACTIONS,
  CONSENT_SCOPES,
  DROP_OUTCOMES,
  ERASURE_KINDS,
  LAUNCH_AREA_STATUSES,
  MATCHING_PROFILE_IDS,
  PARTICIPATION_MODES,
  PLATFORMS,
  POD_STATES,
  REPORT_CATEGORIES,
  REVIEW_KINDS,
  SENSITIVE_HOLD_REASONS,
  SENSITIVITY_SOURCES,
} from '../types/domain';
import {
  art9CategorySchema,
  availabilitySchema,
  conceptIdSchema,
  docIdSchema,
  firstNameSchema,
  genderSchema,
  gh5Schema,
  httpsUrlSchema,
  interestIdSchema,
  languagesSchema,
  legalVersionSchema,
  localeSchema,
  podIdSchema,
  radiusKmSchema,
  sha256HexSchema,
  timestampSchema,
  uidHSchema,
  uidSchema,
  weekIdSchema,
} from './common';
import { prefsSchema } from './profile';
import { podReasonSchema, unmatchedReasonSchema } from './reasons';

const wording = z.string().min(1).max(80);
const vectorValue = z.unknown().refine((v) => v !== undefined && v !== null, { message: 'required' });

// ---------------------------------------------------------------- §8.1 client-readable

export const PAUSE_REASONS = ['user', 'declines', 'ignored', 'noShow', 'reports', 'underageReport'] as const;

export const userDocSchema = z.object({
  firstName: firstNameSchema,
  locale: localeSchema,
  birthYear: z.int().min(1900).max(2100),
  area: z.object({ gh5: gh5Schema, label: z.string().max(60), areaId: z.string().nullable() }),
  prefs: prefsSchema,
  gender: genderSchema.nullable(),
  participation: z.object({
    mode: z.enum(PARTICIPATION_MODES),
    pausedUntil: timestampSchema.optional(),
    pauseReason: z.enum(PAUSE_REASONS).optional(),
    skipWeekId: weekIdSchema.optional(),
  }),
  photo: z.object({ v: z.int().positive() }).nullable(),
  stats: z.object({ attended: z.int().min(0), noShows: z.int().min(0), lateCancels: z.int().min(0) }),
  status: z.enum(ACCOUNT_STATUSES),
  lastDrop: z.object({ weekId: weekIdSchema, outcome: z.enum(DROP_OUTCOMES), reason: unmatchedReasonSchema.optional() }).nullable(),
  legal: z.object({ terms: legalVersionSchema, privacy: legalVersionSchema, genderConsentAt: timestampSchema.optional() }),
  interestCount: z.int().min(0).max(20),
  createdAt: timestampSchema,
  lastActiveAt: timestampSchema,
});
export type UserDoc = z.infer<typeof userDocSchema>;

/** `users/{uid}/interests/{interestId}`: ordinary holdings. */
export const interestDocSchema = z
  .object({
    display: wording,
    norm: z.string().min(2).max(40),
    conceptId: conceptIdSchema.nullable(),
    starred: z.boolean(),
    state: z.enum(['active', 'pendingConsent']),
    pendingUntil: timestampSchema.optional(),
    createdAt: timestampSchema,
  })
  .refine((d) => d.state === 'pendingConsent' || d.conceptId !== null, { message: 'an active holding needs a conceptId' });
export type InterestDoc = z.infer<typeof interestDocSchema>;

/** `users/{uid}/sensitiveInterests/{interestId}`: sensitive holdings, always with a consent event. */
export const sensitiveInterestDocSchema = z.object({
  display: wording,
  norm: z.string().min(2).max(40),
  conceptId: conceptIdSchema,
  selfFlagged: z.boolean(),
  categoryConfirmed: art9CategorySchema.optional(),
  source: z.enum(SENSITIVITY_SOURCES),
  consentEventId: docIdSchema,
  consentTextVersion: z.string().min(1),
  consentedAt: timestampSchema,
  // DESIGN-DEVIATION: §8.1 lists no `starred` here, but updateInterest stars any interest (max 3).
  starred: z.boolean().default(false),
});
export type SensitiveInterestDoc = z.infer<typeof sensitiveInterestDocSchema>;

/** `users/{uid}/pods/{podId}`: the viewer's pod card. */
export const podCardDocSchema = z
  .object({
    state: z.enum(POD_STATES),
    myStatus: z.enum(CARD_MEMBER_STATUSES),
    /** The viewer's own wording; null for an open-to-anyone pod. */
    themeLabel: wording.nullable(),
    themeSensitive: z.boolean(),
    sizeTarget: z.int().min(4).max(6),
    acceptedCount: z.int().min(0).max(6),
    acceptBy: timestampSchema,
    reasons: z.array(podReasonSchema).max(10),
    areaLabel: z.string().max(60),
    ageSpan: z.object({ min: z.int(), max: z.int() }).optional(),
    photoShared: z.boolean().optional(),
    expiresAt: timestampSchema.optional(),
  })
  .refine(
    (c) => !c.themeSensitive || (c.ageSpan === undefined && !c.reasons.some((r) => r.code === 'ALSO_SHARE' || r.code === 'AGE_SPAN')),
    { message: 'sensitive-themed cards carry no age span or shared interests' },
  );
export type PodCardDoc = z.infer<typeof podCardDocSchema>;

export const userBlockDocSchema = z.object({
  /** As shown in the shared pod's roster; empty if the pod was never confirmed. */
  firstName: z.string().max(30),
  podId: podIdSchema,
  since: timestampSchema,
});

/** Notice params are ids, dates and counts only, never tag, option or report text. */
const noticeParam = z.union([z.string().regex(/^[A-Za-z0-9_:.-]{0,64}$/), z.number(), z.boolean()]);
export const noticeDocSchema = z.object({
  type: z.enum(['statementOfReasons', 'system']),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  params: z.record(z.string(), noticeParam),
  createdAt: timestampSchema,
  readAt: timestampSchema.optional(),
  expiresAt: timestampSchema,
});
export type NoticeDoc = z.infer<typeof noticeDocSchema>;

export const exportDocSchema = z.object({
  status: z.enum(['pending', 'ready', 'failed']),
  path: z.string().optional(),
  expiresAt: timestampSchema,
});

/** Pod theme in shared docs: a concept id and its sensitivity, never a label (§6.7). */
export const podThemeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('concept'), conceptId: conceptIdSchema, sensitive: z.boolean() }),
  z.object({ kind: z.literal('openToAnyone') }),
]);

/** `pods/{podId}`: shared, created at confirmation. */
export const podDocSchema = z
  .object({
    state: z.enum(POD_STATES),
    weekId: weekIdSchema,
    areaLabel: z.string().max(60),
    theme: podThemeSchema,
    memberUids: z.array(uidSchema).max(6),
    roster: z.record(uidSchema, z.object({ firstName: firstNameSchema, photoV: z.int().positive().nullable() })),
    podInterests: z.object({ da: z.array(wording).max(5), en: z.array(wording).max(5) }),
    planning: z.object({
      deadline: timestampSchema,
      winningOptionId: docIdSchema.optional(),
      meetupAt: timestampSchema.optional(),
      placeText: z.string().max(120).optional(),
      mapUrl: httpsUrlSchema.optional(),
    }),
    confirmedAt: timestampSchema,
    archivedAt: timestampSchema.optional(),
  })
  .refine((p) => p.memberUids.every((uid) => uid in p.roster) && Object.keys(p.roster).length === p.memberUids.length, {
    message: 'roster must list exactly the current members',
  });
export type PodDoc = z.infer<typeof podDocSchema>;

export const optionDocSchema = z.object({
  authorUid: uidSchema,
  startsAt: timestampSchema,
  placeText: z.string().min(1).max(120),
  mapUrl: httpsUrlSchema.nullable(),
  publicPlace: z.literal(true),
  votes: z.record(uidSchema, z.enum(['yes', 'no'])),
  createdAt: timestampSchema,
});

export const OPTED_IN_BUCKETS = ['<50', '50+', '100+', '150+', '200+', '500+', '1000+'] as const;

export const areaDocSchema = z.object({
  label: z.object({ da: z.string(), en: z.string() }),
  status: z.enum(LAUNCH_AREA_STATUSES),
  profile: z.enum(MATCHING_PROFILE_IDS),
  optedInBucket: z.enum(OPTED_IN_BUCKETS),
  goal: z.object({ optedIn: z.int(), predictedMatchRate: z.number(), consecutiveWeeks: z.int() }),
  chips: z.array(z.object({ conceptId: conceptIdSchema, da: wording, en: wording })).max(30),
  configVersion: z.int(),
});

export const configAppDocSchema = z.object({
  minAppVersion: z.string(),
  legalVersions: z.record(z.string(), legalVersionSchema),
  skipWeeks: z.array(weekIdSchema),
  features: z.object({ embedder: z.boolean(), uploads: z.boolean() }).catchall(z.boolean()),
});

// ---------------------------------------------------------------- §8.2 server-only

export const matchThemeSchema = z.union([
  z.object({ c: conceptIdSchema, starred: z.boolean(), sens: z.literal(false) }),
  z.object({ c: conceptIdSchema, starred: z.boolean(), sens: z.literal(true), consentRef: docIdSchema }),
]);

export const matchProfileDocSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
    areaId: z.string().nullable(),
    gh5: gh5Schema,
    birthYear: z.int(),
    ageMin: z.int(),
    ageMax: z.int(),
    maxKm: radiusKmSchema,
    sameGenderOnly: z.boolean(),
    gender: genderSchema.nullable(),
    languages: languagesSchema,
    availability: availabilitySchema,
    themes: z.array(matchThemeSchema).max(20),
    themeIds: z.array(conceptIdSchema).max(20),
    secondary: z.array(conceptIdSchema).max(20),
    blockedH: z.array(uidHSchema),
    recentH: z.record(uidHSchema, weekIdSchema),
    recentMinUntil: weekIdSchema.nullable(),
    reliability: z.number().min(0).max(1),
    noShowEvents: z.array(z.object({ weekId: weekIdSchema, w: z.literal([1, 0.5]) })).max(8),
    waitingSinceWeek: weekIdSchema,
    declinesInRow: z.int().min(0),
    ignoredInRow: z.int().min(0),
    activePods: z.int().min(0),
    activeSensitivePods: z.int().min(0),
    sensitiveProposals: z.array(weekIdSchema),
    sensitiveHold: z.object({ reason: z.enum(SENSITIVE_HOLD_REASONS), since: timestampSchema }).nullable(),
    weekClaim: weekIdSchema.nullable(),
    lastDrop: z.object({ weekId: weekIdSchema, outcome: z.enum(DROP_OUTCOMES), podId: podIdSchema.optional() }).nullable(),
    // DESIGN-DEVIATION: §8.2 lacks the inputs S5 and f(u) need: verified attendance, the alpha
    // founder-invite waiver, open reports against the user, the dissolved-pod priority, and Q12's flag.
    attendedVerified: z.int().min(0),
    founderInvited: z.boolean(),
    openReportCount: z.int().min(0),
    priority: z.boolean(),
    openToAnyone: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((p) => {
    const ordinary = new Set(p.themes.filter((t) => !t.sens).map((t) => t.c));
    return p.secondary.every((c) => ordinary.has(c));
  }, { message: 'secondary must come from ordinary holdings only (S2)' })
  .refine((p) => p.themeIds.length === p.themes.length && p.themes.every((t, i) => p.themeIds[i] === t.c), {
    message: 'themeIds must mirror themes',
  });
export type MatchProfileDoc = z.infer<typeof matchProfileDocSchema>;

export const ASSIGN_METHODS = ['merge', 'new', 'newWithLink', 'newWithMergeProposal', 'seed', 'alias', 'review'] as const;

export const tagDocSchema = z.object({
  norm: z.string().min(2).max(40),
  vec: vectorValue,
  modelId: z.string(),
  sens: z.object({
    suspected: z.boolean(),
    margin: z.number().nullable(),
    lexiconHit: z.boolean(),
    categoryGuess: art9CategorySchema.nullable(),
    rulesVersion: z.string(),
    reviewed: z.enum(['sensitive', 'not']).optional(),
    reviewedAt: timestampSchema.optional(),
  }),
  moderation: z.object({ status: z.enum(['ok', 'shadowFlag']), rulesVersion: z.string() }),
  conceptId: conceptIdSchema.nullable(),
  assign: z.object({ cos: z.number(), method: z.enum(ASSIGN_METHODS) }),
  privateAssign: z.object({ conceptId: conceptIdSchema, refCount: z.int().min(0) }).optional(),
  aliasVotes: z.record(conceptIdSchema, z.int().min(0)),
  refCount: z.int().min(0),
  langHints: z.object({ da: z.int().min(0), en: z.int().min(0) }),
  pinned: z.boolean().optional(),
  createdAt: timestampSchema,
});

export const conceptDocSchema = z
  .object({
    centroid: vectorValue,
    c128: vectorValue,
    medoid: vectorValue,
    sum: vectorValue,
    n: z.int().min(0),
    sensitive: z.boolean(),
    category: art9CategorySchema.optional(),
    labels: z.object({ da: wording.optional(), en: wording.optional() }),
    holderCount: z.int().min(0),
    status: z.enum(['active', 'merged']),
    mergedInto: conceptIdSchema.optional(),
    gen: z.int().min(0),
    seed: z.boolean().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((c) => !c.sensitive || (c.labels.da === undefined && c.labels.en === undefined && c.holderCount === 0), {
    message: 'sensitive concepts have no derived labels or holder counts',
  })
  .refine((c) => (c.status === 'merged') === (c.mergedInto !== undefined), { message: 'mergedInto iff merged' });

export const conceptLinkDocSchema = z.object({
  cos: z.number(),
  status: z.enum(['candidate', 'confirmed', 'rejected']),
  votes: z.int().min(0),
});

export const PODSTATE_MEMBER_STATUSES = ['invited', 'accepted', 'declined', 'left', 'removed'] as const;

export const podStateDocSchema = z.object({
  weekId: weekIdSchema,
  componentId: z.string(),
  state: z.enum(POD_STATES),
  timers: z.object({
    acceptBy: timestampSchema,
    backfillUntil: timestampSchema.optional(),
    planDeadline: timestampSchema.optional(),
    meetupAt: timestampSchema.optional(),
    feedbackCloses: timestampSchema.optional(),
  }),
  memberList: z.array(uidSchema),
  members: z.record(
    uidSchema,
    z.object({
      status: z.enum(PODSTATE_MEMBER_STATUSES),
      invitedAt: timestampSchema,
      respondedAt: timestampSchema.optional(),
      viaBackfill: z.boolean(),
      themeInterestId: interestIdSchema.nullable(),
      reasons: z.array(podReasonSchema),
    }),
  ),
  hasMet: z.boolean(),
  rescheduled: z.boolean(),
  score: z.number(),
  backfill: z.object({ used: z.boolean(), until: timestampSchema.optional() }),
  version: z.int().min(0),
});
export type PodStateDoc = z.infer<typeof podStateDocSchema>;

export const podFeedbackDocSchema = z.object({
  met: z.boolean(),
  attendance: z.record(uidSchema, z.enum(['came', 'noShow'])),
  meetAgain: z.record(uidSchema, z.boolean()),
  rating: z.int().min(1).max(5).optional(),
  keep: z.boolean(),
  disputes: z.array(uidSchema).optional(),
});

/** Aggregate counts in `drops`: any cell under 10 is stored as "<10" (§6.6). */
export const suppressedCountSchema = z.union([z.int().min(10), z.literal(0), z.literal('<10')]);
export function suppressSmallCount(n: number): number | '<10' {
  return n > 0 && n < 10 ? '<10' : n;
}

export const dropComponentDocSchema = z.object({
  status: z.enum(['snapshotted', 'computed', 'released', 'failed']),
  dryRun: z.boolean(),
  inputHash: sha256HexSchema,
  inputPath: z.string(),
  computed: z.object({ inputHash: sha256HexSchema, path: z.string() }).optional(),
  stats: z.record(z.string(), z.union([z.number(), z.literal('<10')])).optional(),
});

export const consentEventDocSchema = z
  .object({
    uid: uidSchema.optional(),
    uidH: uidHSchema.optional(),
    scope: z.enum(CONSENT_SCOPES),
    interestId: interestIdSchema.optional(),
    category: art9CategorySchema.optional(),
    action: z.enum(CONSENT_ACTIONS),
    textVersion: z.string(),
    textSha256: sha256HexSchema,
    locale: localeSchema,
    appVersion: z.string().max(32),
    method: z.literal('checkbox+button'),
    createdAt: timestampSchema,
    redactedAt: timestampSchema.optional(),
    expiresAt: timestampSchema.optional(),
  })
  .refine((e) => (e.uid === undefined) !== (e.uidH === undefined), { message: 'exactly one of uid / uidH' });

export const blockDocSchema = z.object({ blocker: uidSchema, blocked: uidSchema, podId: podIdSchema, createdAt: timestampSchema });

export const reportDocSchema = z
  .object({
    reporterUid: uidSchema.optional(),
    reporterH: uidHSchema.optional(),
    targetUid: uidSchema.optional(),
    targetH: uidHSchema.optional(),
    podId: podIdSchema,
    target: z.object({ type: z.enum(['user', 'option', 'interest']), optionId: docIdSchema.optional() }),
    category: z.enum(REPORT_CATEGORIES),
    text: z.string().max(500).optional(),
    status: z.enum(['open', 'resolved']),
    decision: z.string().optional(),
    decidedBy: z.string().optional(),
    createdAt: timestampSchema,
    resolvedAt: timestampSchema.optional(),
    expiresAt: timestampSchema,
  })
  .refine((r) => (r.reporterUid === undefined) !== (r.reporterH === undefined), { message: 'exactly one of reporterUid / reporterH' })
  .refine((r) => (r.targetUid === undefined) !== (r.targetH === undefined), { message: 'exactly one of targetUid / targetH' });

export const sanctionDocSchema = z.object({
  type: z.enum(['pause', 'suspension', 'ban']),
  until: timestampSchema.optional(),
  reasonCode: z.string(),
  noticeId: docIdSchema,
});

export const banDocSchema = z.object({ reasonCode: z.string(), createdAt: timestampSchema, expiresAt: timestampSchema });

const TAG_REVIEW_KINDS: readonly string[] = ['tagSensitivity', 'conceptMerge', 'abuseHold'];
const UID_REVIEW_KINDS: readonly string[] = ['report', 'sensitiveAnomaly'];
export const reviewQueueDocSchema = z
  .object({
    kind: z.enum(REVIEW_KINDS),
    ref: z.string(),
    text: z.string().max(40).optional(),
    uid: uidSchema.optional(),
    status: z.enum(['open', 'decided']),
    decision: z.string().optional(),
    expiresAt: timestampSchema.optional(),
  })
  .refine((q) => q.text === undefined || TAG_REVIEW_KINDS.includes(q.kind), { message: 'text only on tag kinds' })
  .refine((q) => q.uid === undefined || UID_REVIEW_KINDS.includes(q.kind), { message: 'uid only on report / sensitiveAnomaly' });

export const photoGrantDocSchema = z.object({ pods: z.array(podIdSchema).min(1), createdAt: timestampSchema });

export const pushTokensDocSchema = z.object({
  tokens: z.array(z.object({ token: z.string().min(1).max(4096), platform: z.enum(PLATFORMS), updatedAt: timestampSchema })),
});

export const rateLimitDocSchema = z.object({ count: z.int().min(0), windowStart: timestampSchema, expiresAt: timestampSchema });

export const erasureLedgerDocSchema = z.object({
  uidH: uidHSchema,
  kind: z.enum(ERASURE_KINDS),
  ref: z.string().optional(),
  at: timestampSchema,
  expiresAt: timestampSchema,
});

export const underageMarkerDocSchema = z.object({ createdAt: timestampSchema, expiresAt: timestampSchema });
