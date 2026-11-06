/**
 * Callable inputs and outputs (DESIGN.md §10.1). Inputs are strict: unknown keys are rejected.
 * The registry at the end is the one place that says which App Check / re-authentication rules apply.
 * Every callable is in the default codebase: the embedder codebase is retired, because the app embeds tags (D1).
 */
import { z } from 'zod';
import { HEARD_FROM_SOURCES } from '../metrics/funnel';
import {
  LAUNCH_AREA_STATUSES,
  PLATFORMS,
  POD_STATES,
  REPORT_CATEGORIES,
  REPORT_TARGET_TYPES,
  SET_PARTICIPATION_MODES,
} from '../types/domain';
import { MODERATION_REASONS } from '../reasons';
import { EMBEDDING_DIM, EMBEDDING_MODEL_ID, VECTOR_NORM_TOLERANCE, vectorNorm } from '../interests/model';
import {
  conceptIdSchema,
  consentPayloadSchema,
  docIdSchema,
  epochMsSchema,
  firstNameSchema,
  genderSchema,
  gh5Schema,
  interestIdSchema,
  legalVersionSchema,
  localeSchema,
  placeSchema,
  podIdSchema,
  uidSchema,
  weekIdSchema,
  ymdDateSchema,
} from './common';
import { aboutMeSchema, prefsPatchSchema } from './profile';

/** `{}` inputs: RNFirebase sends null when a callable is invoked without data. */
const emptyInput = z.preprocess((v) => v ?? {}, z.strictObject({}));
const ok = z.object({ ok: z.literal(true) });

export const DECLINE_REASONS = ['notThisWeek', 'theme', 'distance', 'groupSize', 'other'] as const;
export const LEAVE_REASONS = ['schedule', 'notAFit', 'safety', 'other'] as const;

// ---------------------------------------------------------------- default codebase (§10.1)

export const completeOnboardingInput = z.strictObject({
  firstName: firstNameSchema,
  dob: ymdDateSchema,
  locale: localeSchema,
  area: z.strictObject({ gh5: gh5Schema }),
  // Same-gender pods need gender and its own consent, so they are switched on later via updateProfile.
  prefs: prefsPatchSchema.refine((p) => p.sameGenderOnly !== true, { message: 'use updateProfile for same-gender pods' }).optional(),
  legal: z.strictObject({ terms: legalVersionSchema, privacy: legalVersionSchema }),
  /** Optional "Where did you hear about Grouper?"; only an aggregate counter is kept, never the answer per user. */
  heardFrom: z.enum(HEARD_FROM_SOURCES).optional(),
});
export const completeOnboardingOutput = z.object({ areaStatus: z.enum([...LAUNCH_AREA_STATUSES, 'outside']) });

export const updateProfileInput = z
  .strictObject({
    firstName: firstNameSchema.optional(),
    locale: localeSchema.optional(),
    area: z.strictObject({ gh5: gh5Schema }).optional(),
    prefs: prefsPatchSchema.optional(),
    gender: genderSchema.optional(),
    genderConsent: consentPayloadSchema.optional(),
    /** "About me" (D4); '' clears it. The server also runs checkAboutMe. */
    aboutMe: aboutMeSchema.optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'nothing to update' })
  .refine((p) => p.gender === undefined || p.genderConsent !== undefined, {
    message: 'gender needs genderConsent',
    path: ['genderConsent'],
  });
export const updateProfileOutput = ok;

export const setParticipationInput = z
  .strictObject({ mode: z.enum(SET_PARTICIPATION_MODES), until: epochMsSchema.optional() })
  .refine((p) => p.until === undefined || p.mode === 'pause', { message: 'until only applies to pause', path: ['until'] });
export const setParticipationOutput = z.object({ effectiveWeekId: weekIdSchema });

export const removeInterestInput = z.strictObject({ interestId: interestIdSchema });
export const removeInterestOutput = ok;

export const updateInterestInput = z.strictObject({ interestId: interestIdSchema, starred: z.boolean() });
export const updateInterestOutput = ok;

export const confirmSuggestionInput = z.strictObject({ interestId: interestIdSchema, conceptId: conceptIdSchema });
export const confirmSuggestionOutput = ok;

/**
 * Blanket Art. 9 consent (D3), given once on its own onboarding screen or later in Settings → Privacy. The server
 * checks the proof against an `art9Blanket` text, writes a `grant` consent event and sets `users.legal.art9`.
 */
