/**
 * Alias votes (DESIGN.md §5.2 (6)): once 3 distinct users confirmed "Did you mean …?" for a text, that text maps to
 * the suggested concept for everyone (non-sensitive only). With threshold merges this is the only way concepts change
 * (F17): the tag's own slot moves to the concept (its vector leaves the old sum and joins the new one), and every
 * remaining ordinary holding of the text is re-pointed, each holder's `matchProfiles` rebuilt.
 */
import {
  EMBEDDING_MODEL,
  matchProfileInterests,
  ordinaryHoldingFromDoc,
  sensitiveHoldingFromDoc,
  type InterestDoc,
  type SensitiveInterestDoc,
} from '@friendpod/core';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ts } from '../lib/firestore';
import type { AppDeps } from '../lib/runtime';
import { conceptWrite, loadConcept } from './persist';
import { tagStateFromDoc } from './tags';
import { addInto } from './vectors';

export const ALIAS_VOTES_FOR_ALL = 3;

/** `conceptLinks/{a}__{b}` with the two ids sorted (§8.2). */
export function conceptLinkId(a: string, b: string): string {
  return [a, b].sort().join('__');
}

/** Rebuilds `matchProfiles.{themes, themeIds, secondary}` from the holdings, inside `tx` (reads first). */
export async function readProfileInterests(db: Firestore, tx: Transaction, uid: string, patch: (id: string, d: InterestDoc) => InterestDoc = (_i, d) => d) {
  const [ord, sens] = await Promise.all([tx.get(db.collection(`users/${uid}/interests`)), tx.get(db.collection(`users/${uid}/sensitiveInterests`))]);
  return matchProfileInterests(
    ord.docs.flatMap((d) => {
      const h = ordinaryHoldingFromDoc(d.id, patch(d.id, d.data() as InterestDoc));
      return h ? [h] : [];
    }),
    sens.docs.map((d) => sensitiveHoldingFromDoc(d.id, d.data() as SensitiveInterestDoc)),
  );
}

export async function applyAliasIfAgreed(deps: Pick<AppDeps, 'db'>, tagKey: string, from: string, to: string, now: number): Promise<boolean> {
  const db = deps.db;
  const dim = EMBEDDING_MODEL.dim;
  const moved = await db.runTransaction(async (tx) => {
    const tagRef = db.doc(`tags/${tagKey}`);
    const [tagSnap, fromSnap, toSnap] = await tx.getAll(tagRef, db.doc(`concepts/${from}`), db.doc(`concepts/${to}`));
    const tag = tagSnap!.data();
    if (!tag || tag.conceptId !== from || tag.sens?.sensitive === true) return null;
    if (Number(tag.aliasVotes?.[to] ?? 0) < ALIAS_VOTES_FOR_ALL) return null;
    const target = loadConcept(toSnap!, dim);
    if (!target || !target.active || target.sensitive) return null;
    const source = loadConcept(fromSnap!, dim);
    const vec = tagStateFromDoc(tagSnap!, dim).vec;
    const at = ts(now);
    if (source) {
      addInto(source.sum, vec, -1);
      source.n = Math.max(0, source.n - 1);
      const data = conceptWrite(source, at);
      if (data) tx.update(source.ref, data);
      else tx.delete(source.ref);
    }
    addInto(target.sum, vec, 1);
    target.n += 1;
    tx.update(target.ref, conceptWrite(target, at)!);
    tx.update(tagRef, { conceptId: to, assign: { cos: Number(tag.assign?.cos ?? 0), method: 'alias' } });
    tx.set(db.doc(`conceptLinks/${conceptLinkId(from, to)}`), { status: 'confirmed' }, { merge: true });
    return String(tag.norm);
  });
  if (moved === null) return false;
  const holders = await db.collectionGroup('interests').where('conceptId', '==', from).get();
  for (const h of holders.docs) {
    const d = h.data() as InterestDoc;
    if (d.norm !== moved || d.notSensitiveForMe) continue;
    const uid = h.ref.parent.parent!.id;
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(h.ref)).data() as InterestDoc | undefined;
      if (!fresh || fresh.conceptId !== from) return;
      const { themes, themeIds, secondary } = await readProfileInterests(db, tx, uid, (id, doc) => (id === h.id ? { ...doc, conceptId: to } : doc));
      const profile = db.doc(`matchProfiles/${uid}`);
      const exists = (await tx.get(profile)).exists;
      tx.update(h.ref, { conceptId: to });
      if (exists) tx.update(profile, { themes, themeIds, secondary, updatedAt: ts(now) });
    });
  }
  return true;
}
