/**
 * Firestore document schemas (DESIGN.md §8). Client-readable documents first (§8.1), then server-only (§8.2).
 * Vector and Bytes fields are typed `unknown`: their SDK classes differ between firebase-admin and RNFirebase.
 */
import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  ATTENDANCE_STATUSES,
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
  REPORT_TARGET_TYPES,
  SENSITIVE_HOLD_REASONS,
  SENSITIVITY_SOURCES,
} from '../types/domain';
import {
  availabilitySchema,
  conceptIdSchema,
  docIdSchema,
  firstNameSchema,
  genderSchema,
  gh5Schema,
  interestIdSchema,
  languagesSchema,
  legalVersionSchema,
  localeSchema,
  placeSchema,
  podIdSchema,
  radiusKmSchema,
  sha256HexSchema,
  timestampSchema,
  uidHSchema,
  uidSchema,
  weekIdSchema,
} from './common';
import { CHAT_MESSAGE_MAX } from './callables';
import { aboutMeSchema, prefsSchema } from './profile';
import { podReasonSchema, unmatchedReasonSchema } from './reasons';
import { FUNNEL_NO_AREA, type FunnelStage, type HeardFromSource, type MilestoneField } from '../metrics/funnel';

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
    // DESIGN-DEVIATION: §8.1 has no field for a manual-mode user's weekly opt-in ("manual for this week", §10.1).
    optInWeekId: weekIdSchema.optional(),
  }),
  photo: z.object({ v: z.int().positive() }).nullable(),
  stats: z.object({ attended: z.int().min(0), noShows: z.int().min(0), lateCancels: z.int().min(0) }),
  status: z.enum(ACCOUNT_STATUSES),
  lastDrop: z.object({ weekId: weekIdSchema, outcome: z.enum(DROP_OUTCOMES), reason: unmatchedReasonSchema.optional() }).nullable(),
  legal: z.object({
    terms: legalVersionSchema,
    privacy: legalVersionSchema,
    genderConsentAt: timestampSchema.optional(),
    /** The blanket Art. 9 consent (D3); absent when never given or withdrawn. */
    art9: z.object({ textVersion: z.string().regex(/^[a-z0-9-]{3,64}$/), textSha256: sha256HexSchema, at: timestampSchema }).optional(),
  }),
  /** "About me" (D4): shown to confirmed co-members only, never used for matching; exported and erased with the account. */
  aboutMe: aboutMeSchema.optional(),
  interestCount: z.int().min(0).max(20),
  createdAt: timestampSchema,
  lastActiveAt: timestampSchema,
  /**
   * DESIGN-DEVIATION: §8.1 names no field for the inactivity warning. Set by dailyMaintenance when it warns after 12
   * months without activity; the account is deleted 30 days later unless `lastActiveAt` has moved past it.
   */
  inactivityWarnedAt: timestampSchema.optional(),
});
export type UserDoc = z.infer<typeof userDocSchema>;

/** `users/{uid}/interests/{interestId}`: ordinary holdings. */
export const interestDocSchema = z
  .object({
    display: wording,
    norm: z.string().min(2).max(40),
    conceptId: conceptIdSchema.nullable(),
    starred: z.boolean(),
    /** The user chose "This isn't sensitive for me" for a sensitive tag (D2); rescans leave this holding alone. */
    notSensitiveForMe: z.boolean().optional(),
    state: z.enum(['active', 'pendingConsent']),
    pendingUntil: timestampSchema.optional(),
    createdAt: timestampSchema,
  })
  .refine((d) => d.state === 'pendingConsent' || d.conceptId !== null, { message: 'an active holding needs a conceptId' });
export type InterestDoc = z.infer<typeof interestDocSchema>;