export const setArt9ConsentInput = z.strictObject({ consent: consentPayloadSchema });
export const setArt9ConsentOutput = ok;

/**
 * Withdraws the blanket consent: every sensitive holding goes at once, with the effects of PRIVACY.md §3.5, then a
 * `withdraw` event and `users.legal.art9` removed. It replaces withdrawSensitive; one sensitive interest is removed
 * with removeInterest, which runs the same effects for that holding only.
 */
export const withdrawArt9ConsentInput = emptyInput;
export const withdrawArt9ConsentOutput = z.object({ removed: z.int().min(0) });

export const respondToPodInput = z
  .strictObject({ podId: podIdSchema, accept: z.boolean(), reason: z.enum(DECLINE_REASONS).optional() })
  .refine((p) => !p.accept || p.reason === undefined, { message: 'reason only on decline', path: ['reason'] });
export const respondToPodOutput = z.object({ state: z.enum(POD_STATES), acceptedCount: z.int().min(0).max(6) });

export const setPhotoSharingInput = z.strictObject({ podId: podIdSchema, share: z.boolean() });
export const setPhotoSharingOutput = ok;

export const leavePodInput = z.strictObject({ podId: podIdSchema, reason: z.enum(LEAVE_REASONS).optional() });
export const leavePodOutput = ok;

/** Map-link hosts that chat moderation does not read as contact details (people paste map links to meet). */
export const MAP_URL_HOSTS = ['maps.app.goo.gl', 'www.google.com', 'maps.google.com', 'goo.gl', 'maps.apple.com', 'www.openstreetmap.org', 'osm.org'] as const;

/** A time and a place from Google Places (D8). The app has no free-text place; placeSchema refuses contact details and home-address shapes a modified client might type. */
export const proposeOptionInput = z.strictObject({
  podId: podIdSchema,
  startsAt: epochMsSchema,
  place: placeSchema,
});
export const proposeOptionOutput = z.object({ optionId: docIdSchema });

export const voteOptionInput = z.strictObject({ podId: podIdSchema, optionId: docIdSchema, vote: z.enum(['yes', 'no']).nullable() });
export const voteOptionOutput = z.object({ tally: z.object({ yes: z.int().min(0), no: z.int().min(0) }) });

/** "Still coming?" and the attendance card's "Can't make it" (D5, D14); allowed while the pod is `scheduled`. */
export const confirmAttendanceInput = z.strictObject({ podId: podIdSchema, coming: z.boolean() });
export const confirmAttendanceOutput = ok;

export const CHAT_MESSAGE_MAX = 500;
export const CHAT_WARNINGS = ['CONTACT_INFO_BEFORE_MEETUP'] as const;
export type ChatWarning = (typeof CHAT_WARNINGS)[number];
/** Text only (D14): "Can't make it" lives on the attendance card. */
export const sendMessageInput = z.strictObject({
  podId: podIdSchema,
  text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  ackContactWarning: z.boolean().optional(),
});
export const sendMessageOutput = z.union([
  z.object({ messageId: docIdSchema }),
  z.object({ warnings: z.array(z.enum(CHAT_WARNINGS)).min(1) }),
]);

const maxFive = (r: Record<string, unknown>): boolean => Object.keys(r).length <= 5;
/**
 * "Who was there?" (D15): every other member is pre-ticked, and `notThere` lists those the user unticked
 * (attendanceFromNotThere resolves the full map). `meetAgain` answers feed the pair signals (D9); a member left out
 * means no answer.
 */
export const submitFeedbackInput = z.strictObject({
  podId: podIdSchema,
  met: z.boolean(),
  notThere: z
    .array(uidSchema)
    .max(5)
    .refine((a) => new Set(a).size === a.length, { message: 'duplicate member' }),
  meetAgain: z.record(uidSchema, z.boolean()).refine(maxFive, { message: 'at most 5 members' }),
  rating: z.int().min(1).max(5).optional(),
  keep: z.boolean(),
});
export const submitFeedbackOutput = ok;

/**
 * `leave`: the blocker leaves the shared active pods instead of the blocked member (§3.7). `replan`: "Re-plan the
 * meetup" for a scheduled pod the blocked member knew the plan of: planning reopens with a 48-hour deadline and the old
 * options are deleted. DESIGN-DEVIATION: §10.1 lists no `replan`; the app asks before it blocks.
 */
