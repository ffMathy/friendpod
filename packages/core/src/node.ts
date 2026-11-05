/**
 * Server-only helpers (`@grouper/core/node`). Kept out of the main entry so Metro never sees node:crypto or the
 * log-scrubbing code that only the Functions codebases use.
 */
import { createHash, createHmac } from 'node:crypto';
import type { HmacSha256 } from './ids/hmac';

export { declaredKeys, parseSafely, stackFrames, type ParseResult, type SafeIssue, type Schema } from './server/logSafe';

export function nodeHmacSha256(key: Uint8Array): HmacSha256 {
  if (key.length < 32) throw new Error('HMAC key must be at least 32 bytes');
  const k = Buffer.from(key);
  return async (message) => new Uint8Array(createHmac('sha256', k).update(message).digest());
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}
