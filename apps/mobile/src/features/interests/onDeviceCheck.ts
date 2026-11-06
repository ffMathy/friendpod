import { detectThirdParty, findPii, normalizeTag, type NormalizeFailure } from '@grouper/core';

/**
 * Step (0) of the interest pipeline (DESIGN.md §5.2): the same normalization and PII patterns as the server, run
 * before any text leaves the phone. Sensitivity is the on-device model's alone (F35): the embedding and the detector
 * margin follow in useAddInterest, which also refuses a third-party tag once the model calls it sensitive. The
 * server repeats the text checks and decides with the margin the phone sent.
 */
export type DeviceCheckResult =
  | { readonly kind: 'invalid'; readonly code: NormalizeFailure }
  | { readonly kind: 'rejected'; readonly code: 'PII' }
  | {
      readonly kind: 'ok';
      readonly display: string;
      readonly norm: string;
      /** Possessive kinship pattern: not a sensitivity source, it only reacts to the model's result. */
      readonly thirdParty: boolean;
    };

export function checkInterestOnDevice(text: string): DeviceCheckResult {
  const normalized = normalizeTag(text);
  if (!normalized.ok) return { kind: 'invalid', code: normalized.code };
  const { norm, display } = normalized;
  if (findPii(text).length > 0) return { kind: 'rejected', code: 'PII' };
  return { kind: 'ok', display, norm, thirdParty: detectThirdParty(norm).hit };
}
