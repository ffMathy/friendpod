/**
 * Step (7) of DESIGN.md §5.2: one Firestore transaction per request, after the `findNearest` reads. It
 * re-reads everything it relies on (tags, holdings, the target concepts, the consent log) and refuses a
 * plan built on data that changed in between (StalePlanError, the caller re-plans once). Writes: tag
 * create-or-update, concept `sum`/`c128`/centroid when a new text joins, the holding, a consent event for
 * a sensitive holding, review-queue and candidate-link docs, `matchProfiles` (concept ids only) and
 * `users.interestCount`.
 */
import {
  getLegalText,
  matchProfileInterests,
  ordinaryHoldingFromDoc,
  PartitionMismatchError,
  sensitiveHoldingFromDoc,
  sensitiveInterestDocSchema,
  interestDocSchema,
  LEXICON_RULES_VERSION,
  type Art9Category,
  type CallableInput,
  type CallableOutput,
  type InterestDoc,
  type Locale,
  type OrdinaryHolding,
  type Partition,
  type SensitiveHolding,
  type SensitiveInterestDoc,
  type SensitivitySource,
} from '@grouper/core';
import { FieldValue, Timestamp, type DocumentReference, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { C128_DIM, CONCEPT_GEN, LIMITS, type ModelConfig } from './config';
import { assertAcceptsInterests } from './lib/account';
import { AppError, NotImplementedError } from './lib/errors';
import { addInto, fromF32Bytes, normalized, toF32Bytes, truncateNormalize } from './lib/vectors';
import { MODERATION_RULES_VERSION } from './moderation';
import { sameTagState, tagStateFromDoc, type TagState } from './tags';

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
      readonly proposeMergeInto?: string;
    };

export interface SensitiveGrant {
  readonly consent: NonNullable<CallableInput<'addInterests'>['items'][number]['consent']>;
  readonly source: SensitivitySource;
  readonly selfFlagged: boolean;
  readonly category?: Art9Category;
  /** Detector-only suspicion: queue the text (no uid) now that someone consented (§5.2 (5)). */
  readonly queueForReview: boolean;
}

export interface PersistItem {
  readonly index: number;
  readonly norm: string;
  readonly display: string;
  readonly tagKey: string;
  readonly interestId: string;
  /** The holding's partition: the partition key everywhere (§5.2 (5)). */
  readonly partition: Partition;
  readonly slot: 'own' | 'private';
  /** What the plan was built on; `exists: false` means "create the tag doc". */
  readonly tag: TagState;
  readonly assignment: Assignment;
  /** "Keep this private" on an existing ordinary holding (§10.2). */
  readonly convert: boolean;
  readonly sensitive: SensitiveGrant | null;
  readonly thirdPartyWarning: boolean;
}

export interface PersistContext {
  readonly db: Firestore;
  readonly model: ModelConfig;
  readonly uid: string;
  readonly now: Date;
}

export interface PersistOutcome {
  readonly results: ReadonlyMap<number, AddInterestResult>;
  /** Final tag states of everything written, for the LRU (persisted tags only). */
  readonly persistedTags: ReadonlyMap<string, TagState>;
}

export class StalePlanError extends Error {
  readonly tagKeys: readonly string[];

  constructor(tagKeys: readonly string[]) {
    super('persist plan is stale');
    this.tagKeys = tagKeys;
    this.name = 'StalePlanError';
  }
}

const WEEK_MS = 7 * 24 * 3600_000;
const ACTIVE_POD_STATES = new Set(['proposed', 'planning', 'scheduled', 'happened']);

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
function assignMethod(a: Exclude<Assignment, { kind: 'existing' }>): 'merge' | 'new' | 'newWithLink' | 'newWithMergeProposal' {
  if (a.kind === 'merge') return 'merge';
  if (a.link) return 'newWithLink';
  return a.proposeMergeInto ? 'newWithMergeProposal' : 'new';
}

function assertPartition(c: ConceptWork, partition: Partition): void {
  if (c.sensitive !== (partition === 'sensitive')) throw new PartitionMismatchError();
}

