import type { CallableOutput, ModerationReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { callFunction, toAppError, type AppError } from '@/firebase/callables';
import type { Art9ConsentGrant } from '@/features/consent/art9';
import { requestArt9Consent } from '@/features/consent/requests';
import { checkInterestOnDevice } from './onDeviceCheck';

type ServerResult = CallableOutput<'addInterests'>['results'][number];

export type AddInterestOutcome =
  /** Stopped on the device; nothing was sent. Rendered as a statement of reasons from the code. */
  | { readonly kind: 'rejected'; readonly code: ModerationReason }
  /** "Don't add" on the consent sheet: discarded, nothing sent or kept. */
  | { readonly kind: 'discarded' }
  | { readonly kind: 'done'; readonly result: ServerResult };

/**
 * Adds one interest (or makes an existing one private with `selfFlag`): on-device check, consent sheet
 * before sending on a lexicon hit, and a second round when the server's detector asks for consent.
 */
export function useAddInterest() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const askConsent = useCallback(
    (tag: string): Promise<Art9ConsentGrant | null> =>
      requestArt9Consent(tag, (request) => router.push({ pathname: '/sheets/consent', params: { request } })),
    [router],
  );

  const add = useCallback(
    async (text: string, opts: { readonly selfFlag?: boolean } = {}): Promise<AddInterestOutcome | null> => {
      const check = checkInterestOnDevice(text, opts);
      if (check.kind === 'invalid' || check.kind === 'rejected' || check.kind === 'refused') {
        return { kind: 'rejected', code: check.code };
      }
      setPending(true);
      setError(null);
      try {
        let grant: Art9ConsentGrant | null = null;
        if (check.kind === 'needsConsent') {
          grant = await askConsent(check.display);
          if (!grant) return { kind: 'discarded' };
        }
        const send = async (g: Art9ConsentGrant | null) => {
          const item = {
            text,
            ...(opts.selfFlag ? { selfFlag: true } : {}),
            ...(g ? { consent: g.consent, ...(g.category ? { category: g.category } : {}) } : {}),
          };
          const { results } = await callFunction('addInterests', { items: [item] });
          const first = results[0];
          if (!first) throw new Error('addInterests returned no result');
          return first;
        };
        let result = await send(grant);
        if (result.status === 'needsConsent' && !grant) {
          grant = await askConsent(check.display);
          if (!grant) return { kind: 'discarded' };
          result = await send(grant);
        }
        return { kind: 'done', result };
      } catch (e) {
        setError(toAppError(e));
        return null;
      } finally {
        setPending(false);
      }
    },
    [askConsent],
  );

  return { add, pending, error };
}

/** `items: []` warms up the embedder that will serve the next add (§10.2); failures are irrelevant. */
export function warmUpEmbedder(): void {
  callFunction('addInterests', { items: [] }).catch(() => undefined);
}
