/**
 * Input-time moderation (DESIGN.md §5.2 (2)), repeated on the server whatever the app already checked. Rejections
 * carry a reason code and nothing is persisted; the device renders the DSA Art. 17 statement of reasons from the
 * code. Contact details and the blocklist are core's, shared with the meetup chat; third-party kinship is a signal
 * for the sensitivity step.
 */
import { detectThirdParty, findPii, isBlocklisted } from '@grouper/core';

export const MODERATION_RULES_VERSION = 'moderation-2026-11-04.1';

export type ModerationResult =
  | { readonly ok: true; readonly thirdParty: boolean }
  | { readonly ok: false; readonly reason: 'PII' | 'BLOCKLIST' };

/**
 * `display` (NFKC, invisible characters removed, case and edge punctuation kept) is what the PII patterns
 * see, so "@handle" is still a handle; `norm` is what the blocklist and kinship patterns see.
 */
export function moderateTag(norm: string, display: string): ModerationResult {
  if (findPii(display).length > 0) return { ok: false, reason: 'PII' };
  if (isBlocklisted(norm, 'tag')) return { ok: false, reason: 'BLOCKLIST' };
  return { ok: true, thirdParty: detectThirdParty(norm).hit };
}
