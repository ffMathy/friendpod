/**
 * `areas/{areaId}.waitlistCount` (DESIGN.md §3.1 step 12, §8.1): the exact number of onboarded accounts whose home cell
 * is in the area. Changed only inside the transaction that onboards a user, moves them to another area, or erases
 * them, so it cannot drift from `matchProfiles.areaId`. Reads come first (Firestore transactions need reads before
 * writes): `readAreas`, then `writeAreaDeltas`.
 */
import { areaDocFromConfig, getLaunchArea, isWaitlisted, type LaunchAreaStatus } from '@grouper/core';
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { docs, PATHS } from './firestore';
import type { AppDeps } from './runtime';

export interface AreaState {
  readonly areaId: string;
  /** The doc's status when it exists (go-live is an admin change), else areas.json. */
  readonly status: LaunchAreaStatus;
  readonly count: number;
  readonly exists: boolean;
}

/** Reads the area docs for these ids (unknown ids are ignored: an area removed from areas.json has no counter). */
export async function readAreas(tx: Transaction, db: Firestore, areaIds: readonly (string | null)[]): Promise<Map<string, AreaState>> {
  const ids = [...new Set(areaIds.filter((id): id is string => id !== null && getLaunchArea(id) !== null))];
  const out = new Map<string, AreaState>();
  if (ids.length === 0) return out;
  const snaps = await tx.getAll(...ids.map((id) => db.doc(PATHS.area(id))));
  snaps.forEach((snap, i) => {
    const id = ids[i]!;
    const data = snap.data() as { status?: LaunchAreaStatus; waitlistCount?: unknown } | undefined;
    const count = typeof data?.waitlistCount === 'number' && Number.isFinite(data.waitlistCount) ? data.waitlistCount : 0;
    out.set(id, { areaId: id, status: data?.status ?? getLaunchArea(id)!.status, count, exists: snap.exists });
  });
  return out;
}

/** Applies +1/−1 per area; never below 0. Creates a missing doc from areas.json (the admin sync may not have run). */
export function writeAreaDeltas(tx: Transaction, db: Firestore, state: ReadonlyMap<string, AreaState>, deltas: ReadonlyMap<string | null, number>): void {
  for (const [areaId, delta] of deltas) {
    if (areaId === null || delta === 0) continue;
    const area = state.get(areaId);
    if (!area) continue;
    const next = Math.max(0, area.count + delta);
    if (area.exists) tx.update(db.doc(PATHS.area(areaId)) as DocumentReference, { waitlistCount: next });
    else tx.create(docs(db).area(areaId), areaDocFromConfig(getLaunchArea(areaId)!, next, area.status));
  }
}

/** The funnel stage an area's status puts a user in: waitlisted, or eligible for the next drop when live. */
export function areaStage(status: LaunchAreaStatus | null): 'waitlisted' | 'firstDropEligible' | null {
  if (status === null) return null;
  return isWaitlisted(status) ? 'waitlisted' : 'firstDropEligible';
}

/**
 * Erasure step (purgeUser, PRIVACY.md §6): deletes `matchProfiles/{uid}` (and with it the funnel milestones) and
 * decrements the area's `waitlistCount` in one transaction. Idempotent: a retry finds no profile and changes nothing.
 * The funnel counters themselves hold no uid and stay.
 */
export async function eraseMatchProfileAndAreaCount(deps: Pick<AppDeps, 'db'>, uid: string): Promise<{ erased: boolean }> {
  const profileRef = deps.db.doc(PATHS.matchProfile(uid));
  return deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) return { erased: false };
    const areaId = (snap.get('areaId') as string | null | undefined) ?? null;
    const state = await readAreas(tx, deps.db, [areaId]);
    writeAreaDeltas(tx, deps.db, state, new Map([[areaId, -1]]));
    tx.delete(profileRef);
    return { erased: true };
  });
}
