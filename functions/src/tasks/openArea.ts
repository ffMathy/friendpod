/**
 * openArea (DESIGN.md §3.1 step 12, §6.4, §10.3): after the admin CLI flips `areas/{areaId}.status` to `live`, every
 * user in the area becomes eligible for the next drop. Each one is marked `firstDropEligible` once (milestone and
 * funnel counter in one transaction), and only users marked by this run get the push "<city> is open — your first
 * drop is Thursday 18:00", so a retried task neither counts nor notifies anyone twice.
 */
import { FUNNEL_MILESTONE_FIELD, getLaunchArea } from '@grouper/core';
import { FieldPath } from 'firebase-admin/firestore';
import { readAreas } from '../lib/areas';
import { docs, PATHS } from '../lib/firestore';
import { claimMilestones, FunnelIncrements } from '../lib/funnel';
import type { PushRecipient } from '../lib/push';
import type { AppDeps } from '../lib/runtime';

const PAGE = 200;

export async function openArea(deps: AppDeps, areaId: string): Promise<{ outcome: 'notLive' | 'opened'; marked: number; pushed: number }> {
  const area = getLaunchArea(areaId);
  if (!area) return { outcome: 'notLive', marked: 0, pushed: 0 };
  const status = await deps.db.runTransaction(async (tx) => (await readAreas(tx, deps.db, [areaId])).get(areaId)?.status ?? null);
  if (status !== 'live') return { outcome: 'notLive', marked: 0, pushed: 0 };

  const refs = docs(deps.db);
  const marked: string[] = [];
  let after: string | null = null;
  for (;;) {
    let q = deps.db.collection('matchProfiles').where('areaId', '==', areaId).orderBy(FieldPath.documentId()).select().limit(PAGE);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    for (const doc of page.docs) {
      const now = deps.now();
      const fresh = await deps.db.runTransaction(async (tx) => {
        const profile = (await tx.get(refs.matchProfile(doc.id))).data();
        if (!profile || profile.areaId !== areaId || profile.milestones[FUNNEL_MILESTONE_FIELD.firstDropEligible] !== undefined) return false;
        const { milestones } = claimMilestones(profile.milestones, ['firstDropEligible'], now);
        tx.update(deps.db.doc(PATHS.matchProfile(doc.id)), { milestones });
        new FunnelIncrements().stage(areaId, now, 'firstDropEligible').write(deps.db, tx);
        return true;
      });
      if (fresh) marked.push(doc.id);
    }
    if (page.size < PAGE) break;
    after = page.docs[page.docs.length - 1]!.id;
  }

  const recipients: PushRecipient[] = [];
  for (const uid of marked) {
    const [tokens, user] = await Promise.all([refs.pushTokens(uid).get(), refs.user(uid).get()]);
    const list = tokens.data()?.tokens.map((t) => t.token) ?? [];
    const u = user.data();
    if (list.length > 0 && u && u.status === 'active') recipients.push({ locale: u.locale, tokens: list });
  }
  const pushed = recipients.length > 0 ? (await deps.push('areaOpen', recipients, { city: area.label })).sent : 0;
  return { outcome: 'opened', marked: marked.length, pushed };
}
