/**
 * Drop input snapshot and result files (DESIGN.md §6.5): `gs://grouper-<env>-drops/{weekId}/{componentId}.input.json.gz`
 * and `…/{componentId}.result.{inputHash}.json`. The snapshot is permissive about sensitive themes without a
 * consent reference so the matcher can drop them (S3) instead of failing the whole component.
 */
import { z } from 'zod';
import { ACCOUNT_STATUSES, MATCHING_PROFILE_IDS, SENSITIVE_HOLD_REASONS } from '../types/domain';
import {
  availabilitySchema,
  conceptIdSchema,
  docIdSchema,
  epochMsSchema,
  genderSchema,
  gh5Schema,
  languagesSchema,
  radiusKmSchema,
  sha256HexSchema,
  uidHSchema,
  uidSchema,
  weekIdSchema,
} from './common';
import { podThemeSchema } from './documents';
import { unmatchedReasonSchema } from './reasons';

export const MATCH_SNAPSHOT_VERSION = 1;

export const snapshotUserSchema = z.object({
  uid: uidSchema,
  uidH: uidHSchema,
  status: z.enum(ACCOUNT_STATUSES),
  gh5: gh5Schema,
  birthYear: z.int(),
  ageMin: z.int(),
  ageMax: z.int(),
  maxKm: radiusKmSchema,
  sameGenderOnly: z.boolean(),
  gender: genderSchema.nullable(),
  languages: languagesSchema,
  availability: availabilitySchema,
  themes: z.array(z.object({ c: conceptIdSchema, starred: z.boolean(), sens: z.boolean(), consentRef: docIdSchema.nullish() })).max(20),
  secondary: z.array(conceptIdSchema).max(20),
  blockedH: z.array(uidHSchema),
  recentH: z.record(uidHSchema, weekIdSchema),
  reliability: z.number().min(0).max(1),
  waitingSinceWeek: weekIdSchema,
  priority: z.boolean(),
  openToAnyone: z.boolean(),
  activePods: z.int().min(0),
  activeSensitivePods: z.int().min(0),
  sensitiveProposals: z.array(weekIdSchema),
  sensitiveHold: z.object({ reason: z.enum(SENSITIVE_HOLD_REASONS), since: epochMsSchema }).nullable(),
  attendedVerified: z.int().min(0),
  founderInvited: z.boolean(),
  openReportCount: z.int().min(0),
  weekClaim: weekIdSchema.nullable(),
  createdAt: epochMsSchema,
});
export type SnapshotUser = z.infer<typeof snapshotUserSchema>;

/** 128 float32 values, little-endian, base64: 512 bytes → 684 characters. */
export const C128_BASE64_LENGTH = 684;

export const snapshotConceptSchema = z.object({
  id: conceptIdSchema,
  c128: z.string().length(C128_BASE64_LENGTH),
  sensitive: z.boolean(),
  status: z.enum(['active', 'merged']),
  mergedInto: conceptIdSchema.nullable(),
});
export type SnapshotConcept = z.infer<typeof snapshotConceptSchema>;

export const matchSnapshotSchema = z.object({
  v: z.literal(MATCH_SNAPSHOT_VERSION),
  weekId: weekIdSchema,
  componentId: z.string().min(5).max(12),
  profile: z.enum(MATCHING_PROFILE_IDS),
  dropAt: epochMsSchema,
  users: z.array(snapshotUserSchema),
  concepts: z.array(snapshotConceptSchema),
});
export type MatchSnapshot = z.infer<typeof matchSnapshotSchema>;

export const reasonSeedSchema = z.object({
  alsoShare: z.array(conceptIdSchema).max(3),
  nearKm: z.int().min(0),
  ageSpan: z.object({ min: z.int(), max: z.int() }).nullable(),
  priorityWeeks: z.int().min(1).nullable(),
});

export const matchResultFileSchema = z.object({
  v: z.literal(MATCH_SNAPSHOT_VERSION),
  weekId: weekIdSchema,
  componentId: z.string(),
  inputHash: sha256HexSchema,
  pods: z.array(
    z.object({
      members: z.array(uidSchema).min(4).max(6),
      theme: podThemeSchema,
      value: z.number(),
      reasons: z.record(uidSchema, reasonSeedSchema),
    }),
  ),
  unmatched: z.array(z.object({ uid: uidSchema, reason: unmatchedReasonSchema })),
  stats: z.record(z.string(), z.unknown()),
});
export type MatchResultFile = z.infer<typeof matchResultFileSchema>;
