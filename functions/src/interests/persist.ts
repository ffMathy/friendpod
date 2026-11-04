/**
 * Step (7) of DESIGN.md §5.2: one Firestore transaction per request, after the `findNearest` reads. It re-reads
 * everything it relies on (user, tags, holdings, the target concepts, the blanket consent) and refuses a plan built on
 * data that changed in between (StalePlanError, the caller re-plans once). Writes: tag create-or-update, concept
 * `sum`/`c128`/centroid when a text joins or leaves, the holding, candidate-link docs, the weekly sensitive-add
 * bucket, `matchProfiles` (concept ids only) and `users.interestCount`.
 *
 * A sensitive holding points at the grant event of the blanket Art. 9 consent (D3); there are no per-holding consent
 * events and no review-queue entries (D2).
 */
import {
  EMBEDDING_MODEL,
  matchProfileInterests,
  ordinaryHoldingFromDoc,
  PartitionMismatchError,
  sensitiveHoldingFromDoc,
  type CallableOutput,
  type InterestDoc,
  type Locale,
  type OrdinaryHolding,
  type Partition,
  type SensitiveHolding,
  type SensitiveInterestDoc,
  type SensitivitySource,
} from '@grouper/core';
import { FieldValue, type DocumentReference, type DocumentSnapshot, type Firestore, type Timestamp, type Transaction } from 'firebase-admin/firestore';
import { AppError, notImplemented } from '../lib/errors';
import { COLLECTIONS, docs, ts, type DocOf } from '../lib/firestore';
import { rateLimitKey } from '../lib/rateLimits';
import { C128_DIM, CONCEPT_GEN, LIMITS, SENSITIVE_ADDS_BUCKET } from './config';
import { MODERATION_RULES_VERSION } from './moderation';
import { SENSITIVITY_RULES_VERSION, sameTagState, sideSlotField, slotCount, slotPartition, tagStateFromDoc, type Slot, type TagState } from './tags';
import { addInto, fromF32Bytes, normalized, toF32Bytes, truncateNormalize } from './vectors';

export type AddInterestResult = CallableOutput<'addInterests'>['results'][number];

export type Assignment =
  /** The slot already holds this text's vector (count > 0): only counts change. */
  | { readonly kind: 'existing'; readonly conceptId: string }
  | { readonly kind: 'merge'; readonly conceptId: string; readonly cos: number }
  | {
      readonly kind: 'new';
      readonly conceptId: string;
      readonly cos: number;
      readonly link?: { readonly conceptId: string; readonly cos: number; readonly suggest: boolean; readonly labels: { readonly da?: string; readonly en?: string } };
    };

export interface PersistItem {
  readonly index: number;
  readonly norm: string;
  readonly display: string;
  readonly tagKey: string;
  readonly interestId: string;
  /** The holding's partition: the partition key everywhere (§5.2 (5)). */
  readonly partition: Partition;
  readonly slot: Slot;
  /** What the plan was built on; `exists: false` means "create the tag doc". */
  readonly tag: TagState;
  readonly assignment: Assignment;
  /** Set when an existing holding moves partition ("Keep this private", "This isn't sensitive for me"): its old slot. */
  readonly from: Slot | null;
  readonly sensitive: { readonly source: SensitivitySource; readonly selfFlagged: boolean } | null;
  /** An ordinary holding of a sensitive tag ("This isn't sensitive for me"). */
  readonly notSensitiveForMe: boolean;
  readonly thirdPartyWarning: boolean;
}

export interface PersistContext {
  readonly db: Firestore;
  readonly uid: string;
  readonly now: number;
}

export class StalePlanError extends Error {
  readonly tagKeys: readonly string[];

  constructor(tagKeys: readonly string[]) {
    super('persist plan is stale');
    this.tagKeys = tagKeys;
    this.name = 'StalePlanError';
  }
}

const ACTIVE_POD_STATES = new Set(['proposed', 'planning', 'scheduled', 'happened']);
/** Account states in which addInterests may write (a deleting or suspended account adds nothing, PRIVACY.md §6). */
const ACCEPTS_INTERESTS = new Set(['active', 'paused']);

interface ConceptWork {
  readonly ref: DocumentReference;
  readonly isNew: boolean;
  readonly active: boolean;
  readonly sensitive: boolean;
  readonly seed: boolean;
  readonly medoid: Float32Array | null;
  sum: Float32Array;
  n: number;
  dirty: boolean;
}

