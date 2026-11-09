/**
 * matchComponent task body (DESIGN.md §6.5, §10.3). Reads the frozen input snapshot (never live Firestore), runs
 * the pure matcher, writes the whole result to one object and then flips the component's `computed` pointer
 * create-if-absent. A retry that finds the pointer stops; a partial attempt leaves at most an unreferenced object.
 * On a constraint-assertion failure it writes nothing and logs an alert (fail closed).
 */
import { gunzipSync } from 'node:zlib';
import {
  MatchConstraintError,
  SENSITIVE_UNMATCHED_REASONS,
  decodeMatchSnapshot,
  matchComponent,
  matchResultFile,
  suppressSmallCount,
  utf8Encode,
  type MatchResult,
  type UnmatchedReason,
  type WeekId,
} from '@friendpod/core';
import { sha256Hex } from '@friendpod/core/node';
import type { Firestore } from 'firebase-admin/firestore';
import { docs, type DocOf } from '../lib/firestore';
import type { Log, LogFields } from '../lib/log';
import type { ObjectStore } from '../lib/storage';

export type DropComponent = DocOf<'dropComponent'>;
export type ComputedPointer = NonNullable<DropComponent['computed']>;
export type DropStats = NonNullable<DropComponent['stats']>;

/** The component document operations the task needs, so it can run against fakes. */
export interface ComponentStore {
  get(weekId: WeekId, componentId: string): Promise<DropComponent | null>;
  /** Sets `computed` only if absent; false when another attempt already set it. */
  setComputedIfAbsent(weekId: WeekId, componentId: string, pointer: ComputedPointer, stats: DropStats): Promise<boolean>;
}

export interface MatchTaskDeps {
  readonly components: ComponentStore;
  /** The `friendpod-<env>-drops` bucket. */
  readonly drops: ObjectStore;
  now(): number;
  readonly log: Log;
}

export type MatchTaskOutcome = 'computed' | 'alreadyComputed' | 'assertionFailed';

export function resultPath(weekId: WeekId, componentId: string, inputHash: string): string {
  return `${weekId}/${componentId}.result.${inputHash}.json`;
}

const isGzip = (b: Uint8Array): boolean => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

/**
 * Counts for `drops` (§6.8), each under 10 stored as "<10" (§6.6). Counts about sensitive themes are left out
 * (PRIVACY.md §4.3 "Aggregates"): no sensitive-pod count, and the sensitive unmatched reasons are folded into
 * NO_FIT_THIS_WEEK rather than dropped, so they cannot be recovered as users − matched − the other buckets.
 * The matcher's consent-integrity counters go to the log as an alert instead.
 */
export function dropStats(stats: MatchResult['stats'], runtimeMs: number): DropStats {
  const out: Record<string, number | '<10'> = {
    users: suppressSmallCount(stats.users),
    eligible: suppressSmallCount(stats.eligible),
    matched: suppressSmallCount(stats.matched),
    pods: suppressSmallCount(stats.pods),
    openToAnyonePods: suppressSmallCount(stats.openToAnyonePods),
    movesEvaluated: stats.movesEvaluated,
    runtimeMs,
  };
  for (const [size, n] of Object.entries(stats.podsBySize)) out[`podsBySize_${size}`] = suppressSmallCount(n);
  const unmatched = new Map<UnmatchedReason, number>();
  for (const [reason, n] of Object.entries(stats.unmatchedByReason) as [UnmatchedReason, number | undefined][]) {
    const bucket: UnmatchedReason = SENSITIVE_UNMATCHED_REASONS.includes(reason) ? 'NO_FIT_THIS_WEEK' : reason;
    unmatched.set(bucket, (unmatched.get(bucket) ?? 0) + (n ?? 0));
  }
  for (const [reason, n] of unmatched) out[`unmatched_${reason}`] = suppressSmallCount(n);
  return out;
}

export async function runMatchComponentTask(
  deps: MatchTaskDeps,
  task: { readonly weekId: WeekId; readonly componentId: string },
): Promise<{ outcome: MatchTaskOutcome; fields: LogFields }> {
  const { weekId, componentId } = task;
  const component = await deps.components.get(weekId, componentId);
  // The orchestrator writes the component doc before enqueueing; a missing doc is retried, then fails.
  if (!component) throw new Error('drop component not found');
  if (component.computed) return { outcome: 'alreadyComputed', fields: {} };

  const file = await deps.drops.read(component.inputPath);
  if (sha256Hex(file) !== component.inputHash) throw new Error('input snapshot does not match inputHash');
  const decoded = decodeMatchSnapshot(JSON.parse(new TextDecoder().decode(isGzip(file) ? gunzipSync(file) : file)));
  if (decoded.componentId !== componentId || decoded.input.weekId !== weekId) throw new Error('input snapshot is for another component');

  const started = deps.now();
  let result: MatchResult;
  try {
    result = matchComponent(decoded.input);
  } catch (err) {
    if (!(err instanceof MatchConstraintError)) throw err;
    deps.log.error('match.assertionFailed', { weekId, componentId, constraint: err.constraint, podIndex: err.podIndex });
    return { outcome: 'assertionFailed', fields: { constraint: err.constraint } };
  }
  const runtimeMs = deps.now() - started;

  const dropped = result.stats.droppedThemes;
  const droppedTotal = decoded.droppedNoConsent + dropped.noConsent + dropped.partition + dropped.unknownConcept;
  if (droppedTotal > 0) deps.log.warn('match.droppedThemes', { weekId, componentId, snapshotNoConsent: decoded.droppedNoConsent, ...dropped });

  const path = resultPath(weekId, componentId, component.inputHash);
  const body = matchResultFile(result, { weekId, componentId, inputHash: component.inputHash });
  await deps.drops.write(path, utf8Encode(JSON.stringify(body)), 'application/json');
  const flipped = await deps.components.setComputedIfAbsent(weekId, componentId, { inputHash: component.inputHash, path }, dropStats(result.stats, runtimeMs));
  return {
    outcome: flipped ? 'computed' : 'alreadyComputed',
    fields: { users: result.stats.users, pods: result.stats.pods, movesEvaluated: result.stats.movesEvaluated, runtimeMs },
  };
}

export function firestoreComponentStore(db: Firestore): ComponentStore {
  const ref = (weekId: WeekId, componentId: string) => docs(db).dropComponent(weekId, componentId);
  return {
    async get(weekId, componentId) {
      return (await ref(weekId, componentId).get()).data() ?? null;
    },
    setComputedIfAbsent(weekId, componentId, pointer, stats) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref(weekId, componentId));
        const current = snap.data();
        if (!current) throw new Error('drop component not found');
        if (current.computed) return false;
        tx.set(snap.ref, { ...current, status: 'computed', computed: pointer, stats });
        return true;
      });
    },
  };
}
