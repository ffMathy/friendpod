import { detectThirdParty, findPii, lexiconCheck, normalizeTag, type Art9Category, type NormalizeFailure } from '@grouper/core';

/**
 * Step (0) of the interest pipeline (DESIGN.md §5.2): the same normalization, PII patterns and
 * high-precision Art. 9 lexicon as the server, run before any text leaves the phone. A lexicon hit
 * (or "Keep this private") opens the consent sheet first, so clear Art. 9 text is only ever sent with
 * a consent payload. The embedding detector (row 4) runs on the server only (Q18); the server repeats
 * every check and never trusts this result.
 */
export type DeviceCheckResult =
  | { readonly kind: 'invalid'; readonly code: NormalizeFailure }
  | { readonly kind: 'rejected'; readonly code: 'PII' }
  /** A family member's sensitive data: the user's own consent cannot cover it (PRIVACY.md §4.3). */
  | { readonly kind: 'refused'; readonly code: 'THIRD_PARTY_SENSITIVE' }
  | { readonly kind: 'needsConsent'; readonly display: string; readonly norm: string; readonly categories: readonly Art9Category[] }
  | { readonly kind: 'ok'; readonly display: string; readonly norm: string; readonly thirdPartyWarning: boolean };

export function checkInterestOnDevice(text: string, opts: { readonly selfFlag?: boolean } = {}): DeviceCheckResult {
  const normalized = normalizeTag(text);
  if (!normalized.ok) return { kind: 'invalid', code: normalized.code };
  const { norm, display } = normalized;
  if (findPii(text).length > 0) return { kind: 'rejected', code: 'PII' };

  // Rows 2 and 3 of §5.2 (5): lexicon (tag-level) and self-flag (this holding only).
  const lexicon = lexiconCheck(norm);
  const thirdParty = detectThirdParty(norm).hit;
  if (lexicon.hit && thirdParty) return { kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' };
  if (lexicon.hit || opts.selfFlag === true) {
    return { kind: 'needsConsent', display, norm, categories: lexicon.categories };
  }
  return { kind: 'ok', display, norm, thirdPartyWarning: thirdParty };
}
