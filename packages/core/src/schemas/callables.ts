/**
 * Callable inputs and outputs (DESIGN.md §10.1, §10.2). Inputs are strict: unknown keys are rejected.
 * The registry at the end is the one place that says which codebase serves a callable and which
 * App Check / re-authentication rules apply.
 */
import { z } from 'zod';
import { LAUNCH_AREA_STATUSES, PLATFORMS, POD_STATES, REPORT_CATEGORIES, SET_PARTICIPATION_MODES } from '../types/domain';
import { MODERATION_REASONS } from '../reasons';
import {
  art9CategorySchema,
  conceptIdSchema,
  consentPayloadSchema,
  docIdSchema,
  epochMsSchema,
  firstNameSchema,
  genderSchema,
  gh5Schema,
  httpsUrlSchema,
  interestIdSchema,
  legalVersionSchema,
  localeSchema,
  podIdSchema,
  uidSchema,
  urlHost,
  weekIdSchema,
  ymdDateSchema,
} from './common';
import { prefsPatchSchema } from './profile';

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

export const withdrawSensitiveInput = z.preprocess((v) => v ?? {}, z.strictObject({ interestId: interestIdSchema.optional() }));
export const withdrawSensitiveOutput = z.object({ removed: z.int().min(0) });

export const respondToPodInput = z
  .strictObject({ podId: podIdSchema, accept: z.boolean(), reason: z.enum(DECLINE_REASONS).optional() })
  .refine((p) => !p.accept || p.reason === undefined, { message: 'reason only on decline', path: ['reason'] });
export const respondToPodOutput = z.object({ state: z.enum(POD_STATES), acceptedCount: z.int().min(0).max(6) });

export const setPhotoSharingInput = z.strictObject({ podId: podIdSchema, share: z.boolean() });
export const setPhotoSharingOutput = ok;

export const leavePodInput = z.strictObject({ podId: podIdSchema, reason: z.enum(LEAVE_REASONS).optional() });
export const leavePodOutput = ok;

export const MAP_URL_HOSTS = ['maps.app.goo.gl', 'www.google.com', 'maps.google.com', 'goo.gl', 'maps.apple.com', 'www.openstreetmap.org', 'osm.org'] as const;
const mapUrlSchema = httpsUrlSchema.refine((u) => (MAP_URL_HOSTS as readonly string[]).includes(urlHost(u) ?? ''), {
  message: 'URL',
});

export const OPTION_WARNINGS = ['HOME_ADDRESS'] as const;
export const proposeOptionInput = z.strictObject({
  podId: podIdSchema,
  startsAt: epochMsSchema,
  placeText: z.string().trim().min(1).max(120),
  mapUrl: mapUrlSchema.optional(),
  publicPlace: z.literal(true),
  ackWarnings: z.boolean().optional(),
});
export const proposeOptionOutput = z.union([
  z.object({ optionId: docIdSchema }),
  z.object({ warnings: z.array(z.enum(OPTION_WARNINGS)).min(1) }),
]);

export const voteOptionInput = z.strictObject({ podId: podIdSchema, optionId: docIdSchema, vote: z.enum(['yes', 'no']).nullable() });
export const voteOptionOutput = z.object({ tally: z.object({ yes: z.int().min(0), no: z.int().min(0) }) });

export const confirmAttendanceInput = z.strictObject({ podId: podIdSchema, coming: z.boolean() });
export const confirmAttendanceOutput = ok;

const maxFive = (r: Record<string, unknown>): boolean => Object.keys(r).length <= 5;
export const submitFeedbackInput = z.strictObject({
  podId: podIdSchema,
  met: z.boolean(),
  attendance: z.record(uidSchema, z.enum(['came', 'noShow'])).refine(maxFive, { message: 'at most 5 members' }),
  meetAgain: z.record(uidSchema, z.boolean()).refine(maxFive, { message: 'at most 5 members' }),
  rating: z.int().min(1).max(5).optional(),
  keep: z.boolean(),
});
export const submitFeedbackOutput = ok;

export const blockUserInput = z.strictObject({ podId: podIdSchema, uid: uidSchema, leave: z.boolean().optional() });
export const blockUserOutput = ok;
export const unblockUserInput = z.strictObject({ uid: uidSchema });
export const unblockUserOutput = ok;