/** `users/{uid}/sensitiveInterests/{interestId}`: sensitive holdings, each pointing at the blanket consent's grant event. */
export const sensitiveInterestDocSchema = z.object({
  display: wording,
  norm: z.string().min(2).max(40),
  conceptId: conceptIdSchema,
  selfFlagged: z.boolean(),
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

/**
 * Pod theme in shared docs: a concept id and its sensitivity, never a label (§6.7).
 * DESIGN-DEVIATION: §8.1 has `theme: {conceptId, sensitive}`; the `kind` tag adds Q12's open-to-anyone
 * theme, which has no concept (cards then carry `themeLabel: null`).
 */
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
    /** `aboutMe` (D4) is copied at confirmation and on change, and leaves with the member. */
    roster: z.record(uidSchema, z.object({ firstName: firstNameSchema, photoV: z.int().positive().nullable(), aboutMe: aboutMeSchema.optional() })),
    podInterests: z.object({ da: z.array(wording).max(5), en: z.array(wording).max(5) }),
    planning: z.object({
      deadline: timestampSchema,
      /** The one 24 h extension round is running ("No time works yet — add another option", D7). */
      extended: z.boolean().optional(),
      winningOptionId: docIdSchema.optional(),
      meetupAt: timestampSchema.optional(),
      /** When the plan locked (`podState.planLockedAt`), so the app derives the same meetupTimers as the server. */
      planLockedAt: timestampSchema.optional(),
      place: placeSchema.optional(),
    }),
    /** Per member while `scheduled` (D5); others see "<firstName> hasn't confirmed" for 'unconfirmed'. */
    attendance: z.record(uidSchema, z.enum(ATTENDANCE_STATUSES)).optional(),
    confirmedAt: timestampSchema,
    archivedAt: timestampSchema.optional(),
  })
  .refine((p) => p.memberUids.every((uid) => uid in p.roster) && Object.keys(p.roster).length === p.memberUids.length, {
    message: 'roster must list exactly the current members',
  })
  .refine((p) => p.attendance === undefined || Object.keys(p.attendance).every((uid) => p.memberUids.includes(uid)), {
    message: 'attendance only for current members',
  });
export type PodDoc = z.infer<typeof podDocSchema>;

export const optionDocSchema = z.object({
  authorUid: uidSchema,
  startsAt: timestampSchema,
  place: placeSchema,
  votes: z.record(uidSchema, z.enum(['yes', 'no'])),
  createdAt: timestampSchema,
});

/** `pods/{podId}/messages/{messageId}`: text only (D14); `expiresAt` is meetupAt + 72 h (TTL). */
export const podMessageDocSchema = z.object({
  authorUid: uidSchema,
  text: z.string().min(1).max(CHAT_MESSAGE_MAX),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});
export type PodMessageDoc = z.infer<typeof podMessageDocSchema>;

/**
 * `areas/{areaId}`, readable by onboarded users. `waitlistCount` is exact: the number of onboarded accounts whose home
 * cell is in the area, kept by the server in the same transaction as onboarding, an area change and erasure (founder
 * decision 2026-11-05: an exact city total is fine; the app shows "<10" below 10, `waitlistDisplay`). It replaces the
 * earlier bucketed `optedInBucket`. `goal.waitlist` is the counter's goal ("N of 250"); `goal.optedIn` and the rest
 * stay the Q11 go-live criteria.
 */
export const areaDocSchema = z.object({
  label: z.object({ da: z.string(), en: z.string() }),
  status: z.enum(LAUNCH_AREA_STATUSES),
  profile: z.enum(MATCHING_PROFILE_IDS),
  waitlistCount: z.int().min(0),
  goal: z.object({ waitlist: z.int().positive(), optedIn: z.int(), predictedMatchRate: z.number(), consecutiveWeeks: z.int() }),
  chips: z.array(z.object({ conceptId: conceptIdSchema, da: wording, en: wording })).max(30),
  configVersion: z.int(),
});
export type AreaDoc = z.infer<typeof areaDocSchema>;

/** `features.interests` is the kill switch for addInterests (it was `embedder` before D1). */
export const configAppDocSchema = z.object({
  minAppVersion: z.string(),
  legalVersions: z.record(z.string(), legalVersionSchema),
  skipWeeks: z.array(weekIdSchema),
  features: z.object({ interests: z.boolean(), uploads: z.boolean() }).catchall(z.boolean()),
});

// ---------------------------------------------------------------- §8.2 server-only

export const matchThemeSchema = z.union([
  z.object({ c: conceptIdSchema, starred: z.boolean(), sens: z.literal(false) }),
  z.object({ c: conceptIdSchema, starred: z.boolean(), sens: z.literal(true), consentRef: docIdSchema }),
]);

