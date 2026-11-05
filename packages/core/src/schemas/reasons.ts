import { z } from 'zod';
import { ALSO_SHARE_MAX, UNMATCHED_REASONS } from '../reasons';

const wording = z.string().min(1).max(80);

export const podReasonSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('THEME'), yourWording: wording }),
  z.object({ code: z.literal('ALSO_SHARE'), yourWordings: z.array(wording).min(1).max(ALSO_SHARE_MAX) }),
  z.object({ code: z.literal('AREA'), label: z.string().min(1).max(60) }),
  z.object({ code: z.literal('NEAR_YOU'), km: z.int().min(0).max(50) }),
  z.object({ code: z.literal('AGE_SPAN'), min: z.int(), max: z.int() }),
  z.object({ code: z.literal('PRIORITY'), weeks: z.int().min(1) }),
  z.object({ code: z.literal('SOFT_THEME'), yourTag: wording, podTheme: wording }),
  z.object({ code: z.literal('OPEN_TO_ANYONE') }),
]);

export const unmatchedReasonSchema = z.enum(UNMATCHED_REASONS);
