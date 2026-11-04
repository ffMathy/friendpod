import { detectThirdParty, findPii, lexiconCheck, normalizeTag, type NormalizeFailure } from '@grouper/core';

/**
 * Step (0) of the interest pipeline (DESIGN.md §5.2): the same normalization, PII patterns and high-precision Art. 9
 * lexicon as the server, run before any text leaves the phone. The embedding and the detector margin follow on the
 * device too (D1, useAddInterest); the server repeats every text check and ORs in its own lexicon result.
 */
export type DeviceCheckResult =
  | { readonly kind: 'invalid'; readonly code: NormalizeFailure }
  | { readonly kind: 'rejected'; readonly code: 'PII' }
  /** A family member's sensitive data: the user's own consent cannot cover it (PRIVACY.md §4.3). */
  | { readonly kind: 'refused'; readonly code: 'THIRD_PARTY_SENSITIVE' }
  | {
      readonly kind: 'ok';
      readonly display: string;
      readonly norm: string;
      readonly lexiconHit: boolean;
      readonly thirdParty: boolean;
    };

export function checkInterestOnDevice(text: string): DeviceCheckResult {
  const normalized = normalizeTag(text);
  if (!normalized.ok) return { kind: 'invalid', code: normalized.code };
  const { norm, display } = normalized;
  if (findPii(text).length > 0) return { kind: 'rejected', code: 'PII' };
  const lexiconHit = lexiconCheck(norm).hit;
  const thirdParty = detectThirdParty(norm).hit;
  if (lexiconHit && thirdParty) return { kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' };
  return { kind: 'ok', display, norm, lexiconHit, thirdParty };
}
