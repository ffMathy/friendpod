/**
 * Secret Manager secrets (DESIGN.md §7). Each value is base64 of at least 32 random bytes
 * (`openssl rand -base64 32 | firebase functions:secrets:set UID_HMAC_KEY --data-file=-`).
 * UID_HMAC_KEY is domain-separated by message prefix: uidH, interestId, underage and ban email hashes.
 */
import type { HmacSha256 } from '@grouper/core';
import { nodeHmacSha256 } from '@grouper/core/node';
import { defineSecret } from 'firebase-functions/params';

export const UID_HMAC_KEY = defineSecret('UID_HMAC_KEY');
export const POD_ID_KEY = defineSecret('POD_ID_KEY');

const byValue = new Map<string, HmacSha256>();

export function hmacFromSecret(value: string): HmacSha256 {
  let hmac = byValue.get(value);
  if (!hmac) {
    const key = Buffer.from(value.trim(), 'base64');
    if (key.length < 32) throw new Error('HMAC secret must be base64 of at least 32 bytes');
    hmac = nodeHmacSha256(new Uint8Array(key));
    byValue.set(value, hmac);
  }
  return hmac;
}