/** Per-user funnel milestones on `matchProfiles` (§6.8), one per FUNNEL_STAGES entry (FUNNEL_MILESTONE_FIELD). */
export const milestonesSchema = z.strictObject({
  signupAt: timestampSchema.optional(),
  onboardedAt: timestampSchema.optional(),
  waitlistedAt: timestampSchema.optional(),
  firstDropEligibleAt: timestampSchema.optional(),
  firstProposalAt: timestampSchema.optional(),
  firstConfirmedAt: timestampSchema.optional(),
  firstMeetupHappenedAt: timestampSchema.optional(),
  secondMeetupAt: timestampSchema.optional(),
} satisfies Record<MilestoneField, unknown>);
export type Milestones = z.infer<typeof milestonesSchema>;

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
    sensitiveHold: z.object({ reason: z.enum(SENSITIVE_HOLD_REASONS), since: timestampSchema, until: timestampSchema }).nullable(),
    weekClaim: weekIdSchema.nullable(),
    lastDrop: z.object({ weekId: weekIdSchema, outcome: z.enum(DROP_OUTCOMES), podId: podIdSchema.optional() }).nullable(),
    // DESIGN-DEVIATION: §8.2 lacks the inputs S5 and f(u) need: verified attendance, the alpha
    // founder-invite waiver, open reports against the user, the dissolved-pod priority, and Q12's flag.
    attendedVerified: z.int().min(0),
    founderInvited: z.boolean(),
    openReportCount: z.int().min(0),
    priority: z.boolean(),
    openToAnyone: z.boolean(),
    // DESIGN-DEVIATION: §8.2 has no participation fields, but dropOrchestrator selects opted-in profiles and
    // releaseDrop revalidates pause/skip from matchProfiles alone (§10.3), so setParticipation mirrors them here.
    participation: z.object({
      mode: z.enum(PARTICIPATION_MODES),
      skipWeekId: weekIdSchema.nullable(),
      optInWeekId: weekIdSchema.nullable(),
      pausedUntil: timestampSchema.nullable(),
    }),
    /**
     * Funnel milestones (§6.8): when each stage first happened for this user, so the uid-free `funnel` counters count
     * every user once per stage. Server-only like the rest of this doc and erased with it. A missing
     * `firstConfirmedAt` also makes the user a first-timer in matching (§6.2).
     */
    milestones: milestonesSchema.default({}),
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

/** Concepts change only through these: the thresholds, seeds and alias votes. No merge proposals, no review (D2). */
export const ASSIGN_METHODS = ['merge', 'new', 'newWithLink', 'seed', 'alias'] as const;

/**
 * `tags/{tagKey}`. `vec` is the first client vector for this text (trusted, D1); `sens` is the tag-level decision.
 * `privateAssign` caches the sensitive-partition concept for self-flagged holdings of an ordinary tag, and
 * `ordinaryAssign` the ordinary-partition concept for "This isn't sensitive for me" holdings of a sensitive tag.
 */
