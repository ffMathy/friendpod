import type { UnmatchedReason } from '../reasons';
import { OPEN_THEME, type MatchContext } from './context';
import { sensitiveDensityOk } from './constraints';

/** Funnel stages in the order a candidate pool shrinks; the deepest stage any theme reaches names the cause. */
const STAGES = ['NO_THEME_BUCKET', 'RADIUS', 'AGE', 'GENDER', 'LANGUAGE', 'AVAILABILITY', 'SENSITIVE_ELIGIBILITY', 'SENSITIVE_DENSITY', 'NO_FIT_THIS_WEEK'] as const;

function stageForTheme(ctx: MatchContext, u: number, theme: number): number {
  const user = ctx.users[u]!;
  const need = ctx.params.minSize - 1;
  const counts = [0, 0, 0, 0, 0, 0];
  outer: for (const list of ctx.holders.get(theme)?.values() ?? []) {
    for (const o of list) {
      if (o === u) continue;
      const v = ctx.users[o]!;
      counts[0]!++;
      if (ctx.distKm(user.cell, v.cell) > Math.min(user.maxKm, v.maxKm)) continue;
      counts[1]!++;
      if (user.age < v.ageMin || user.age > v.ageMax || v.age < user.ageMin || v.age > user.ageMax) continue;
      counts[2]!++;
      if ((user.sameGenderOnly || v.sameGenderOnly) && (user.gender === null || user.gender !== v.gender)) continue;
      counts[3]!++;
      if ((user.langMask & v.langMask) === 0) continue;
      counts[4]!++;
      if ((user.avail & v.avail) === 0) continue;
      counts[5]!++;
      if (counts[5]! >= need) break outer;
    }
  }
  const failed = counts.findIndex((c) => c < need);
  if (failed >= 0) return failed;
  if (ctx.conceptSensitive[theme] === 1) {
    if (!user.s5Eligible) return 6;
    if (!sensitiveDensityOk(ctx, theme, [u])) return 7;
  }
  return 8;
}

/**
 * Reason code for an eligible user left without a pod (§6.7). Blocks, reports and pair history (H4, H5)
 * are never named: a user stopped only by them gets NO_FIT_THIS_WEEK.
 */
export function unmatchedReason(ctx: MatchContext, u: number): UnmatchedReason {
  const user = ctx.users[u]!;
  if (user.ineligible !== null && user.ineligible !== 'excluded') return user.ineligible;
  const themes = [...new Set([...user.themes, ...user.heldSensitive])].filter((t) => t !== OPEN_THEME).sort((a, b) => a - b);
  let best = 0;
  for (const t of themes) {
    best = Math.max(best, stageForTheme(ctx, u, t));
    if (best === STAGES.length - 1) break;
  }
  const code = STAGES[best]!;
  return code === 'GENDER' && user.sameGenderOnly ? 'GENDER_POOL' : code;
}
