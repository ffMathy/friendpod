/**
 * Removing holdings (DESIGN.md §5.2 (8) Erasure, §10.1 removeInterest; PRIVACY.md §3.5 steps 1, 2 and 6): one
 * transaction deletes the holdings, takes each one's count off its tag slot, and, when a slot reaches 0, subtracts the
 * tag's vector from that concept's `sum` (an emptied non-seed concept is deleted) and drops the tag doc once all three
 * counts are 0 (unless pinned). `matchProfiles.themes`/`themeIds`/`secondary` and `users.interestCount` are rebuilt
 * from what remains. Callers add their own records (ledger entry, consent events) through `finish`, which runs after
 * every read of this transaction.
 */
import {
  EMBEDDING_MODEL,
  matchProfileInterests,
  ordinaryHoldingFromDoc,
  sensitiveHoldingFromDoc,
  type InterestDoc,
  type OrdinaryHolding,
  type SensitiveHolding,
  type SensitiveInterestDoc,
} from '@grouper/core';
import { FieldValue, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { ts } from '../lib/firestore';
import type { AppDeps } from '../lib/runtime';
import { conceptWrite, loadConcept, slotFields, type ConceptWork } from './persist';
import { ownPartition, slotCount, slotOfConcept, slotPartition, SLOTS, tagKeyFor, tagStateFromDoc, type Slot } from './tags';
import { addInto } from './vectors';

export interface RemovedHolding {
  readonly interestId: string;
  readonly partition: 'ordinary' | 'sensitive';
  readonly conceptId: string | null;
}

export interface Selection {
  readonly ordinary: readonly string[];
  readonly sensitive: readonly string[];
}

export interface RemovalContext {
  readonly tx: Transaction;
  readonly removed: readonly RemovedHolding[];
  readonly user: Record<string, unknown> | undefined;
}

export interface RemoveOptions<R> {
  /** Extra reads inside the transaction, before any write. */
  readonly read?: (tx: Transaction) => Promise<R>;
  /** Extra writes, after the holding writes. */
  readonly finish?: (ctx: RemovalContext, extra: R) => void;
}

type Holdings = { ordinary: Map<string, InterestDoc>; sensitive: Map<string, SensitiveInterestDoc> };

export async function removeHoldings<R = undefined>(
  deps: Pick<AppDeps, 'db'>,
  uid: string,
  select: (h: Holdings) => Selection,
  now: number,
  opts: RemoveOptions<R> = {},
): Promise<RemovedHolding[]> {
  const db = deps.db;
  const dim = EMBEDDING_MODEL.dim;
  const userRef = db.doc(`users/${uid}`);
  const profileRef = db.doc(`matchProfiles/${uid}`);
  const interestsCol = db.collection(`users/${uid}/interests`);
  const sensitiveCol = db.collection(`users/${uid}/sensitiveInterests`);

  return db.runTransaction(async (tx) => {
    const [userSnap, profileSnap, ordinarySnap, sensitiveSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef), tx.get(interestsCol), tx.get(sensitiveCol)]);
    const holdings: Holdings = { ordinary: new Map(), sensitive: new Map() };
    for (const d of ordinarySnap.docs) holdings.ordinary.set(d.id, d.data() as InterestDoc);
    for (const d of sensitiveSnap.docs) holdings.sensitive.set(d.id, d.data() as SensitiveInterestDoc);
    const sel = select(holdings);
    const chosen: { id: string; partition: 'ordinary' | 'sensitive'; norm: string; conceptId: string | null; notSensitiveForMe: boolean }[] = [
      ...sel.ordinary.filter((id) => holdings.ordinary.has(id)).map((id) => {
        const h = holdings.ordinary.get(id)!;
        return { id, partition: 'ordinary' as const, norm: h.norm, conceptId: h.state === 'active' ? h.conceptId : null, notSensitiveForMe: h.notSensitiveForMe === true };
      }),
      ...sel.sensitive.filter((id) => holdings.sensitive.has(id)).map((id) => {
        const h = holdings.sensitive.get(id)!;
        return { id, partition: 'sensitive' as const, norm: h.norm, conceptId: h.conceptId, notSensitiveForMe: false };
      }),
    ];
    const locale = userSnap.get('locale') === 'da' ? 'da' : 'en';

    // Tag slots of the holdings that still count (a pendingConsent holding holds no count, §5.2 (8) Rescan).
    const counted = chosen.filter((c) => c.conceptId !== null);
    const tagKeys = [...new Set(counted.map((c) => tagKeyFor(c.norm, EMBEDDING_MODEL.modelKey)))];
    const tagSnaps = tagKeys.length > 0 ? await tx.getAll(...tagKeys.map((k) => db.doc(`tags/${k}`))) : [];
    const tags = new Map(tagKeys.map((k, i) => [k, tagSnaps[i]!] as const));
    interface TagWork {
      readonly ref: DocumentReference;
      readonly raw: Record<string, unknown>;
      readonly counts: Record<Slot, number>;
      langDelta: number;
      readonly touched: Set<Slot>;
      readonly state: ReturnType<typeof tagStateFromDoc>;
    }
    const tagWork = new Map<string, TagWork>();
    const conceptIds = new Set<string>();
    for (const c of counted) {
      const key = tagKeyFor(c.norm, EMBEDDING_MODEL.modelKey);
      const snap = tags.get(key)!;
      if (!snap.exists) continue;
      const state = tagStateFromDoc(snap, dim);
      const raw = snap.data() as Record<string, unknown>;
      // A holding re-pointed by an alias vote (confirmSuggestion) counts in the tag's own slot.
      const slot = slotOfConcept(state, c.conceptId) ?? (c.partition === 'ordinary' && !state.sens.sensitive && !c.notSensitiveForMe ? 'own' : null);
      if (slot === null) continue;
      let w = tagWork.get(key);
      if (!w) {
        w = { ref: snap.ref, raw, counts: { own: slotCount(raw, 'own'), private: slotCount(raw, 'private'), ordinary: slotCount(raw, 'ordinary') }, langDelta: 0, touched: new Set(), state };
        tagWork.set(key, w);
      }
      w.counts[slot] = Math.max(0, w.counts[slot] - 1);
      w.touched.add(slot);
      if (slot === 'own' && ownPartition(state.sens) === 'ordinary') w.langDelta += 1;
      const slotConcept = state.slots[slot];
      if (w.counts[slot] === 0 && slotConcept) conceptIds.add(slotConcept);
    }
    const conceptList = [...conceptIds];
    const conceptSnaps = conceptList.length > 0 ? await tx.getAll(...conceptList.map((id) => db.doc(`concepts/${id}`))) : [];
    const concepts = new Map<string, ConceptWork | null>(conceptList.map((id, i) => [id, loadConcept(conceptSnaps[i]!, dim)]));
    const extra = opts.read ? await opts.read(tx) : (undefined as R);

    // ------------------------------------------------------------ writes
    const at = ts(now);
    for (const w of tagWork.values()) {
      const state = w.state;
      const empty = SLOTS.every((s) => w.counts[s] === 0);
      for (const slot of w.touched) {
        const conceptId = state.slots[slot];
        if (w.counts[slot] === 0 && conceptId) {
          const c = concepts.get(conceptId);
          if (c) {
            if (c.sensitive !== (slotPartition(slot, ownPartition(state.sens)) === 'sensitive')) throw new Error('removeHoldings: partition mismatch');
            addInto(c.sum, state.vec, -1);
            c.n = Math.max(0, c.n - 1);
            c.dirty = true;
          }
        }
      }
      if (empty && w.raw.pinned !== true) {
        tx.delete(w.ref);
        continue;
      }
      const data: Record<string, unknown> = {};
      for (const slot of w.touched) Object.assign(data, slotFields(slot, state.slots[slot], w.counts[slot]));
      if (w.langDelta > 0) data[`langHints.${locale}`] = FieldValue.increment(-Math.min(w.langDelta, Number((w.raw.langHints as Record<string, number> | undefined)?.[locale] ?? 0)));
      tx.update(w.ref, data);
    }
    for (const c of concepts.values()) {
      if (!c?.dirty) continue;
      const data = conceptWrite(c, at);
      if (data) tx.update(c.ref, data);
      else tx.delete(c.ref);
    }
    for (const c of chosen) {
      tx.delete((c.partition === 'ordinary' ? interestsCol : sensitiveCol).doc(c.id));
      if (c.partition === 'ordinary') holdings.ordinary.delete(c.id);
      else holdings.sensitive.delete(c.id);
    }
    if (chosen.length > 0 && profileSnap.exists) {
      const ordinary: OrdinaryHolding[] = [];
      for (const [id, d] of holdings.ordinary) {
        const h = ordinaryHoldingFromDoc(id, d);
        if (h) ordinary.push(h);
      }
      const sensitive: SensitiveHolding[] = [...holdings.sensitive].map(([id, d]) => sensitiveHoldingFromDoc(id, d));
      const { themes, themeIds, secondary } = matchProfileInterests(ordinary, sensitive);
      // Writing matchProfiles also fails a concurrent release batch's precondition, so release revalidates (§10.3).
      tx.update(profileRef, { themes, themeIds, secondary, updatedAt: at });
    }
    if (chosen.length > 0 && userSnap.exists) tx.update(userRef, { interestCount: holdings.ordinary.size + holdings.sensitive.size });
    const removed = chosen.map((c) => ({ interestId: c.id, partition: c.partition, conceptId: c.conceptId }));
    opts.finish?.({ tx, removed, user: userSnap.data() }, extra);
    return removed;
  });
}
