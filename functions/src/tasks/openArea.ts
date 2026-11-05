/**
 * openArea (DESIGN.md §3.1 step 12, §6.4, §10.3): after the admin CLI flips `areas/{areaId}.status` to `live`, every
 * user in the area becomes eligible for the next drop. Two passes, each idempotent:
 *   1. eligibility: each active profile is marked `firstDropEligible` once (milestone and funnel counter in one
 *      transaction), together with `openAreaPush` (the push this user is owed). Accounts being deleted are skipped;
 *   2. notification: every profile still owing the push gets "<city> is open — your first drop is Thursday 18:00",
 *      and `openAreaPush` is cleared after the send.
 * So a retried task neither counts anyone twice nor skips the push of a user marked by a run that failed before it
 * notified (a crash between the send and the clear can repeat one push, never lose one).
 */
import { FUNNEL_MILESTONE_FIELD, getLaunchArea } from '@grouper/core';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { readAreas } from '../lib/areas';
import { grpcCode } from '../lib/errors';
import { docs, PATHS } from '../lib/firestore';
import { claimMilestones, FunnelIncrements } from '../lib/funnel';
import type { AppDeps } from '../lib/runtime';
import { recipientsFor } from '../pods/effects';

const PAGE = 200;
const GRPC_NOT_FOUND = 5;

export async function openArea(deps: AppDeps, areaId: string): Promise<{ outcome: 'notLive' | 'opened'; marked: number; pushed: number }> {
  const area = getLaunchArea(areaId);
  if (!area) return { outcome: 'notLive', marked: 0, pushed: 0 };
  const status = await deps.db.runTransaction(async (tx) => (await readAreas(tx, deps.db, [areaId])).get(areaId)?.status ?? null);
  if (status !== 'live') return { outcome: 'notLive', marked: 0, pushed: 0 };

  const refs = docs(deps.db);
  let marked = 0;
  let after: string | null = null;
  for (;;) {
    let q = deps.db.collection('matchProfiles').where('areaId', '==', areaId).orderBy(FieldPath.documentId()).select().limit(PAGE);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    for (const doc of page.docs) {
      const now = deps.now();
      const fresh = await deps.db.runTransaction(async (tx) => {
        const profile = (await tx.get(refs.matchProfile(doc.id))).data();
        if (!profile || profile.areaId !== areaId || profile.status === 'deleting') return false;
        if (profile.milestones[FUNNEL_MILESTONE_FIELD.firstDropEligible] !== undefined) return false;
        const { milestones } = claimMilestones(profile.milestones, ['firstDropEligible'], now);
        tx.update(deps.db.doc(PATHS.matchProfile(doc.id)), { milestones, openAreaPush: areaId });
        new FunnelIncrements().stage(areaId, now, 'firstDropEligible').write(deps.db, tx);
        return true;
      });
      if (fresh) marked++;
    }
    if (page.size < PAGE) break;
    after = page.docs[page.docs.length - 1]!.id;
  }

  let pushed = 0;
  for (;;) {
    const owed = await deps.db.collection('matchProfiles').where('openAreaPush', '==', areaId).select('status').limit(PAGE).get();
    if (owed.empty) break;
    const uids = owed.docs.filter((d) => d.get('status') !== 'deleting').map((d) => d.id);
    const recipients = await recipientsFor(deps, uids, { activeOnly: true });
    if (recipients.length > 0) pushed += (await deps.push('areaOpen', recipients, { city: area.label })).sent;
    for (const d of owed.docs) {
      // update(), never set(): a profile purged meanwhile is not recreated.
      await d.ref.update({ openAreaPush: FieldValue.delete() }).catch((err: unknown) => {
        if (grpcCode(err) !== GRPC_NOT_FOUND) throw err;
      });
    }
    if (owed.size < PAGE) break;
  }
  return { outcome: 'opened', marked, pushed };
}
