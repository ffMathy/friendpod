/**
 * HMAC-SHA256 with the key bound inside. Keys come from Secret Manager in Functions; core never sees them.
 * Async so a Web Crypto implementation fits; Node's is in `@friendpod/core/node`.
 */
export type HmacSha256 = (message: Uint8Array) => Promise<Uint8Array>;

/** The subset of Web Crypto's SubtleCrypto this module needs (no DOM lib dependency). */
export interface SubtleCryptoLike {
  importKey(
    format: 'raw',
    keyData: Uint8Array,
    algorithm: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: boolean,
    keyUsages: ['sign'],
  ): Promise<unknown>;
  sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

export function webCryptoHmacSha256(subtle: SubtleCryptoLike, key: Uint8Array): HmacSha256 {
  if (key.length < 32) throw new Error('HMAC key must be at least 32 bytes');
  const imported = subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return async (message) => new Uint8Array(await subtle.sign('HMAC', await imported, message));
}