export const tagDocSchema = z.object({
  norm: z.string().min(2).max(40),
  vec: vectorValue,
  modelId: z.string(),
  sens: z.object({
    sensitive: z.boolean(),
    margin: z.number().nullable(),
    lexiconHit: z.boolean(),
    knownOrdinary: z.boolean(),
    /** LEXICON_RULES_VERSION, prototype list versions and KNOWN_ORDINARY_VERSION the decision used. */
    rulesVersion: z.string(),
  }),
  moderation: z.object({ status: z.enum(['ok', 'shadowFlag']), rulesVersion: z.string() }),
  conceptId: conceptIdSchema.nullable(),
  assign: z.object({ cos: z.number(), method: z.enum(ASSIGN_METHODS) }),
  privateAssign: z.object({ conceptId: conceptIdSchema, refCount: z.int().min(0) }).optional(),
  ordinaryAssign: z.object({ conceptId: conceptIdSchema, refCount: z.int().min(0) }).optional(),
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

/** Every timer the sweeper acts on (§4.1, D5, D7, D12), absolute instants computed in Europe/Copenhagen. */
export const podStateTimersSchema = z.object({
  acceptBy: timestampSchema,
  backfillUntil: timestampSchema.optional(),
  planDeadline: timestampSchema.optional(),
  meetupAt: timestampSchema.optional(),
  stillComing3d: timestampSchema.optional(),
  stillComing24h: timestampSchema.optional(),
  nudge6h: timestampSchema.optional(),
  attendanceCheck: timestampSchema.optional(),
  feedbackPush: timestampSchema.optional(),
  feedbackReminder: timestampSchema.optional(),
  feedbackCloses: timestampSchema.optional(),
  // DESIGN-DEVIATION: §8.2 lists no timers for the T−2 h reminder and T+2 h → `happened`; every timer the sweeper acts
  // on is stored, and each one is deleted once it has been processed, so a retried sweep never repeats it.
  reminder: timestampSchema.optional(),
  happened: timestampSchema.optional(),
  /**
   * DESIGN-DEVIATION: a one-time watchdog 15 minutes after a backfill round starts. If the `backfillPod` task was never
   * enqueued (an enqueue failure after the commit) and nobody was invited yet, the sweeper enqueues it again.
   */
  backfillRetry: timestampSchema.optional(),
});

/**
 * DESIGN-DEVIATION: §8.2 has no status for an invitation that ran out unanswered (`acceptBy`, or a backfill
 * invitation's `backfillUntil`); `expired` counts towards `ignoredInRow`, never as a decline.
 */
export const PODSTATE_MEMBER_STATUSES = ['invited', 'accepted', 'declined', 'left', 'removed', 'expired'] as const;

export const podStateDocSchema = z.object({
  weekId: weekIdSchema,
  componentId: z.string(),
  state: z.enum(POD_STATES),
  /**
   * DESIGN-DEVIATION: §8.2 keeps the theme only on `pods` (from confirmation) and on each card (as wording). Backfill
   * of a `proposed` pod needs the concept for its pool query, so the server-only podState carries it too (no label).
   */
  theme: podThemeSchema,
  /** Initial size of the proposal (cards' `sizeTarget`). */
  sizeTarget: z.int().min(3).max(6),
  timers: podStateTimersSchema,
  /**
   * DESIGN-DEVIATION: the earliest unprocessed timer of the current state, so `hourlySweeper` queries one indexed field
   * (`dueAt <= now`) instead of every timer field. Absent in `archived` and `dissolved`.
   */
  dueAt: timestampSchema.optional(),
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
      /** While `scheduled` (D5); mirrored to `pods.attendance`. */
      attendance: z.enum(ATTENDANCE_STATUSES).optional(),
      attendanceAt: timestampSchema.optional(),
      /** A "Can't make it" under 24 h before this meetup was counted once as a late cancel (§4.4). */
      lateCancelled: z.boolean().optional(),
    }),
  ),
  hasMet: z.boolean(),
  rescheduled: z.boolean(),
  /** The current planning round has used its one 24 h extension (D7); reset when a new round starts. */
  planningExtended: z.boolean(),
  /** When the pod entered `scheduled`; the T−3 d ask needs the meetup ≥ 4 days after this (D5). */
  planLockedAt: timestampSchema.optional(),
  score: z.number(),
  backfill: z.object({ used: z.boolean(), until: timestampSchema.optional() }),
  version: z.int().min(0),
  /**
   * DESIGN-DEVIATION: when dailyMaintenance deletes the ended pod (archive + 90 days, dissolve + 30 days, §4.2), set
   * when the pod ends, so the daily job queries one indexed field. Absent while the pod runs.
   */
  deleteAt: timestampSchema.optional(),
});
export type PodStateDoc = z.infer<typeof podStateDocSchema>;

export const podFeedbackDocSchema = z.object({
  met: z.boolean(),
  attendance: z.record(uidSchema, z.enum(['came', 'noShow'])),
  meetAgain: z.record(uidSchema, z.boolean()),
  rating: z.int().min(1).max(5).optional(),
  keep: z.boolean(),
});

/**
 * `pairSignals/{pairKey}` (D9), server-only: the two members' meet-again answers about each other. Applied to both
 * `matchProfiles.recentH` through meetAgainOutcome; deleted when either account is erased (found by `uidHs`).
 */
export const pairSignalDocSchema = z
  .object({
    uidHs: z.tuple([uidHSchema, uidHSchema]),
    answers: z.record(uidHSchema, z.boolean()),
    meetWeek: weekIdSchema,
    updatedAt: timestampSchema,
    expiresAt: timestampSchema.optional(),
  })
  .refine((d) => d.uidHs[0] < d.uidHs[1], { message: 'uidHs sorted and distinct' })
  .refine((d) => Object.keys(d.answers).every((h) => d.uidHs.includes(h)), { message: 'answers only from the pair' });