export const REPORT_TEXT_MAX = 500;
export const reportInput = z
  .strictObject({
    target: z.strictObject({
      type: z.enum(['user', 'option', 'interest']),
      podId: podIdSchema,
      uid: uidSchema.optional(),
      optionId: docIdSchema.optional(),
    }),
    category: z.enum(REPORT_CATEGORIES),
    text: z.string().trim().max(REPORT_TEXT_MAX).optional(),
  })
  .refine((r) => r.target.type !== 'option' || r.target.optionId !== undefined, { message: 'optionId required', path: ['target', 'optionId'] })
  .refine((r) => r.target.type === 'option' || r.target.uid !== undefined, { message: 'uid required', path: ['target', 'uid'] });
export const reportOutput = z.object({ reportId: docIdSchema });

export const registerPushTokenInput = z.strictObject({ token: z.string().min(1).max(4096), platform: z.enum(PLATFORMS) });
export const registerPushTokenOutput = ok;

export const deletePhotoInput = emptyInput;
export const deletePhotoOutput = ok;
export const exportDataInput = emptyInput;
export const exportDataOutput = z.object({ exportId: docIdSchema });
export const deleteAccountInput = emptyInput;
export const deleteAccountOutput = ok;

// ---------------------------------------------------------------- embedder codebase (§10.2)

export const ADD_INTERESTS_MAX_ITEMS = 10;
/** Raw text bound before normalization (the normalized tag must still be 2–40 characters). */
export const ADD_INTERESTS_TEXT_MAX = 80;

export const addInterestsItem = z
  .strictObject({
    text: z.string().min(1).max(ADD_INTERESTS_TEXT_MAX),
    selfFlag: z.boolean().optional(),
    consent: consentPayloadSchema.optional(),
    category: art9CategorySchema.optional(),
  })
  .refine((i) => !i.selfFlag || i.consent !== undefined, { message: 'selfFlag needs consent', path: ['consent'] });

/** `items: []` is the warm-up call (§10.2). */
export const addInterestsInput = z.strictObject({ items: z.array(addInterestsItem).max(ADD_INTERESTS_MAX_ITEMS) });

export const ADD_INTEREST_STATUSES = ['added', 'madePrivate', 'needsConsent', 'rejected', 'duplicate', 'limit'] as const;
export const addInterestsOutput = z.object({
  results: z.array(
    z.object({
      status: z.enum(ADD_INTEREST_STATUSES),
      interestId: interestIdSchema.optional(),
      suggestion: z.object({ conceptId: conceptIdSchema, label: z.string().min(1).max(80) }).optional(),
      reasonCode: z.enum(MODERATION_REASONS).optional(),
      /** Ordinary third-party tag: stored, with the "only add interests about yourself" warning. */
      warning: z.literal('THIRD_PARTY').optional(),
    }),
  ),
});

// ---------------------------------------------------------------- registry

interface CallableSpec<I extends z.ZodType, O extends z.ZodType> {
  readonly input: I;
  readonly output: O;
  readonly codebase: 'default' | 'embedder';
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
    codebase: opts.codebase ?? 'default',
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
  withdrawSensitive: spec(withdrawSensitiveInput, withdrawSensitiveOutput),
  respondToPod: spec(respondToPodInput, respondToPodOutput),
  setPhotoSharing: spec(setPhotoSharingInput, setPhotoSharingOutput),
  leavePod: spec(leavePodInput, leavePodOutput),
  proposeOption: spec(proposeOptionInput, proposeOptionOutput),
  voteOption: spec(voteOptionInput, voteOptionOutput),
  confirmAttendance: spec(confirmAttendanceInput, confirmAttendanceOutput),
  submitFeedback: spec(submitFeedbackInput, submitFeedbackOutput),
  blockUser: spec(blockUserInput, blockUserOutput),
  unblockUser: spec(unblockUserInput, unblockUserOutput),
  report: spec(reportInput, reportOutput, { replayProtected: true }),
  registerPushToken: spec(registerPushTokenInput, registerPushTokenOutput),
  deletePhoto: spec(deletePhotoInput, deletePhotoOutput),
  exportData: spec(exportDataInput, exportDataOutput, { replayProtected: true, requiresRecentLogin: true }),
  deleteAccount: spec(deleteAccountInput, deleteAccountOutput, { replayProtected: true, requiresRecentLogin: true }),
  addInterests: spec(addInterestsInput, addInterestsOutput, { codebase: 'embedder' }),
} as const;

export type CallableName = keyof typeof CALLABLES;
export type CallableInput<N extends CallableName> = z.infer<(typeof CALLABLES)[N]['input']>;
export type CallableOutput<N extends CallableName> = z.infer<(typeof CALLABLES)[N]['output']>;