export const blockUserInput = z
  .strictObject({ podId: podIdSchema, uid: uidSchema, leave: z.boolean().optional(), replan: z.boolean().optional() })
  .refine((b) => !(b.leave && b.replan), { message: 'leave and replan exclude each other' });
export const blockUserOutput = ok;
export const unblockUserInput = z.strictObject({ uid: uidSchema });
export const unblockUserOutput = ok;

export const REPORT_TEXT_MAX = 500;
export const reportInput = z
  .strictObject({
    target: z.strictObject({
      type: z.enum(REPORT_TARGET_TYPES),
      podId: podIdSchema,
      uid: uidSchema.optional(),
      optionId: docIdSchema.optional(),
      messageId: docIdSchema.optional(),
    }),
    category: z.enum(REPORT_CATEGORIES),
    text: z.string().trim().max(REPORT_TEXT_MAX).optional(),
  })
  .refine((r) => r.target.type !== 'option' || r.target.optionId !== undefined, { message: 'optionId required', path: ['target', 'optionId'] })
  .refine((r) => r.target.type !== 'message' || r.target.messageId !== undefined, { message: 'messageId required', path: ['target', 'messageId'] })
  .refine((r) => r.target.optionId === undefined || r.target.type === 'option', { message: 'optionId only on option reports', path: ['target', 'optionId'] })
  .refine((r) => r.target.messageId === undefined || r.target.type === 'message', {
    message: 'messageId only on message reports',
    path: ['target', 'messageId'],
  })
  // Option and message reports name their author server-side, from the reported document.
  .refine((r) => r.target.type === 'option' || r.target.type === 'message' || r.target.uid !== undefined, {
    message: 'uid required',
    path: ['target', 'uid'],
  });
export const reportOutput = z.object({ reportId: docIdSchema });

export const registerPushTokenInput = z.strictObject({ token: z.string().min(1).max(4096), platform: z.enum(PLATFORMS) });
export const registerPushTokenOutput = ok;

/** Sent when the app opens or comes to the foreground; the onboarded-callable wrapper records the activity (§8.1). */
export const appOpenedInput = emptyInput;
export const appOpenedOutput = ok;

export const deletePhotoInput = emptyInput;
export const deletePhotoOutput = ok;
export const exportDataInput = emptyInput;
export const exportDataOutput = z.object({ exportId: docIdSchema });
export const deleteAccountInput = emptyInput;
export const deleteAccountOutput = ok;

// ---------------------------------------------------------------- interests (D1)

export const ADD_INTERESTS_MAX_ITEMS = 10;
/** Raw text bound before normalization (the normalized tag must still be 2–40 characters). */
export const ADD_INTERESTS_TEXT_MAX = 80;

/** A tag vector from the device: the model's dimension, finite, unit length within VECTOR_NORM_TOLERANCE. */
export const tagVectorSchema = z
  .array(z.number())
  .length(EMBEDDING_DIM)
  .refine((v) => Math.abs(vectorNorm(v) - 1) <= VECTOR_NORM_TOLERANCE, { message: 'vector must be L2-normalised' });

/**
 * One tag, embedded on the device (D1). The server trusts `vector` and `detector.margin` (an accepted manipulation
 * risk: sensitivity is the on-device model's decision, F35) but repeats normalisation and moderation. `selfFlagPrivate` ("Keep this private") and `notSensitiveForMe` apply to this holding
 * only and exclude each other. Sent for an existing holding, either flag changes that holding instead.
 */
export const addInterestsItem = z
  .strictObject({
    text: z.string().min(1).max(ADD_INTERESTS_TEXT_MAX),
    vector: tagVectorSchema,
    detector: z.strictObject({ margin: z.number().min(-2).max(2) }),
    selfFlagPrivate: z.boolean().optional(),
    notSensitiveForMe: z.boolean().optional(),
  })
  .refine((i) => !(i.selfFlagPrivate && i.notSensitiveForMe), { message: 'selfFlagPrivate and notSensitiveForMe exclude each other' });

/** `modelKey` must be the pinned model's: vectors of different models never mix (§5.1). */
export const addInterestsInput = z.strictObject({
  modelKey: z.literal(EMBEDDING_MODEL_ID),
  items: z.array(addInterestsItem).min(1).max(ADD_INTERESTS_MAX_ITEMS),
});

