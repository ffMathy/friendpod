import { OPEN_THEME, type MatchContext } from './context';
import { compat, holdsTheme, sensitiveDensityOk } from './constraints';
import { pairScore, selfScore } from './score';

/** Unassigned eligible holders of `theme` in cells within the seed's radius. */
function holderLists(ctx: MatchContext, theme: number, cell: number, km: number): (readonly number[])[] {
  const byCell = theme === OPEN_THEME ? ctx.openHolders : ctx.holders.get(theme);
  if (!byCell) return [];
  const lists: (readonly number[])[] = [];
  for (const c of ctx.cellsWithin(cell, km)) {
    const list = byCell.get(c);
    if (list) lists.push(list);
  }
  return lists;
}

/**
 * Compatible candidates for a seed and theme: nearest cells first, hashed order within a cell, at most
 * `candidateScan` of them so Phase 1 work stays bounded at n = 20k (§6.4).
 */
export function collectCandidates(ctx: MatchContext, seed: number, theme: number, podOf: Int32Array): number[] {
  const s = ctx.users[seed]!;
  const out: number[] = [];
  for (const list of holderLists(ctx, theme, s.cell, s.maxKm)) {
    for (const c of list) {
      if (c === seed || podOf[c] !== -1 || (ctx.users[c]!.avail & s.avail) === 0) continue;
      if (!compat(ctx, seed, c)) continue;
      out.push(c);
      if (out.length >= ctx.params.candidateScan) return out;
    }
  }
  return out;
}

/** Holders of `theme` within the user's radius, excluding the user (feasibleThemeCount and reasons). */
export function holdersWithinRadius(ctx: MatchContext, user: number, theme: number): number {
  const u = ctx.users[user]!;
  let n = 0;
  for (const list of holderLists(ctx, theme, u.cell, u.maxKm)) n += list.length;
  return n - (u.ineligible === null && holdsTheme(ctx, user, theme) ? 1 : 0);
}

/** Higher score first; ties break on the hashed order, then the index (§6.5). */
const before = (ctx: MatchContext, a: number, sa: number, b: number, sb: number): number =>
  sb - sa || ctx.users[a]!.tie - ctx.users[b]!.tie || a - b;

/** topK(C, K, c => pair(seed, c) + self(c), tie): returns candidates with their pair score to the seed. */
export function topCandidates(ctx: MatchContext, seed: number, candidates: readonly number[]): { ids: number[]; pairToSeed: number[] } {
  const scored = candidates.map((c) => {
    const pair = pairScore(ctx, seed, c);
    return { c, pair, score: pair + selfScore(ctx, c) };
  });
  scored.sort((x, y) => before(ctx, x.c, x.score, y.c, y.score));
  const top = scored.slice(0, ctx.params.topK);
  return { ids: top.map((x) => x.c), pairToSeed: top.map((x) => x.pair) };
}

/** Pod target: 5, or 6 when Σ r of the five is below the profile's threshold; alpha: 6 whenever possible (§4.2). */
function wantsMore(ctx: MatchContext, members: readonly number[]): boolean {
  const p = ctx.params;
  if (members.length < p.targetSize) return true;
  if (members.length >= p.maxSize) return false;
  if (p.overbook.mode === 'always') return true;
  let sumR = 0;
  for (const m of members) sumR += ctx.users[m]!.r;
  return sumR < p.overbook.sumRBelow;
}

/**
 * grow (§6.3): greedily adds the candidate with the best self(c) + wT·q(t)·s(c,t) + wP·avgPair(c, P),
 * dropping candidates as soon as they are incompatible with a new member or would zero AND(availability).
 */
export function grow(ctx: MatchContext, seed: number, theme: number, top: { ids: number[]; pairToSeed: number[] }): number[] {
  const w = ctx.params.weights;
  const q = ctx.themeQ(theme);
  const members = [seed];
  let avail = ctx.users[seed]!.avail;
  const alive = top.ids.slice();
  const pairSum = new Map<number, number>(top.ids.map((c, i) => [c, top.pairToSeed[i]!]));
  while (wantsMore(ctx, members) && alive.length > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (const c of alive) {
      const score = selfScore(ctx, c) + w.wT * q * ctx.themeS(c, theme) + (w.wP * pairSum.get(c)!) / members.length;
      if (best < 0 || before(ctx, c, score, best, bestScore) < 0) {
        best = c;
        bestScore = score;
      }
    }
    members.push(best);
    avail &= ctx.users[best]!.avail;
    for (let i = alive.length - 1; i >= 0; i--) {
      const c = alive[i]!;
      if (c === best || (ctx.users[c]!.avail & avail) === 0 || !compat(ctx, c, best)) alive.splice(i, 1);
      else pairSum.set(c, pairSum.get(c)! + pairScore(ctx, c, best));
    }
  }
  return members;
}

/** A grown pod is usable if it reaches the minimum size and, for a sensitive theme, passes S1. */
export function viablePod(ctx: MatchContext, members: readonly number[], theme: number): boolean {
  if (members.length < ctx.params.minSize) return false;
  if (theme !== OPEN_THEME && ctx.conceptSensitive[theme] === 1) return sensitiveDensityOk(ctx, theme, members);
  return true;
}