export async function persist(ctx: PersistContext, items: readonly PersistItem[]): Promise<PersistOutcome> {
  const { db, model, uid } = ctx;
  const dim = model.dim;
  const userRef = db.doc(`users/${uid}`);
  const profileRef = db.doc(`matchProfiles/${uid}`);
  const interestsCol = db.collection(`users/${uid}/interests`);
  const sensitiveCol = db.collection(`users/${uid}/sensitiveInterests`);
  const now = Timestamp.fromDate(ctx.now);
  // Ids generated outside the callback stay stable when Firestore retries the transaction.
  const consentIds = new Map(items.filter((i) => i.sensitive).map((i) => [i.index, db.collection('consentEvents').doc().id]));

  return db.runTransaction(async (tx: Transaction): Promise<PersistOutcome> => {
    // ------------------------------------------------------------ reads
    const [userSnap, profileSnap, ...tagSnaps] = await tx.getAll(userRef, profileRef, ...items.map((i) => db.doc(`tags/${i.tagKey}`)));
    if (!userSnap?.exists || !profileSnap?.exists) throw new AppError('NOT_ONBOARDED');
    // Re-checked here, not only in takeUidCall: deleteAccount can commit while this request is embedding.
    assertAcceptsInterests(userSnap.get('status'));
    const locale: Locale = userSnap.get('locale') === 'da' ? 'da' : 'en';

    const stale: string[] = [];
    const fresh = new Map<string, TagState>();
    items.forEach((item, k) => {
      const snap = tagSnaps[k];
      const state: TagState = snap?.exists ? tagStateFromDoc(snap, dim) : { ...item.tag, exists: false, conceptId: null, privateConceptId: null };
      if (!sameTagState(item.tag, state)) stale.push(item.tagKey);
      fresh.set(item.tagKey, state);
    });
    if (stale.length > 0) throw new StalePlanError(stale);

    const [ordinarySnap, sensitiveSnap] = await Promise.all([tx.get(interestsCol), tx.get(sensitiveCol)]);
    const ordinaryDocs = new Map<string, InterestDoc>();
    for (const d of ordinarySnap.docs) ordinaryDocs.set(d.id, interestDocSchema.parse(d.data()));
    const sensitiveDocs = new Map<string, SensitiveInterestDoc>();
    for (const d of sensitiveSnap.docs) sensitiveDocs.set(d.id, sensitiveInterestDocSchema.parse(d.data()));

    let recentSensitiveGrants = 0;
    if (items.some((i) => i.sensitive)) {
      const events = await tx.get(db.collection('consentEvents').where('uid', '==', uid));
      const since = ctx.now.getTime() - WEEK_MS;
      recentSensitiveGrants = events.docs.filter(
        (e) => e.get('scope') === 'art9' && e.get('action') === 'grant' && (e.get('createdAt') as Timestamp).toMillis() >= since,
      ).length;
    }
    if (items.some((i) => i.convert)) {
      const pods = await tx.get(db.collection('pods').where('memberUids', 'array-contains', uid));
      if (pods.docs.some((p) => ACTIVE_POD_STATES.has(String(p.get('state'))))) {
        // TODO(M1): recompute podInterests of the user's active pods in this transaction (§10.2).
        throw new NotImplementedError('"Keep this private" while in an active pod', '§10.2');
      }
    }

    const conceptIds = new Set<string>();
    const linkIds = new Map<number, string>();
    const reviewIds = new Map<number, string>();
    for (const item of items) {
      conceptIds.add(item.assignment.conceptId);
      if (item.convert) {
        const own = fresh.get(item.tagKey)?.conceptId;
        if (own) conceptIds.add(own);
      }
      const a = item.assignment;
      if (a.kind === 'new' && a.link) linkIds.set(item.index, [a.conceptId, a.link.conceptId].sort().join('__'));
      if (a.kind === 'new' && a.proposeMergeInto) reviewIds.set(item.index, `conceptMerge_${a.conceptId}__${a.proposeMergeInto}`);
      else if (item.sensitive?.queueForReview) reviewIds.set(item.index, `tagSensitivity_${item.tagKey}`);
    }
    const conceptList = [...conceptIds];
    const extraRefs = [
      ...conceptList.map((id) => db.doc(`concepts/${id}`)),
      ...[...linkIds.values()].map((id) => db.doc(`conceptLinks/${id}`)),
      ...[...reviewIds.values()].map((id) => db.doc(`reviewQueue/${id}`)),
    ];
    const extraSnaps = extraRefs.length > 0 ? await tx.getAll(...extraRefs) : [];
    const concepts = new Map<string, ConceptWork | null>();
    conceptList.forEach((id, k) => concepts.set(id, loadConcept(extraSnaps[k]!, dim)));
    const existingDocs = new Set(extraSnaps.slice(conceptList.length).filter((s) => s.exists).map((s) => s.ref.path));

    // ------------------------------------------------------------ decide, in item order
    const results = new Map<number, AddInterestResult>();
    const persistedTags = new Map<string, TagState>();
    let holdingCount = ordinaryDocs.size + sensitiveDocs.size;
    const tagWrites: { ref: DocumentReference; create: boolean; data: Record<string, unknown> }[] = [];
    const otherWrites: ((t: Transaction) => void)[] = [];

    for (const [k, item] of items.entries()) {
      const tag = fresh.get(item.tagKey)!;
      if (sensitiveDocs.has(item.interestId) || (!item.convert && ordinaryDocs.has(item.interestId))) {
        results.set(item.index, { status: 'duplicate', interestId: item.interestId });
        continue;
      }
      if (item.convert && !ordinaryDocs.has(item.interestId)) throw new StalePlanError([item.tagKey]);
      if (!item.convert && holdingCount >= LIMITS.maxInterests) {
        results.set(item.index, { status: 'limit', reasonCode: 'INTEREST_LIMIT' });
        continue;
      }
      if (item.sensitive && recentSensitiveGrants >= LIMITS.sensitiveAddsPer7Days) {
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
          // Deterministic id (newConceptId: keyed hash of tagKey (+ `_p`)): racing creators of one text meet here.
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
      assertPartition(concept, item.partition);
      if (joins) {
        addInto(concept.sum, tag.vec, 1);
        concept.n += 1;
        concept.dirty = true;
      }

      // Tag doc: create, or move one count into the slot.
      const tagRef = db.doc(`tags/${item.tagKey}`);
      const langHints = { da: 0, en: 0 };
      let next: TagState;
      if (!tag.exists) {
        if (item.partition === 'ordinary') langHints[locale] += 1;
        // A new tag has no slot yet, so its assignment is never 'existing'.
        if (a.kind === 'existing') throw new StalePlanError([item.tagKey]);
        tagWrites.push({
          ref: tagRef,
          create: true,
          data: {
            norm: item.norm,
            vec: FieldValue.vector(Array.from(tag.vec)),
            modelId: model.modelId,
            sens: {
              suspected: tag.sens.suspected,
              margin: tag.sens.margin,
              lexiconHit: tag.sens.lexiconHit,
              categoryGuess: tag.sens.categoryGuess,
              rulesVersion: LEXICON_RULES_VERSION,
            },
            moderation: { status: 'ok', rulesVersion: MODERATION_RULES_VERSION },
            conceptId: item.slot === 'own' ? a.conceptId : null,
            // For a text first added privately this records the private assignment; `conceptId` stays null.
            assign: { cos: a.cos, method: assignMethod(a) },
            ...(item.slot === 'private' ? { privateAssign: { conceptId: a.conceptId, refCount: 1 } } : {}),
            aliasVotes: {},
            refCount: item.slot === 'own' ? 1 : 0,
            langHints,
            createdAt: now,
          },
        });
        next = { ...tag, exists: true, conceptId: item.slot === 'own' ? a.conceptId : null, privateConceptId: item.slot === 'private' ? a.conceptId : null };
      } else {
        const snap = tagSnaps[k]!;
        const data: Record<string, unknown> = {};
        let ownCount = snap.get('refCount') as number;
        if (item.slot === 'own') {
          data.refCount = ownCount + 1;
          if (tag.conceptId === null) {
            data.conceptId = a.conceptId;
            if (a.kind !== 'existing') data.assign = { cos: a.cos, method: assignMethod(a) };
          }
          if (item.partition === 'ordinary') data[`langHints.${locale}`] = FieldValue.increment(1);
        } else {
          const priv = (snap.get('privateAssign') as { refCount?: number } | undefined)?.refCount ?? 0;
          data.privateAssign = { conceptId: a.conceptId, refCount: priv + 1 };
        }
        let ownConceptId = item.slot === 'own' ? a.conceptId : tag.conceptId;
        if (item.convert) {
          // The ordinary holding's count moves to the private slot (§10.2).
          if (item.slot !== 'private') throw new PartitionMismatchError();
          ownCount -= 1;
          data.refCount = ownCount;
          const own = tag.conceptId ? concepts.get(tag.conceptId) : null;
          if (ownCount === 0 && own) {
            // The text leaves the ordinary concept: its vector leaves the sum (an emptied concept is deleted).
            addInto(own.sum, tag.vec, -1);
            own.n -= 1;
            own.dirty = true;
            data.conceptId = null;
            ownConceptId = null;
          }
        }
        tagWrites.push({ ref: tagRef, create: false, data });
        next = { ...tag, conceptId: ownConceptId, privateConceptId: item.slot === 'private' ? a.conceptId : tag.privateConceptId };
      }
      persistedTags.set(item.tagKey, next);

      // Holding (and its consent event).
      if (item.sensitive) {
        const g = item.sensitive;
        const consentEventId = consentIds.get(item.index)!;
        const text = getLegalText(g.consent.textVersion);
        if (!text) throw new AppError('VALIDATION');
        const prior = item.convert ? ordinaryDocs.get(item.interestId) : undefined;
        const doc: SensitiveInterestDoc = {
          display: prior?.display ?? item.display,
          norm: item.norm,
          conceptId: a.conceptId,
          selfFlagged: g.selfFlagged,
          ...(g.category ? { categoryConfirmed: g.category } : {}),
          source: g.source,
          consentEventId,
          consentTextVersion: g.consent.textVersion,
          consentedAt: now,
          starred: prior?.starred ?? false,
        };
        sensitiveDocs.set(item.interestId, doc);
        if (item.convert) {
          ordinaryDocs.delete(item.interestId);
          otherWrites.push((t) => t.delete(interestsCol.doc(item.interestId)));
        }
        otherWrites.push((t) => t.create(sensitiveCol.doc(item.interestId), doc));
        otherWrites.push((t) =>
          t.create(db.doc(`consentEvents/${consentEventId}`), {
            uid,
            scope: 'art9',
            interestId: item.interestId,
            ...(g.category ? { category: g.category } : {}),
            action: 'grant',
            textVersion: g.consent.textVersion,
            textSha256: g.consent.textSha256,
            locale: text.locale,
            appVersion: g.consent.appVersion,
            method: 'checkbox+button',
            createdAt: now,
          }),
        );
        recentSensitiveGrants += 1;
      } else {
        const doc: InterestDoc = { display: item.display, norm: item.norm, conceptId: a.conceptId, starred: false, state: 'active', createdAt: now };
        ordinaryDocs.set(item.interestId, doc);
        otherWrites.push((t) => t.create(interestsCol.doc(item.interestId), doc));
      }
      if (!item.convert) holdingCount += 1;

      const linkId = linkIds.get(item.index);
      if (linkId && a.kind === 'new' && a.link && !existingDocs.has(`conceptLinks/${linkId}`)) {
        const cos = a.link.cos;
        otherWrites.push((t) => t.create(db.doc(`conceptLinks/${linkId}`), { cos, status: 'candidate', votes: 0 }));
        existingDocs.add(`conceptLinks/${linkId}`);
      }
      const reviewId = reviewIds.get(item.index);
      if (reviewId && !existingDocs.has(`reviewQueue/${reviewId}`)) {
        // Tag kinds carry the normalized text and never a uid (§8.2 reviewQueue).
        const review =
          a.kind === 'new' && a.proposeMergeInto
            ? { kind: 'conceptMerge', ref: `${a.conceptId}__${a.proposeMergeInto}`, text: item.norm, status: 'open' }
            : { kind: 'tagSensitivity', ref: item.tagKey, text: item.norm, status: 'open' };
        otherWrites.push((t) => t.create(db.doc(`reviewQueue/${reviewId}`), review));
        existingDocs.add(`reviewQueue/${reviewId}`);
      }

      const suggestion = suggestionLabel(a, locale);
      results.set(item.index, {
        status: item.convert ? 'madePrivate' : 'added',
        interestId: item.interestId,
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

    if (persistedTags.size > 0) {
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
    return { results, persistedTags };
  });
}
