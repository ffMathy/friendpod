/**
 * removeInterest, updateInterest and confirmSuggestion (DESIGN.md §5.2 (6), §10.1; PRIVACY.md §3.5).
 * "Keep this private" and "This isn't sensitive for me" (the former "treat as ordinary") go through addInterests with
 * `selfFlagPrivate` / `notSensitiveForMe` (§10.2), never through these.
 */
import {
  matchProfileInterests,
  ordinaryHoldingFromDoc,
  sensitiveHoldingFromDoc,
  EMBEDDING_MODEL,
  type CallableInput,
  type CallableOutput,
  type InterestDoc,
  type SensitiveInterestDoc,
} from '@grouper/core';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { ERASURE_LEDGER_TTL_MS, docs, erasureLedger, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';
import { applyAliasIfAgreed, ALIAS_VOTES_FOR_ALL, conceptLinkId } from '../interests/alias';
import { recomputePodInterests } from '../interests/podInterests';
import { removeHoldings } from '../interests/remove';
import { tagKeyFor } from '../interests/tags';
import { exitPod, podsOf } from '../pods/exit';

/** Starred interests, sensitive included (§4.3). */
export const MAX_STARRED = 3;

export interface RemoveOptions {
  /** Writes the erasure-ledger entry (`interest`, the HMAC'd interestId); `id` reuses a replayed entry's id (§13). */
  readonly ledger: { readonly uidH: string; readonly id?: string } | null;
}

/**
 * One holding. Ordinary: delete it, its tag count and concept sum, `matchProfiles`, the `podInterests` of the user's
 * pods, a ledger entry. Sensitive: the PRIVACY.md §3.5 effects for that holding only (the blanket consent stays): the
 * pods themed on it first (exitPod, so a retry still finds them while the holding exists), then the holding.
 * Returns false when there is no such holding.
 */
export async function removeOneInterest(deps: AppDeps, uid: string, interestId: string, now: number, o: RemoveOptions): Promise<boolean> {
  const refs = docs(deps.db);
  const [ordinary, sensitive] = await Promise.all([refs.interest(uid, interestId).get(), refs.sensitiveInterest(uid, interestId).get()]);
  const holding = sensitive.data();
  if (!ordinary.exists && !holding) return false;
  if (holding) {
    for (const { podId, ps } of await podsOf(deps, uid)) {
      const themed = ps.theme.kind === 'concept' && ps.theme.sensitive && (ps.theme.conceptId === holding.conceptId || ps.members[uid]?.themeInterestId === interestId);
      if (themed) await exitPod(deps, podId, uid, 'withdrawal');
    }
  }
  const removed = await removeHoldings(deps, uid, () => ({ ordinary: ordinary.exists ? [interestId] : [], sensitive: holding ? [interestId] : [] }), now, {
    finish: ({ tx, removed: r }) => {
      if (r.length === 0 || !o.ledger) return;
      const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
      tx.set(ref, { uidH: o.ledger.uidH, kind: 'interest', ref: interestId, at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    },
  });
  if (removed.some((r) => r.partition === 'ordinary')) await recomputePodInterests(deps, uid, now);
  return removed.length > 0 || Boolean(holding);
}

export async function removeInterest(deps: AppDeps, call: CallContext, input: CallableInput<'removeInterest'>): Promise<CallableOutput<'removeInterest'>> {
  const user = (await docs(deps.db).user(call.uid).get()).data();
  if (!user) throw new AppError('NOT_FOUND');
  if (!(await removeOneInterest(deps, call.uid, input.interestId, call.now, { ledger: { uidH: await call.uidH() } }))) throw new AppError('NOT_FOUND');
  return { ok: true };
}

/** Star or unstar any holding; at most 3 starred (§4.3). The star reaches `matchProfiles.themes` (s = 1.0). */
export async function updateInterest(deps: AppDeps, call: CallContext, input: CallableInput<'updateInterest'>): Promise<CallableOutput<'updateInterest'>> {
  const { uid } = call;
  const db = deps.db;
  await db.runTransaction(async (tx) => {
    const [user, ord, sens] = await Promise.all([tx.get(docs(db).user(uid)), tx.get(db.collection(`users/${uid}/interests`)), tx.get(db.collection(`users/${uid}/sensitiveInterests`))]);
    const u = user.data();
    if (!u) throw new AppError('NOT_FOUND');
    if (u.status === 'deleting') throw new AppError('STATE');
    const ordinary = new Map(ord.docs.map((d) => [d.id, d.data() as InterestDoc]));
    const sensitive = new Map(sens.docs.map((d) => [d.id, d.data() as SensitiveInterestDoc]));
    const target = ordinary.get(input.interestId) ?? sensitive.get(input.interestId);
    if (!target) throw new AppError('NOT_FOUND');
    if (target.starred === input.starred) return;
    if (input.starred) {
      const starred = [...ordinary.values(), ...sensitive.values()].filter((h) => h.starred).length;
      if (starred >= MAX_STARRED) throw new AppError('STAR_LIMIT');
    }
    if (ordinary.has(input.interestId)) {
      ordinary.set(input.interestId, { ...ordinary.get(input.interestId)!, starred: input.starred });
      tx.update(db.doc(`users/${uid}/interests/${input.interestId}`), { starred: input.starred });
    } else {
      sensitive.set(input.interestId, { ...sensitive.get(input.interestId)!, starred: input.starred });
      tx.update(db.doc(`users/${uid}/sensitiveInterests/${input.interestId}`), { starred: input.starred });
    }
    const { themes, themeIds, secondary } = matchProfileInterests(
      [...ordinary].flatMap(([id, d]) => {
        const h = ordinaryHoldingFromDoc(id, d);
        return h ? [h] : [];
      }),
      [...sensitive].map(([id, d]) => sensitiveHoldingFromDoc(id, d)),
    );
    tx.update(db.doc(`matchProfiles/${uid}`), { themes, themeIds, secondary, updatedAt: ts(call.now) });
  });
  return { ok: true };
}

/**
 * "Did you mean <label>?" → yes (§5.2 (6)): re-points the user's ordinary holding to the suggested concept and records
 * one alias vote on the tag. Only for a suggestion the server made: an ordinary own-slot holding of an ordinary tag,
 * and a candidate link between the two concepts. Once 3 distinct users confirm, the text maps to that concept for
 * everyone (applyAliasIfAgreed). A user votes once per text: their holding then already points at the concept.
 */
export async function confirmSuggestion(deps: AppDeps, call: CallContext, input: CallableInput<'confirmSuggestion'>): Promise<CallableOutput<'confirmSuggestion'>> {
  const { uid } = call;
  const db = deps.db;
  const refs = docs(db);
  const outcome = await db.runTransaction(async (tx) => {
    const holdingRef = refs.interest(uid, input.interestId);
    const [hSnap, profile, ord, sens] = await Promise.all([
      tx.get(holdingRef),
      tx.get(refs.matchProfile(uid)),
      tx.get(db.collection(`users/${uid}/interests`)),
      tx.get(db.collection(`users/${uid}/sensitiveInterests`)),
    ]);
    const h = hSnap.data();
    if (!h || h.state !== 'active' || h.notSensitiveForMe || !h.conceptId || !profile.exists) throw new AppError('STATE');
    if (h.conceptId === input.conceptId) return null;
    const tagKey = tagKeyFor(h.norm, EMBEDDING_MODEL.modelKey);
    const [tagSnap, conceptSnap, linkSnap] = await tx.getAll(db.doc(`tags/${tagKey}`), db.doc(`concepts/${input.conceptId}`), db.doc(`conceptLinks/${conceptLinkId(h.conceptId, input.conceptId)}`));
    const tag = tagSnap!.data();
    const concept = conceptSnap!.data();
    const ownConcept = tag?.conceptId as string | null | undefined;
    if (!tag || tag.sens?.sensitive === true || ownConcept !== h.conceptId) throw new AppError('STATE');
    if (!concept || concept.sensitive !== false || concept.status !== 'active' || !linkSnap!.exists) throw new AppError('STATE');
    tx.update(holdingRef, { conceptId: input.conceptId });
    tx.update(tagSnap!.ref, { [`aliasVotes.${input.conceptId}`]: FieldValue.increment(1) });
    tx.update(linkSnap!.ref, { votes: FieldValue.increment(1) });
    const ordinary = ord.docs.flatMap((d) => {
      const doc = d.id === input.interestId ? { ...(d.data() as InterestDoc), conceptId: input.conceptId } : (d.data() as InterestDoc);
      const x = ordinaryHoldingFromDoc(d.id, doc);
      return x ? [x] : [];
    });
    const { themes, themeIds, secondary } = matchProfileInterests(ordinary, sens.docs.map((d) => sensitiveHoldingFromDoc(d.id, d.data() as SensitiveInterestDoc)));
    tx.update(refs.matchProfile(uid).withConverter(null), { themes, themeIds, secondary, updatedAt: ts(call.now) });
    const votes = Number((tag.aliasVotes as Record<string, number> | undefined)?.[input.conceptId] ?? 0) + 1;
    return { tagKey, from: h.conceptId, votes };
  });
  if (outcome && outcome.votes >= ALIAS_VOTES_FOR_ALL) await applyAliasIfAgreed(deps, outcome.tagKey, outcome.from, input.conceptId, call.now);
  if (outcome) await recomputePodInterests(deps, uid, call.now);
  return { ok: true };
}
