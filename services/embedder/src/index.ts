/**
 * Functions codebase "embedder" (DESIGN.md §7, §10.2): exactly two functions, `addInterests` and
 * `embedderBatch`. In 2nd gen each is its own Cloud Run service, so there is no separate warm-up function;
 * the app warms the service that embeds with `addInterests({items: []})`.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { nodeHmacSha256 } from '@grouper/core/node';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/https';
import { setGlobalOptions } from 'firebase-functions/options';
import { defineSecret } from 'firebase-functions/params';
import { onTaskDispatched } from 'firebase-functions/tasks';
import { FirestoreConceptIndex } from './assign';
import { runEmbedderBatch } from './batch';
import { createAddInterestsHandler, type CallableDeps } from './callable';
import { ART9_HOLDINGS_ENABLED, FEATURE_FLAGS_TTL_MS, LIMITS, LRU_CAPACITY, METRICS_FLUSH_MS, MODEL, SERVICE } from './config';
import { decodePrototypes, PROTOTYPE_LISTS } from './detect';
import { scrubbedTask } from './lib/handler';
import { chargeEmbedBudget, FeatureFlags, MemoryWindow, takeUidCall } from './lib/limits';
import { LruCache } from './lib/lru';
import { Metrics } from './lib/metrics';
import { TransformersEmbedder } from './model';
import type { EmbedRuntime } from './pipeline';
import type { TagState } from './tags';

setGlobalOptions({
  region: SERVICE.region,
  serviceAccount: SERVICE.serviceAccount,
  memory: SERVICE.memory,
  cpu: SERVICE.cpu,
  concurrency: SERVICE.concurrency,
  minInstances: SERVICE.minInstances,
  maxInstances: SERVICE.maxInstances,
});

/** Shared with the default codebase (uidH, interestId): base64 of at least 32 random bytes. */
const UID_HMAC_KEY = defineSecret('UID_HMAC_KEY');

const metrics = new Metrics();
const HOUR_MS = 3600_000;

/** Files deployed next to the bundle: dist/index.js, dist/prototypes.bin, model/<repo>/… */
const PROTOTYPES_BIN = new URL('./prototypes.bin', import.meta.url);
const MODEL_DIR = fileURLToPath(new URL('../model/', import.meta.url));

let deps: CallableDeps | null = null;

/** Built on the first call, inside the scrubbing wrapper, so even a missing secret is logged without data. */
function productionDeps(): CallableDeps {
  if (deps) return deps;
  initializeApp();
  const db = getFirestore();
  const key = Buffer.from(UID_HMAC_KEY.value().trim(), 'base64');
  const embedder = new TransformersEmbedder(MODEL, {
    modelDir: MODEL_DIR,
    threads: SERVICE.ortThreads,
    onLoaded: (ms) => metrics.observe('modelLoadMs', ms),
  });
  let runtime: Promise<EmbedRuntime> | null = null;
  const flags = new FeatureFlags(db, FEATURE_FLAGS_TTL_MS);
  metrics.start(METRICS_FLUSH_MS);
  deps = {
    db,
    model: MODEL,
    runtime: () =>
      (runtime ??= (async () => {
        // A stale prototypes.bin is refused before the model is loaded at all.
        const prototypes = decodePrototypes(await readFile(PROTOTYPES_BIN), MODEL, PROTOTYPE_LISTS);
        await embedder.warm();
        return { embedder, prototypes };
      })().catch((err: unknown) => {
        runtime = null;
        throw err;
      })),
    conceptIndex: new FirestoreConceptIndex(db, MODEL.dim),
    lru: new LruCache<string, TagState>(LRU_CAPACITY),
    hmac: nodeHmacSha256(key),
    metrics,
    chargeEmbedBudget: (misses, now) => chargeEmbedBudget(db, misses, now, LIMITS.embedMissesPerDay),
    art9Holdings: ART9_HOLDINGS_ENABLED,
    embedderEnabled: (nowMs) => flags.embedderEnabled(nowMs),
    takeUidCall: (uid, now) => takeUidCall(db, uid, now, LIMITS),
    uidWindow: new MemoryWindow(LIMITS.callsPerHour, HOUR_MS),
    ipWindow: new MemoryWindow(LIMITS.callsPerIpPerHour, HOUR_MS),
    clock: () => new Date(),
  };
  return deps;
}

/**
 * Plain App Check, not limited-use tokens: each of those costs a fresh attestation, and the per-uid,
 * per-IP and global limits cover replay here (§9 App Check).
 */
export const addInterests = onCall(
  { enforceAppCheck: true, secrets: [UID_HMAC_KEY], timeoutSeconds: SERVICE.callableTimeoutSeconds },
  createAddInterestsHandler(metrics, productionDeps),
);

/**
 * Task queue for rescans, re-embeds, maintenance and seeding. The dispatch deadline is not a function
 * option: enqueuers set `dispatchDeadlineSeconds: 1800` (the Cloud Tasks default is 10 minutes).
 */
export const embedderBatch = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60 },
    rateLimits: { maxConcurrentDispatches: 1 },
    timeoutSeconds: SERVICE.batchTimeoutSeconds,
  },
  scrubbedTask('embedderBatch', metrics, runEmbedderBatch),
);
