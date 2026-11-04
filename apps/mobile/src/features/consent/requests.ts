import type { Art9ConsentGrant } from './art9';

/**
 * Hands one consent request from the screen that needs it to the `sheets/consent` modal and back.
 * The tag text stays in memory: it never goes into a route URL, a log or storage before consent.
 * One request at a time; a newer request cancels an older one (as "Don't add").
 */
interface Pending {
  readonly id: string;
  readonly tag: string;
  readonly resolve: (grant: Art9ConsentGrant | null) => void;
}

let pending: Pending | null = null;
let counter = 0;

export function requestArt9Consent(tag: string, open: (requestId: string) => void): Promise<Art9ConsentGrant | null> {
  pending?.resolve(null);
  counter += 1;
  const id = `c${counter}`;
  return new Promise((resolve) => {
    pending = { id, tag, resolve };
    open(id);
  });
}

export function consentRequestTag(requestId: string): string | null {
  return pending?.id === requestId ? pending.tag : null;
}

/** `null` means "Don't add": the tag is discarded with no other consequence (PRIVACY.md §3.1). */
export function settleConsentRequest(requestId: string, grant: Art9ConsentGrant | null): void {
  if (pending?.id !== requestId) return;
  const { resolve } = pending;
  pending = null;
  resolve(grant);
}
