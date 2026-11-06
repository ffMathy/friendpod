import {
  ADD_INTERESTS_MAX_ITEMS,
  EMBEDDING_MODEL_ID,
  decideSensitivity,
  detectorMargin,
  type CallableInput,
  type CallableOutput,
  type ModerationReason,
} from '@grouper/core';
import { useCallback, useState } from 'react';
import { callFunction, toAppError, type AppError } from '@/firebase/callables';
import { EmbedderUnavailableError, getEmbedder, type EmbedderUnavailableReason } from './embedder';
import { checkInterestOnDevice } from './onDeviceCheck';

type ServerResult = CallableOutput<'addInterests'>['results'][number];
type Item = CallableInput<'addInterests'>['items'][number];

export type AddInterestOutcome =
  /** Stopped on the device; nothing was sent. Rendered as a statement of reasons from the code. */
  | { readonly kind: 'rejected'; readonly code: ModerationReason }
  | { readonly kind: 'done'; readonly result: ServerResult };

/** "Keep this private" or "This isn't sensitive for me": holding-level only, never both (addInterestsItem). */
export type HoldingChoice = 'selfFlagPrivate' | 'notSensitiveForMe' | null;

export interface AddInterestOptions {
  /** `users.legal.art9` is present (D3). Without it, a tag that is sensitive for this holding is refused here. */
  readonly hasArt9Consent: boolean;
  readonly choice?: HoldingChoice;
}

/**
 * Adds interests (D1, DESIGN.md §5.2): the on-device text checks, then the pinned model embeds each tag on the phone
 * and the core detector scores it against the prototypes; that margin alone decides the tag's sensitivity (F38). The
 * same `decideSensitivity` as the server runs here, so a
 * tag that would be refused (someone else's Art. 9 data, or sensitive without the blanket consent) never leaves the
 * phone. The rest goes to `addInterests` as {text, vector, detector}; the server repeats the text checks and decides.
 * The same call with `choice` set changes an existing holding (lock it, or "This isn't sensitive for me").
 */
export function useAddInterest() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [unavailable, setUnavailable] = useState<EmbedderUnavailableReason | null>(null);

  const addMany = useCallback(async (texts: readonly string[], opts: AddInterestOptions): Promise<AddInterestOutcome[] | null> => {
    const outcomes: (AddInterestOutcome | null)[] = [];
    const toEmbed: { index: number; text: string; norm: string; thirdParty: boolean }[] = [];
    texts.slice(0, ADD_INTERESTS_MAX_ITEMS).forEach((text, index) => {
      const check = checkInterestOnDevice(text);
      if (check.kind === 'ok') {
        toEmbed.push({ index, text, norm: check.norm, thirdParty: check.thirdParty });
        outcomes.push(null);
      } else {
        outcomes.push({ kind: 'rejected', code: check.code });
      }
    });
    if (toEmbed.length === 0) return outcomes as AddInterestOutcome[];

    setPending(true);
    setError(null);
    setUnavailable(null);
    try {
      const embedder = getEmbedder();
      await embedder.load();
      const [vectors, prototypes] = await Promise.all([embedder.embed(toEmbed.map((t) => t.norm)), embedder.prototypes()]);

      const items: Item[] = [];
      const sentIndex: number[] = [];
      toEmbed.forEach((t, k) => {
        const vector = vectors[k]!;
        const margin = detectorMargin(vector, prototypes);
        const decision = decideSensitivity({
          detectorMargin: margin,
          selfFlagPrivate: opts.choice === 'selfFlagPrivate',
          notSensitiveForMe: opts.choice === 'notSensitiveForMe',
          thirdParty: t.thirdParty,
          hasArt9Consent: opts.hasArt9Consent,
        });
        if (decision.outcome === 'refuseThirdParty') {
          outcomes[t.index] = { kind: 'rejected', code: 'THIRD_PARTY_SENSITIVE' };
          return;
        }
        if (decision.outcome === 'refuseNoConsent') {
          outcomes[t.index] = { kind: 'rejected', code: 'ART9_CONSENT_REQUIRED' };
          return;
        }
        items.push({
          text: t.text,
          vector: Array.from(vector),
          detector: { margin },
          ...(opts.choice ? { [opts.choice]: true } : {}),
        });
        sentIndex.push(t.index);
      });

      if (items.length > 0) {
        const { results } = await callFunction('addInterests', { modelKey: EMBEDDING_MODEL_ID, items });
        if (results.length !== items.length) throw new Error('addInterests returned a different number of results');
        results.forEach((result, k) => {
          outcomes[sentIndex[k]!] = { kind: 'done', result };
        });
      }
      return outcomes as AddInterestOutcome[];
    } catch (e) {
      if (e instanceof EmbedderUnavailableError) setUnavailable(e.reason);
      else setError(toAppError(e));
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const add = useCallback(
    async (text: string, opts: AddInterestOptions): Promise<AddInterestOutcome | null> => (await addMany([text], opts))?.[0] ?? null,
    [addMany],
  );

  return { add, addMany, pending, error, unavailable };
}
