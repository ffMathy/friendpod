/**
 * Abuse ceilings for the embedder (DESIGN.md §9 Rate limits, §4.3): an in-memory pre-check per instance,
 * the per-uid window in `rateLimits`, and the global daily budget of embed misses.
 * The windows are fixed (not sliding) buckets: simpler, and at most 2× the limit across a boundary.
 */
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { assertAcceptsInterests } from './account';
import { AppError } from './errors';

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/** Per-instance fixed windows keyed by uid or IP. Never stored or logged. */
export class MemoryWindow {
  readonly #windows = new Map<string, { start: number; count: number }>();
  readonly limit: number;
  readonly windowMs: number;
  readonly maxKeys: number;

  constructor(limit: number, windowMs: number, maxKeys = 50_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  take(key: string, nowMs: number): boolean {
    let w = this.#windows.get(key);
    if (!w || nowMs - w.start >= this.windowMs) {
      w = { start: nowMs, count: 0 };
      this.#windows.delete(key);
      this.#windows.set(key, w);
      if (this.#windows.size > this.maxKeys) {
        const oldest = this.#windows.keys().next();
        if (!oldest.done) this.#windows.delete(oldest.value);
      }
    }
    if (w.count >= this.limit) return false;
    w.count += 1;
    return true;
  }
}

/**
 * The key of the per-IP window: the address Google's front end appended, i.e. the right-most X-Forwarded-For
 * entry (callables are called on their own URL, with no load balancer or Hosting rewrite adding a hop). `request.ip` is the left-most entry (functions-framework enables Express's `trust proxy`), which the
 * client writes itself, so a script could get a fresh window per request. Without the header (the emulator,
 * tests) it is the socket address. Kept in memory only (§9).
 */
export function clientIp(raw: { readonly ip?: string; readonly headers: Readonly<Record<string, string | string[] | undefined>> } | undefined): string | undefined {
  const header = raw?.headers['x-forwarded-for'];
  const hops = (Array.isArray(header) ? header.join(',') : (header ?? '')).split(',').map((h) => h.trim()).filter((h) => h.length > 0);
  return hops.at(-1) ?? raw?.ip;
}

interface WindowDoc {
  readonly count: number;
  readonly windowStart: Timestamp;
}

function windowState(doc: WindowDoc | undefined, nowMs: number, windowMs: number): { count: number; startMs: number } {
  if (!doc || nowMs - doc.windowStart.toMillis() >= windowMs) return { count: 0, startMs: nowMs };
  return { count: doc.count, startMs: doc.windowStart.toMillis() };
}

/**
 * Charges one addInterests call to `rateLimits/{uid}_addInterests` (warm-ups included). Accounts younger
 * than `newAccountMs` (from `users/{uid}.createdAt`) get half the allowance; an account that is not active or
 * paused is refused with STATE.
 */
export async function takeUidCall(
  db: Firestore,
  uid: string,
  now: Date,
  limits: { readonly callsPerHour: number; readonly newAccountMs: number },
): Promise<boolean> {
  const userRef = db.doc(`users/${uid}`);
  const ref = db.doc(`rateLimits/${uid}_addInterests`);
  return db.runTransaction(async (tx) => {
    const [user, bucket] = await tx.getAll(userRef, ref);
    const createdAt = user?.get('createdAt') as Timestamp | undefined;
    if (!user?.exists || !createdAt) throw new AppError('NOT_ONBOARDED');
    // Before the window doc (its id carries the uid) is written, and before any warm-up or model load.
    assertAcceptsInterests(user.get('status'));
    const nowMs = now.getTime();
    const limit = nowMs - createdAt.toMillis() < limits.newAccountMs ? Math.floor(limits.callsPerHour / 2) : limits.callsPerHour;
    const w = windowState(bucket?.data() as WindowDoc | undefined, nowMs, HOUR_MS);
    if (w.count >= limit) return false;
    tx.set(ref, {
      count: w.count + 1,
      windowStart: Timestamp.fromMillis(w.startMs),
      expiresAt: Timestamp.fromMillis(w.startMs + DAY_MS),
    });
    return true;
  });
}

/**
 * Charges `misses` cache misses to `rateLimits/global_embedMiss_{day}` (uid-free). Returns false, and
 * charges nothing, when the day's budget would be exceeded: new texts then get EMBED_BUDGET.
 */
export async function chargeEmbedBudget(db: Firestore, misses: number, now: Date, perDay: number): Promise<boolean> {
  if (misses === 0) return true;
  const day = now.toISOString().slice(0, 10);
  const ref = db.doc(`rateLimits/global_embedMiss_${day}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.get('count') as number) : 0;
    if (count + misses > perDay) return false;
    const start = Date.parse(`${day}T00:00:00Z`);
    tx.set(ref, { count: count + misses, windowStart: Timestamp.fromMillis(start), expiresAt: Timestamp.fromMillis(start + 2 * DAY_MS) });
    return true;
  });
}

/**
 * Kill switch `config/app.features.embedder` (§9), cached per instance. A missing document or flag means
 * enabled: the switch is a cost brake set by `onBudgetAlert`, not a privacy control.
 */
export class FeatureFlags {
  #cached: { readonly atMs: number; readonly embedder: boolean } | null = null;
  readonly #db: Firestore;
  readonly #ttlMs: number;

  constructor(db: Firestore, ttlMs: number) {
    this.#db = db;
    this.#ttlMs = ttlMs;
  }

  async embedderEnabled(nowMs: number): Promise<boolean> {
    if (this.#cached && nowMs - this.#cached.atMs < this.#ttlMs) return this.#cached.embedder;
    const snap = await this.#db.doc('config/app').get();
    const embedder = snap.get('features.embedder') !== false;
    this.#cached = { atMs: nowMs, embedder };
    return embedder;
  }
}
