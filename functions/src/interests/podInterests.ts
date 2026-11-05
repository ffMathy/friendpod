/**
 * `pods.podInterests` (DESIGN.md §3.4, S2): the ordinary concepts at least two current members hold, recomputed in
 * every pod the user is a current member of when their ordinary holdings change (removeInterest, confirmSuggestion,
 * "Keep this private" and "This isn't sensitive for me", §10.2). One pod transaction each, after the holding
 * transaction has committed.
 * DESIGN-DEVIATION: §10.2 recomputes inside the holding transaction; a pod transaction per pod right after it keeps
 * the podState compare-and-set, with a window of one round trip in which the old list is still shown.
 */
import { podStates } from '../lib/firestore';
import { errorFields } from '../lib/log';
import type { AppDeps } from '../lib/runtime';
import { withPod } from '../pods/effects';
import { podInterests } from '../pods/transitions';

const LIVE = new Set(['planning', 'scheduled', 'happened']);

export async function recomputePodInterests(deps: AppDeps, uid: string, now: number): Promise<number> {
  const states = await podStates(deps.db).where('memberList', 'array-contains', uid).get();
  let changed = 0;
  for (const s of states.docs) {
    if (!LIVE.has(s.data().state)) continue;
    try {
      await withPod(deps, s.id, now, async (ctx) => {
        if (!ctx.pod?.memberUids.includes(uid)) return;
        const members = ctx.pod.memberUids;
        await ctx.loadProfiles(members);
        const next = await podInterests(ctx, members);
        if (JSON.stringify(next) === JSON.stringify(ctx.pod.podInterests)) return;
        ctx.updatePod((p) => ({ ...p, podInterests: next }));
        changed++;
      });
    } catch (err) {
      deps.log.error('podInterests.recomputeFailed', errorFields(err));
      throw err;
    }
  }
  return changed;
}