function loadConcept(snap: DocumentSnapshot, dim: number): ConceptWork | null {
  const d = snap.data();
  if (!d) return null;
  return {
    ref: snap.ref,
    isNew: false,
    active: d.status === 'active',
    sensitive: d.sensitive === true,
    seed: d.seed === true,
    medoid: null,
    sum: fromF32Bytes(d.sum as Uint8Array, dim),
    n: typeof d.n === 'number' ? d.n : 0,
    dirty: false,
  };
}

function conceptWrite(c: ConceptWork, now: Timestamp): Record<string, unknown> | null {
  if (c.n === 0) return c.seed ? { sum: toF32Bytes(c.sum), n: 0, updatedAt: now } : null;
  const centroid = normalized(c.sum);
  return {
    sum: toF32Bytes(c.sum),
    n: c.n,
    centroid: FieldValue.vector(Array.from(centroid)),
    c128: toF32Bytes(truncateNormalize(centroid, C128_DIM)),
    updatedAt: now,
  };
}

function suggestionLabel(a: Assignment, locale: Locale): { conceptId: string; label: string } | undefined {
  if (a.kind !== 'new' || !a.link?.suggest) return undefined;
  const label = a.link.labels[locale];
  return label ? { conceptId: a.link.conceptId, label } : undefined;
}

/** `tags.assign.method` (§8.2 ASSIGN_METHODS) for an assignment made now. */
function assignMethod(a: Exclude<Assignment, { kind: 'existing' }>): 'merge' | 'new' | 'newWithLink' {
  if (a.kind === 'merge') return 'merge';
  return a.link ? 'newWithLink' : 'new';
}

/** Tag-doc fields of a slot set to `conceptId` with `count` holders (side slots are removed at 0). */
function slotFields(slot: Slot, conceptId: string | null, count: number): Record<string, unknown> {
  if (slot === 'own') return { refCount: count, ...(count === 0 ? { conceptId: null } : conceptId ? { conceptId } : {}) };
  return { [sideSlotField(slot)]: count === 0 || !conceptId ? FieldValue.delete() : { conceptId, refCount: count } };
}

