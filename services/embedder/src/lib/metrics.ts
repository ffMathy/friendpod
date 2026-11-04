/**
 * Uid-free, text-free counters per instance (DESIGN.md §5.2 (5), §13). Flushed every 60 s and on SIGTERM
 * as ONE structured `metric` log entry, which the log-based metrics read. Names are a closed set, so no
 * request data can ever become part of a log line through a counter name.
 */
import { logger } from 'firebase-functions/logger';

export const COUNTERS = [
  'calls',
  'warmups',
  'added',
  'madePrivate',
  'needsConsent',
  'flagged',
  'rejected',
  'refusedThirdParty',
  'duplicate',
  'limit',
  'cacheHits',
  'cacheMisses',
  'embedBudgetExceeded',
  'abuseShadowHold',
  'abuseShadowReject',
  'rateLimited',
  'stalePlanRetries',
  'errors',
] as const;
export type Counter = (typeof COUNTERS)[number];

export const TIMERS = ['callMs', 'embedMs', 'modelLoadMs'] as const;
export type Timer = (typeof TIMERS)[number];

/** `kind` plus numbers only: counts and millisecond aggregates. */
export interface MetricEntry {
  readonly kind: 'embedder';
  readonly values: Readonly<Record<string, number>>;
}
export type MetricSink = (entry: MetricEntry) => void;

const logSink: MetricSink = (entry) => logger.info('metric', { kind: entry.kind, ...entry.values });

interface TimerStats {
  n: number;
  sum: number;
  max: number;
}

export class Metrics {
  #counters = new Map<Counter, number>();
  #timers = new Map<Timer, TimerStats>();
  #started = false;
  readonly #sink: MetricSink;

  constructor(sink: MetricSink = logSink) {
    this.#sink = sink;
  }

  inc(name: Counter, n = 1): void {
    if (n <= 0) return;
    this.#counters.set(name, (this.#counters.get(name) ?? 0) + n);
  }

  observe(name: Timer, ms: number): void {
    const t = this.#timers.get(name) ?? { n: 0, sum: 0, max: 0 };
    t.n += 1;
    t.sum += ms;
    t.max = Math.max(t.max, ms);
    this.#timers.set(name, t);
  }

  /** Emits one entry with everything counted since the last flush, or nothing if there is nothing. */
  flush(): void {
    if (this.#counters.size === 0 && this.#timers.size === 0) return;
    const entry: Record<string, number> = {};
    for (const [k, v] of this.#counters) entry[k] = v;
    for (const [k, t] of this.#timers) {
      entry[`${k}_n`] = t.n;
      entry[`${k}_avg`] = Math.round(t.sum / t.n);
      entry[`${k}_max`] = Math.round(t.max);
    }
    this.#counters = new Map();
    this.#timers = new Map();
    this.#sink({ kind: 'embedder', values: entry });
  }

  /** Starts the periodic flush once per instance; the timer never keeps the process alive. */
  start(intervalMs: number): void {
    if (this.#started) return;
    this.#started = true;
    setInterval(() => this.flush(), intervalMs).unref();
    process.once('SIGTERM', () => this.flush());
  }
}