export const ADD_INTEREST_STATUSES = ['added', 'madePrivate', 'madeOrdinary', 'rejected', 'duplicate', 'limit'] as const;
export const addInterestsOutput = z.object({
  results: z.array(
    z.object({
      status: z.enum(ADD_INTEREST_STATUSES),
      interestId: interestIdSchema.optional(),
      /** True when the holding is stored as sensitive: the app shows the lock icon and nothing else (D3). */
      private: z.boolean().optional(),
      suggestion: z.object({ conceptId: conceptIdSchema, label: z.string().min(1).max(80) }).optional(),
      reasonCode: z.enum(MODERATION_REASONS).optional(),
      // DESIGN-DEVIATION: §10.2 lists no warning field, but §5.2 (2) warns on ordinary third-party tags.
      warning: z.literal('THIRD_PARTY').optional(),
    }),
  ),
});

// ---------------------------------------------------------------- registry

interface CallableSpec<I extends z.ZodType, O extends z.ZodType> {
  readonly input: I;
  readonly output: O;
  /** Always 'default' since D1; kept so deploy tooling can keep asserting it. */
  readonly codebase: 'default';
  /** Requires the `onb` claim (all except completeOnboarding). */
  readonly requiresOnboarding: boolean;
  /** Limited-use App Check token, `consumeAppCheckToken: true`, reject `alreadyConsumed` (§9). */
  readonly replayProtected: boolean;
  /** `auth_time` within 5 minutes (§9 Auth hardening). */
  readonly requiresRecentLogin: boolean;
}

function spec<I extends z.ZodType, O extends z.ZodType>(
  input: I,
  output: O,
  opts: Partial<Omit<CallableSpec<I, O>, 'input' | 'output'>> = {},
): CallableSpec<I, O> {
  return {
    input,
    output,
    codebase: 'default',
    requiresOnboarding: opts.requiresOnboarding ?? true,
    replayProtected: opts.replayProtected ?? false,
    requiresRecentLogin: opts.requiresRecentLogin ?? false,
  };
}

export const CALLABLES = {
  completeOnboarding: spec(completeOnboardingInput, completeOnboardingOutput, { requiresOnboarding: false }),
  updateProfile: spec(updateProfileInput, updateProfileOutput),
  setParticipation: spec(setParticipationInput, setParticipationOutput),
  removeInterest: spec(removeInterestInput, removeInterestOutput),
  updateInterest: spec(updateInterestInput, updateInterestOutput),
  confirmSuggestion: spec(confirmSuggestionInput, confirmSuggestionOutput),
  setArt9Consent: spec(setArt9ConsentInput, setArt9ConsentOutput),
  withdrawArt9Consent: spec(withdrawArt9ConsentInput, withdrawArt9ConsentOutput),
  respondToPod: spec(respondToPodInput, respondToPodOutput),
  setPhotoSharing: spec(setPhotoSharingInput, setPhotoSharingOutput),
  leavePod: spec(leavePodInput, leavePodOutput),
  proposeOption: spec(proposeOptionInput, proposeOptionOutput),
  voteOption: spec(voteOptionInput, voteOptionOutput),
  confirmAttendance: spec(confirmAttendanceInput, confirmAttendanceOutput),
  sendMessage: spec(sendMessageInput, sendMessageOutput),
  submitFeedback: spec(submitFeedbackInput, submitFeedbackOutput),
  blockUser: spec(blockUserInput, blockUserOutput),
  unblockUser: spec(unblockUserInput, unblockUserOutput),
  report: spec(reportInput, reportOutput, { replayProtected: true }),
  registerPushToken: spec(registerPushTokenInput, registerPushTokenOutput),
  appOpened: spec(appOpenedInput, appOpenedOutput),
  deletePhoto: spec(deletePhotoInput, deletePhotoOutput),
  exportData: spec(exportDataInput, exportDataOutput, { replayProtected: true, requiresRecentLogin: true }),
  deleteAccount: spec(deleteAccountInput, deleteAccountOutput, { replayProtected: true, requiresRecentLogin: true }),
  addInterests: spec(addInterestsInput, addInterestsOutput),
} as const;

export type CallableName = keyof typeof CALLABLES;
export type CallableInput<N extends CallableName> = z.infer<(typeof CALLABLES)[N]['input']>;
export type CallableOutput<N extends CallableName> = z.infer<(typeof CALLABLES)[N]['output']>;
