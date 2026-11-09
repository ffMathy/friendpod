/**
 * Day-1 funnel counters (DESIGN.md §6.8, PRIVACY.md P18): `funnel/{areaId}_{weekId}` holds uid-free counts per stage
 * (and the "where did you hear" sources). A stage counts a user once: the milestone on the user's server-only
 * `matchProfiles/{uid}.milestones` is set in the same transaction as the increment, and only when it was absent.
 * Exact counts are stored; the admin CLI suppresses cells under 10 when it prints them.
 */
import {
  FUNNEL_MILESTONE_FIELD,
  FUNNEL_NO_AREA,
  funnelDocId,
  funnelExpiresAtMs,
  funnelWeekId,
  meetupMilestone,
  newMilestones,
  type FunnelStage,
  type HeardFromSource,
  type Milestones,
} from '@friendpod/core';
import { FieldValue, type Firestore, type Transaction, type WriteBatch } from 'firebase-admin/firestore';
import { docs, ts } from './firestore';
import type { AppDeps } from './runtime';

export const FUNNEL_COLLECTION = 'funnel';

interface Row {
  readonly areaId: string | null;
  readonly weekId: ReturnType<typeof funnelWeekId>;
  readonly counts: Map<FunnelStage, number>;
  readonly sources: Map<HeardFromSource, number>;
}

/** Collects increments per funnel doc, then writes each doc once inside the caller's transaction or batch. */
export class FunnelIncrements {
  private readonly rows = new Map<string, Row>();

  private row(areaId: string | null, atMs: number): Row {
    const weekId = funnelWeekId(atMs);
    const id = funnelDocId(areaId, weekId);
    let row = this.rows.get(id);
    if (!row) this.rows.set(id, (row = { areaId, weekId, counts: new Map(), sources: new Map() }));
    return row;
  }

  stage(areaId: string | null, atMs: number, stage: FunnelStage, n = 1): this {
    const row = this.row(areaId, atMs);
    row.counts.set(stage, (row.counts.get(stage) ?? 0) + n);
    return this;
  }

  source(areaId: string | null, atMs: number, source: HeardFromSource): this {
    const row = this.row(areaId, atMs);
    row.sources.set(source, (row.sources.get(source) ?? 0) + 1);
    return this;
  }

  get isEmpty(): boolean {
    return this.rows.size === 0;
  }

  /** `set(..., {merge: true})` with increments: creates the doc on first use, never reads it. */
  write(db: Firestore, writer: Transaction | WriteBatch): void {
    for (const [id, row] of this.rows) {
      const counts = Object.fromEntries([...row.counts].map(([s, n]) => [s, FieldValue.increment(n)]));
      const sources = Object.fromEntries([...row.sources].map(([s, n]) => [s, FieldValue.increment(n)]));
      const data = {
        areaId: row.areaId ?? FUNNEL_NO_AREA,
        weekId: row.weekId,
        expiresAt: ts(funnelExpiresAtMs(row.weekId)),
        ...(row.counts.size > 0 ? { counts } : {}),
        ...(row.sources.size > 0 ? { sources } : {}),
      };
      // Transaction and WriteBatch share this overload; the union is not callable as one in TypeScript.
      (writer as WriteBatch).set(db.collection(FUNNEL_COLLECTION).doc(id), data, { merge: true });
    }
  }
}

/** Marks the stages not reached yet; returns the new milestones and the stages that now count. */
export function claimMilestones(current: Milestones, stages: readonly FunnelStage[], atMs: number): { milestones: Milestones; fresh: FunnelStage[] } {
  const fresh = newMilestones(current, stages);
  const milestones: Milestones = { ...current };
  for (const s of fresh) milestones[FUNNEL_MILESTONE_FIELD[s]] = ts(atMs);
  return { milestones, fresh };
}

/** A user event that may reach a funnel stage; `meetupHappened` resolves to the first or second meetup. */
export type FunnelEvent = FunnelStage | 'meetupHappened';

/**
 * For events outside an existing transaction (release, backfill, confirmation, the sweeper): one transaction on
 * `matchProfiles/{uid}` sets the milestones and increments the user's current area row. Returns the stages counted;
 * nothing when the user has no profile (erased) or already reached them.
 */
export async function recordMilestones(deps: Pick<AppDeps, 'db'>, uid: string, events: readonly FunnelEvent[], atMs: number): Promise<FunnelStage[]> {
  const ref = docs(deps.db).matchProfile(uid);
  return deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const profile = snap.data();
    if (!profile) return [];
    const stages = events.flatMap((e) => (e === 'meetupHappened' ? [meetupMilestone(profile.milestones)].filter((s): s is FunnelStage => s !== null) : [e]));
    const { milestones, fresh } = claimMilestones(profile.milestones, stages, atMs);
    if (fresh.length === 0) return [];
    const inc = new FunnelIncrements();
    for (const s of fresh) inc.stage(profile.areaId, atMs, s);
    tx.update(ref.withConverter(null), { milestones });
    inc.write(deps.db, tx);
    return fresh;
  });
}
