/** Test wiring: the real pipeline and Firestore code with the StubEmbedder in place of the model. */
import { nodeHmacSha256 } from '@grouper/core/node';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/https';
import { FirestoreConceptIndex } from '../../src/assign';
import type { CallableDeps } from '../../src/callable';
import { LIMITS, LRU_CAPACITY, MODEL, C128_DIM } from '../../src/config';
import { computePrototypes, PROTOTYPE_LISTS } from '../../src/detect';
import { chargeEmbedBudget, FeatureFlags, MemoryWindow, takeUidCall } from '../../src/lib/limits';
import { LruCache } from '../../src/lib/lru';
import { Metrics, type MetricEntry } from '../../src/lib/metrics';
import { toF32Bytes, truncateNormalize } from '../../src/lib/vectors';
import { StubEmbedder, type StubLink } from '../../src/model';
import type { TagState } from '../../src/tags';

export const HMAC_KEY = new Uint8Array(32).fill(7);
export const hmac = nodeHmacSha256(HMAC_KEY);
export const NOW = new Date('2026-11-04T12:00:00Z');

/**
 * Where each test text sits. Ordinary texts lean on a hobby anchor so the detector margin is clearly
 * negative; sensitive ones lean on an Art. 9 prototype or hit the lexicon. Cosines to concepts are exact.
 */
export const LINKS: Readonly<Record<string, StubLink>> = {
  cooking: { to: 'food and drink', cos: 0.9 },
  madlavning: { to: 'cooking', cos: 0.95 },
  'hjemmelavet mad': { to: 'cooking', cos: 0.915 },
  'board games': { to: 'games', cos: 0.9 },
  yoga: { to: 'exercise', cos: 0.9 },
  graviditetsyoga: { to: 'yoga', cos: 0.97 },
  kirkegænger: { to: 'music', cos: 0.9 },
  kirkekor: { to: 'kirkegænger', cos: 0.97 },
  'min datters fodbold': { to: 'sports', cos: 0.9 },
  'ønsker os et barn': { to: 'pregnancy and expecting a baby', cos: 0.95 },
  'gravid i uge 20': { to: 'gravid', cos: 0.96 },
  'gravid med tvillinger': { to: 'gravid', cos: 0.94 },
  løb: { to: 'sports', cos: 0.9 },
};

export interface Harness {
  readonly deps: CallableDeps;
  readonly stub: StubEmbedder;
  readonly metrics: Metrics;
  readonly entries: MetricEntry[];
  readonly lru: LruCache<string, TagState>;
  runtimeLoads: number;
}

/** `art9: false` is the production setting until withdrawal exists (ART9_HOLDINGS_ENABLED); most tests cover the sensitive path. */
export async function harness(db: Firestore, opts: { budget?: boolean; art9?: boolean } = {}): Promise<Harness> {
  const stub = new StubEmbedder(MODEL.modelId, MODEL.dim, LINKS);
  const prototypes = await computePrototypes(stub, MODEL, PROTOTYPE_LISTS);
  stub.calls.length = 0;
  const entries: MetricEntry[] = [];
  const metrics = new Metrics((e) => entries.push(e));
  const lru = new LruCache<string, TagState>(LRU_CAPACITY);
  const flags = new FeatureFlags(db, 0);
  const h: Harness = {
    stub,
    metrics,
    entries,
    lru,
    runtimeLoads: 0,
    deps: {
      db,
      model: MODEL,
      runtime: async () => {
        h.runtimeLoads += 1;
        await stub.warm();
        return { embedder: stub, prototypes };
      },
      conceptIndex: new FirestoreConceptIndex(db, MODEL.dim),
      lru,
      hmac,
      metrics,
      chargeEmbedBudget: opts.budget === false ? async () => false : (n, at) => chargeEmbedBudget(db, n, at, LIMITS.embedMissesPerDay),
      art9Holdings: opts.art9 ?? true,
      embedderEnabled: (nowMs) => flags.embedderEnabled(nowMs),
      takeUidCall: (uid, at) => takeUidCall(db, uid, at, LIMITS),
      uidWindow: new MemoryWindow(LIMITS.callsPerHour, 3600_000),
      ipWindow: new MemoryWindow(LIMITS.callsPerIpPerHour, 3600_000),
      clock: () => NOW,
    },
  };
  return h;
}

export async function seedUser(db: Firestore, uid: string, opts: { locale?: 'da' | 'en'; createdAt?: Date } = {}): Promise<void> {
  const createdAt = Timestamp.fromDate(opts.createdAt ?? new Date('2026-06-01T00:00:00Z'));
  await db.doc(`users/${uid}`).set({ firstName: 'Testa', locale: opts.locale ?? 'da', interestCount: 0, status: 'active', createdAt });
  await db.doc(`matchProfiles/${uid}`).set({ status: 'active', themes: [], themeIds: [], secondary: [], createdAt, updatedAt: createdAt });
}

/** A concept whose centroid and medoid are exactly the stub vector of `text`. */
export async function seedConcept(
  db: Firestore,
  stub: StubEmbedder,
  id: string,
  text: string,
  opts: { sensitive: boolean; labels?: { da?: string; en?: string }; holderCount?: number },
): Promise<Float32Array> {
  const vec = stub.vector(text);
  const now = Timestamp.fromDate(NOW);
  await db.doc(`concepts/${id}`).set({
    centroid: FieldValue.vector(Array.from(vec)),
    medoid: FieldValue.vector(Array.from(vec)),
    sum: toF32Bytes(vec),
    c128: toF32Bytes(truncateNormalize(vec, C128_DIM)),
    n: 1,
    sensitive: opts.sensitive,
    labels: opts.labels ?? {},
    holderCount: opts.holderCount ?? 0,
    status: 'active',
    gen: 0,
    seed: true,
    createdAt: now,
    updatedAt: now,
  });
  return vec;
}

export function callRequest(uid: string | null, data: unknown, opts: { onb?: boolean; ip?: string; appCheck?: boolean } = {}): CallableRequest<unknown> {
  return {
    data,
    auth: uid ? { uid, token: { onb: opts.onb ?? true }, rawToken: 'test-token' } : undefined,
    app: opts.appCheck === false ? undefined : { appId: 'test-app', token: {} },
    rawRequest: { ip: opts.ip ?? '203.0.113.7', headers: {} },
    acceptsStreaming: false,
  } as unknown as CallableRequest<unknown>;
}
