import { nodeHmacSha256 } from '@grouper/core/node';

/** A fixed test HMAC key (production keys come from Secret Manager). */
export const TEST_UID_HMAC_KEY_B64 = Buffer.alloc(32, 7).toString('base64');
export const testUidHmac = nodeHmacSha256(new Uint8Array(Buffer.from(TEST_UID_HMAC_KEY_B64, 'base64')));