export async function persist(ctx: PersistContext, items: readonly PersistItem[]): Promise<Map<number, AddInterestResult>> {
  const { db, uid } = ctx;
  const dim = EMBEDDING_MODEL.dim;
  const refs = docs(db);
  const userRef = db.doc(`users/${uid}`);
  const profileRef = db.doc(`matchProfiles/${uid}`);
  const interestsCol = db.collection(`users/${uid}/interests`);
  const sensitiveCol = db.collection(`users/${uid}/sensitiveInterests`);
  const bucketRef = refs.rateLimit(rateLimitKey(uid, SENSITIVE_ADDS_BUCKET));
  const now = ts(ctx.now);

  return db.runTransaction(async (tx: Transaction) => {
    // ------------------------------------------------------------ reads
    const [userSnap, profileSnap, ...tagSnaps] = await tx.getAll(userRef, profileRef, ...items.map((i) => db.doc(`tags/${i.tagKey}`)));
    if (!userSnap?.exists || !profileSnap?.exists) throw new AppError('NOT_ONBOARDED');
    // Re-checked here: deleteAccount or withdrawArt9Consent can commit while this request is being planned.
    if (!ACCEPTS_INTERESTS.has(String(userSnap.get('status')))) throw new AppError('STATE');
    const locale: Locale = userSnap.get('locale') === 'da' ? 'da' : 'en';
    const art9 = userSnap.get('legal.art9') as { textVersion: string; at: Timestamp } | undefined;

    const stale: string[] = [];
    const fresh = new Map<string, TagState>();
    items.forEach((item, k) => {
      const snap = tagSnaps[k];
      const state: TagState = snap?.exists ? tagStateFromDoc(snap, dim) : { ...item.tag, exists: false, slots: { own: null, private: null, ordinary: null } };
      if (!sameTagState(item.tag, state)) stale.push(item.tagKey);
      fresh.set(item.tagKey, state);
    });
    if (stale.length > 0) throw new StalePlanError(stale);

    const [ordinarySnap, sensitiveSnap] = await Promise.all([tx.get(interestsCol), tx.get(sensitiveCol)]);
    const ordinaryDocs = new Map<string, InterestDoc>();
    for (const d of ordinarySnap.docs) ordinaryDocs.set(d.id, d.data() as InterestDoc);
    const sensitiveDocs = new Map<string, SensitiveInterestDoc>();
    for (const d of sensitiveSnap.docs) sensitiveDocs.set(d.id, d.data() as SensitiveInterestDoc);

    const wantsSensitive = items.some((i) => i.sensitive);
    let grantId: string | null = null;
    let bucket: DocOf<'rateLimit'> | undefined;
    if (wantsSensitive && art9) {
      const events = await tx.get(db.collection(COLLECTIONS.consentEvents).where('uid', '==', uid).where('scope', '==', 'art9'));
      const grant = events.docs.find((e) => e.get('action') === 'grant' && (e.get('createdAt') as Timestamp).isEqual(art9.at));
      // The blanket consent names its grant event by time; without the event the consent cannot be proven.
      if (!grant) throw new Error('addInterests: blanket consent without its grant event');
      grantId = grant.id;
      const b = (await tx.get(bucketRef)).data();
      bucket = b && ctx.now - b.windowStart.toMillis() < LIMITS.sensitiveAddsWindowMs ? b : undefined;
    }
    if (items.some((i) => i.from !== null)) {
      const pods = await tx.get(db.collection('pods').where('memberUids', 'array-contains', uid));
      if (pods.docs.some((p) => ACTIVE_POD_STATES.has(String(p.get('state'))))) {
        // TODO(M1): recompute podInterests of the user's active pods in this transaction (§10.2).
        throw notImplemented('§10.2');
      }
    }

    const conceptIds = new Set<string>();
    const linkIds = new Map<number, string>();
    for (const item of items) {
      conceptIds.add(item.assignment.conceptId);
      if (item.from) {
        const old = fresh.get(item.tagKey)!.slots[item.from];
        if (old) conceptIds.add(old);
      }
      const a = item.assignment;
      if (a.kind === 'new' && a.link) linkIds.set(item.index, [a.conceptId, a.link.conceptId].sort().join('__'));
    }
    const conceptList = [...conceptIds];
    const extraRefs = [...conceptList.map((id) => db.doc(`concepts/${id}`)), ...[...linkIds.values()].map((id) => db.doc(`conceptLinks/${id}`))];
    const extraSnaps = extraRefs.length > 0 ? await tx.getAll(...extraRefs) : [];
    const concepts = new Map<string, ConceptWork | null>();
    conceptList.forEach((id, k) => concepts.set(id, loadConcept(extraSnaps[k]!, dim)));
    const existingLinks = new Set(extraSnaps.slice(conceptList.length).filter((s) => s.exists).map((s) => s.ref.path));

    // ------------------------------------------------------------ decide, in item order
    const results = new Map<number, AddInterestResult>();
    let written = false;
    let holdingCount = ordinaryDocs.size + sensitiveDocs.size;
    let sensitiveAdds = bucket?.count ?? 0;
    const tagWrites: { ref: DocumentReference; create: boolean; data: Record<string, unknown> }[] = [];
    const otherWrites: ((t: Transaction) => void)[] = [];

    for (const [k, item] of items.entries()) {
      const tag = fresh.get(item.tagKey)!;
      const heldOrdinary = ordinaryDocs.get(item.interestId);
      const heldSensitive = sensitiveDocs.get(item.interestId);
      const held = heldOrdinary ?? heldSensitive;
      if (item.from === null && held) {
        results.set(item.index, { status: 'duplicate', interestId: item.interestId });
        continue;
      }
      const movesFrom: Partition | null = item.from === null ? null : item.partition === 'sensitive' ? 'ordinary' : 'sensitive';
      if (movesFrom !== null && !(movesFrom === 'ordinary' ? heldOrdinary : heldSensitive)) throw new StalePlanError([item.tagKey]);
      if (movesFrom === null && holdingCount >= LIMITS.maxInterests) {
        results.set(item.index, { status: 'limit', reasonCode: 'INTEREST_LIMIT' });
        continue;
      }
      if (item.sensitive && !grantId) {
        results.set(item.index, { status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' });
        continue;
      }
      if (item.sensitive && sensitiveAdds >= LIMITS.sensitiveAddsPer7Days) {
        results.set(item.index, { status: 'limit', reasonCode: 'SENSITIVE_ADD_LIMIT' });
        continue;
      }

      // The concept this holding points at, and whether this text's vector joins its sum.
      const a = item.assignment;
      let concept = concepts.get(a.conceptId) ?? null;
      let joins: boolean;
      if (a.kind === 'existing') {
        if (!concept) throw new StalePlanError([item.tagKey]);
        joins = false;
      } else if (a.kind === 'merge') {
        // A merge target that was deleted or merged away since findNearest: re-plan.
        if (!concept?.active) throw new StalePlanError([item.tagKey]);
        joins = true;
      } else {
        if (!concept) {
          // Deterministic id: racing creators of one text meet here.
          concept = {
            ref: db.doc(`concepts/${a.conceptId}`),
            isNew: true,
            active: true,
            sensitive: item.partition === 'sensitive',
            seed: false,
            medoid: tag.vec,
            sum: new Float32Array(dim),
            n: 0,
            dirty: true,
          };
          concepts.set(a.conceptId, concept);
        }
        joins = true;
      }
      if (concept.sensitive !== (item.partition === 'sensitive')) throw new PartitionMismatchError();
      if (joins) {
        addInto(concept.sum, tag.vec, 1);
        concept.n += 1;
        concept.dirty = true;
      }

      // Tag doc: create, or move one count into the slot (and out of the old one).
      const tagRef = db.doc(`tags/${item.tagKey}`);
      const ownPartitionOrdinary = !tag.sens.sensitive;
      if (!tag.exists) {
        if (a.kind === 'existing' || item.from !== null) throw new StalePlanError([item.tagKey]);
        const langHints = { da: 0, en: 0 };
        // Labels come only from ordinary holdings of ordinary tags; a sensitive text never becomes a label.
        if (item.slot === 'own' && ownPartitionOrdinary) langHints[locale] += 1;
        tagWrites.push({
          ref: tagRef,
          create: true,
          data: {
            norm: item.norm,
            vec: FieldValue.vector(Array.from(tag.vec)),
            modelId: EMBEDDING_MODEL.modelKey,
            sens: { sensitive: tag.sens.sensitive, margin: tag.sens.margin, lexiconHit: tag.sens.lexiconHit, knownOrdinary: tag.sens.knownOrdinary, rulesVersion: SENSITIVITY_RULES_VERSION },
            moderation: { status: 'ok', rulesVersion: MODERATION_RULES_VERSION },
            conceptId: item.slot === 'own' ? a.conceptId : null,
            // For a text first added into a side slot this records that assignment; `conceptId` stays null.
            assign: { cos: a.cos, method: assignMethod(a) },
            ...(item.slot === 'own' ? {} : { [sideSlotField(item.slot)]: { conceptId: a.conceptId, refCount: 1 } }),
            aliasVotes: {},
            refCount: item.slot === 'own' ? 1 : 0,
            langHints,
            createdAt: now,
          },
        });
      } else {
        const raw = tagSnaps[k]!.data() as Record<string, unknown>;
        const data: Record<string, unknown> = { ...slotFields(item.slot, a.conceptId, slotCount(raw, item.slot) + 1) };
        if (item.slot === 'own') {
          if (tag.slots.own === null && a.kind !== 'existing') data.assign = { cos: a.cos, method: assignMethod(a) };
          if (ownPartitionOrdinary) data[`langHints.${locale}`] = FieldValue.increment(1);
        }
        if (item.from !== null) {
          if (item.from === item.slot) throw new PartitionMismatchError();
          const left = slotCount(raw, item.from) - 1;
          const oldId = tag.slots[item.from];
          Object.assign(data, slotFields(item.from, oldId, Math.max(0, left)));
          const old = oldId ? concepts.get(oldId) : null;
          if (left <= 0 && old) {
            if (old.sensitive !== (slotPartition(item.from, tag.sens.sensitive ? 'sensitive' : 'ordinary') === 'sensitive')) throw new PartitionMismatchError();
            // The text leaves that concept: its vector leaves the sum (an emptied concept is deleted).
            addInto(old.sum, tag.vec, -1);
            old.n -= 1;
            old.dirty = true;
          }
        }
        tagWrites.push({ ref: tagRef, create: false, data });
      }

      // The holding.
      if (item.sensitive) {
        const g = item.sensitive;
        const doc: SensitiveInterestDoc = {
          display: held?.display ?? item.display,
          norm: item.norm,
          conceptId: a.conceptId,
          selfFlagged: g.selfFlagged,
          source: g.source,
          consentEventId: grantId!,
          consentTextVersion: art9!.textVersion,
          consentedAt: art9!.at,
          starred: held?.starred ?? false,
        };
        sensitiveDocs.set(item.interestId, doc);
        if (heldOrdinary) {
          ordinaryDocs.delete(item.interestId);
          otherWrites.push((t) => t.delete(interestsCol.doc(item.interestId)));
        }
        otherWrites.push((t) => t.create(sensitiveCol.doc(item.interestId), doc));
        sensitiveAdds += 1;
      } else {
        const doc: InterestDoc = {
          display: held?.display ?? item.display,
          norm: item.norm,
          conceptId: a.conceptId,
          starred: held?.starred ?? false,
          ...(item.notSensitiveForMe ? { notSensitiveForMe: true } : {}),
          state: 'active',
          createdAt: heldOrdinary?.createdAt ?? now,
        };
        ordinaryDocs.set(item.interestId, doc);
        if (heldSensitive) {
          sensitiveDocs.delete(item.interestId);
          otherWrites.push((t) => t.delete(sensitiveCol.doc(item.interestId)));
        }
        otherWrites.push((t) => t.create(interestsCol.doc(item.interestId), doc));
      }
      if (movesFrom === null) holdingCount += 1;
      written = true;

      const linkId = linkIds.get(item.index);
      if (linkId && a.kind === 'new' && a.link && !existingLinks.has(`conceptLinks/${linkId}`)) {
        const cos = a.link.cos;
        otherWrites.push((t) => t.create(db.doc(`conceptLinks/${linkId}`), { cos, status: 'candidate', votes: 0 }));
        existingLinks.add(`conceptLinks/${linkId}`);
      }

      const suggestion = suggestionLabel(a, locale);
      results.set(item.index, {
        status: movesFrom === null ? 'added' : item.partition === 'sensitive' ? 'madePrivate' : 'madeOrdinary',
        interestId: item.interestId,
        private: item.partition === 'sensitive',
        ...(suggestion ? { suggestion } : {}),
        ...(item.thirdPartyWarning ? { warning: 'THIRD_PARTY' as const } : {}),
      });
    }

    // ------------------------------------------------------------ writes
    for (const w of tagWrites) {
      if (w.create) tx.create(w.ref, w.data);
      else tx.update(w.ref, w.data);
    }
    for (const c of concepts.values()) {
      if (!c?.dirty) continue;
      const data = conceptWrite(c, now);
      if (c.isNew) {
        if (!data || !c.medoid) throw new Error('new concept without members');
        tx.create(c.ref, {
          ...data,
          medoid: FieldValue.vector(Array.from(c.medoid)),
          sensitive: c.sensitive,
          labels: {},
          holderCount: 0,
          status: 'active',
          gen: CONCEPT_GEN,
          createdAt: now,
        });
      } else if (data) {
        tx.update(c.ref, data);
      } else {
        tx.delete(c.ref);
      }
    }
    for (const w of otherWrites) w(tx);
    if (sensitiveAdds > (bucket?.count ?? 0)) {
      const start = bucket?.windowStart.toMillis() ?? ctx.now;
      tx.set(bucketRef, { count: sensitiveAdds, windowStart: ts(start), expiresAt: ts(start + LIMITS.sensitiveAddsWindowMs) });
    }

    if (written) {
      const ordinary: OrdinaryHolding[] = [];
      for (const [id, d] of ordinaryDocs) {
        const h = ordinaryHoldingFromDoc(id, d);
        if (h) ordinary.push(h);
      }
      const sensitive: SensitiveHolding[] = [...sensitiveDocs].map(([id, d]) => sensitiveHoldingFromDoc(id, d));
      const { themes, themeIds, secondary } = matchProfileInterests(ordinary, sensitive);
      tx.update(profileRef, { themes, themeIds, secondary, updatedAt: now });
      tx.update(userRef, { interestCount: ordinaryDocs.size + sensitiveDocs.size });
    }
    return results;
  });
}