/** Aggregate counts in `drops`: any cell under 10 is stored as "<10" (§6.6). */
export const suppressedCountSchema = z.union([z.int().min(10), z.literal(0), z.literal('<10')]);
export function suppressSmallCount(n: number): number | '<10' {
  return n > 0 && n < 10 ? '<10' : n;
}

/**
 * `funnel/{areaId}_{weekId}` (§6.8), server-only: uid-free counters, one per stage, of users who reached that stage
 * for the first time in that ISO week (Europe/Copenhagen) in that launch area (`none` for users outside every area).
 * Exact counts are stored; readers (the admin CLI) suppress any cell under 10 (`suppressFunnelCounts`).
 * `expiresAt` = the week's start + 24 months (TTL, PRIVACY.md §5).
 */
const funnelCount = z.int().min(0).default(0);
export const funnelDocSchema = z.object({
  areaId: z.union([z.string().regex(/^[a-z][a-z0-9-]{1,31}$/), z.literal(FUNNEL_NO_AREA)]),
  weekId: weekIdSchema,
  counts: z.object({
    signup: funnelCount,
    onboarded: funnelCount,
    waitlisted: funnelCount,
    firstDropEligible: funnelCount,
    firstProposal: funnelCount,
    firstConfirmed: funnelCount,
    firstMeetupHappened: funnelCount,
    secondMeetup: funnelCount,
  } satisfies Record<FunnelStage, unknown>),
  /** "Where did you hear about Grouper?" answers of users onboarded that week (uid-free, once per user). */
  sources: z
    .object({
      dadsGroup: funnelCount,
      newcomerEvent: funnelCount,
      university: funnelCount,
      venuePoster: funnelCount,
      friend: funnelCount,
      socialMedia: funnelCount,
      press: funnelCount,
      other: funnelCount,
    } satisfies Record<HeardFromSource, unknown>)
    .default({ dadsGroup: 0, newcomerEvent: 0, university: 0, venuePoster: 0, friend: 0, socialMedia: 0, press: 0, other: 0 }),
  expiresAt: timestampSchema,
});
export type FunnelDoc = z.infer<typeof funnelDocSchema>;

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
    target: z.object({ type: z.enum(REPORT_TARGET_TYPES), optionId: docIdSchema.optional(), messageId: docIdSchema.optional() }),
    /** A copy of the reported message (its author is `targetUid`), so the evidence outlives the message's TTL. */
    message: z.strictObject({ text: z.string().min(1).max(CHAT_MESSAGE_MAX) }).optional(),
    category: z.enum(REPORT_CATEGORIES),
    text: z.string().max(500).optional(),
    status: z.enum(['open', 'resolved']),
    /** Automated outcome code; nobody reviews reports (D2). */
    decision: z.string().optional(),
    createdAt: timestampSchema,
    resolvedAt: timestampSchema.optional(),
    expiresAt: timestampSchema,
  })
  .refine((r) => (r.reporterUid === undefined) !== (r.reporterH === undefined), { message: 'exactly one of reporterUid / reporterH' })
  .refine((r) => (r.targetUid === undefined) !== (r.targetH === undefined), { message: 'exactly one of targetUid / targetH' })
  .refine((r) => r.target.type !== 'message' || (r.target.messageId !== undefined && r.message !== undefined), {
    message: 'message reports need messageId and the message copy',
  })
  .refine((r) => (r.message === undefined && r.target.messageId === undefined) || r.target.type === 'message', {
    message: 'messageId and the message copy only on message reports',
  })
  .refine((r) => r.target.optionId === undefined || r.target.type === 'option', { message: 'optionId only on option reports' });

/** Automated sanctions only, and every one expires (D2): no permanent sanction without a human decision. */
export const sanctionDocSchema = z.object({
  type: z.enum(['pause', 'suspension']),
  until: timestampSchema,
  /** The pause reason it set on the account (`noShow`, `reports`, `underageReport`). */
  reasonCode: z.string(),
  noticeId: docIdSchema,
  createdAt: timestampSchema.optional(),
  /** When the current sanction started (an under-18 pause restarts only on a report from another pod, §3.7). */
  since: timestampSchema.optional(),
});

export const banDocSchema = z.object({ reasonCode: z.string(), createdAt: timestampSchema, expiresAt: timestampSchema });

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
