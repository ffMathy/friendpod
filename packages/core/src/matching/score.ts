import type { MatchContext } from './context';

/** Reliability r(u) = (attended + 4) / (attended + noShowW + 5), noShowW = noShows + 0.5·lateCancels (§4.4). */
export function reliability(stats: { readonly attended: number; readonly noShows: number; readonly lateCancels: number }): number {
  const noShowW = stats.noShows + 0.5 * stats.lateCancels;
  return (stats.attended + 4) / (stats.attended + noShowW + 5);
}

/** q(t) = clamp(1 − ln(holders)/ln(n), 0.3, 1): specific themes score higher (§6.2). */
export function specificity(holders: number, n: number): number {
  if (n < 2 || holders < 1) return 1;
  return Math.min(1, Math.max(0.3, 1 - Math.log(holders) / Math.log(n)));
}

/**
 * f(u) = min(weeksWaiting, 4)/4, +1 after a pod that dissolved through no fault of theirs, + the first-timer boost if
 * the user never had a confirmed pod (§6.2).
 */
export function waitingPriority(weeksWaiting: number, priority: boolean, firstTimerBoost = 0): number {
  return Math.min(Math.max(weeksWaiting, 0), 4) / 4 + (priority ? 1 : 0) + Math.max(0, firstTimerBoost);
}

/** s(u,t): 1.0 starred, 0.8 held (§6.2). Confirmed soft links (0.8·cos) are Phase 3. */
export function themeStrength(starred: boolean): number {
  return starred ? 1.0 : 0.8;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

function intersectionSize(a: Int32Array, b: Int32Array): number {
  let i = 0;
  let j = 0;
  let n = 0;
  while (i < a.length && j < b.length) {
    const x = a[i]!;
    const y = b[j]!;
    if (x === y) {
      n++;
      i++;
      j++;
    } else if (x < y) i++;
    else j++;
  }
  return n;
}

/** sec(u,v) = 0.5·relu((cos(p_u,p_v) − τ)/(1 − τ)) + 0.5·min(1, |A_u ∩ A_v|/3). Ordinary holdings only (S2). */
export function secScore(ctx: MatchContext, u: number, v: number): number {
  const a = ctx.users[u]!;
  const b = ctx.users[v]!;
  const tau = ctx.params.tau;
  const cosTerm = a.p && b.p ? Math.max(0, (cosine(a.p, b.p) - tau) / (1 - tau)) : 0;
  return 0.5 * cosTerm + 0.5 * Math.min(1, intersectionSize(a.secondary, b.secondary) / 3);
}

/**
 * pair(u,v) = 0.6·sec + 0.2·exp(−|Δage|/6) + 0.2·(1 − d/min(maxKm)) − 0.5·[co-members 8–26 weeks ago].
 * The last term is reachable only after the Phase 3 H5 relaxation, which is not implemented yet, so it is 0.
 */
export function pairScore(ctx: MatchContext, u: number, v: number): number {
  const a = ctx.users[u]!;
  const b = ctx.users[v]!;
  const d = ctx.distKm(a.cell, b.cell);
  const radius = Math.min(a.maxKm, b.maxKm);
  return 0.6 * secScore(ctx, u, v) + 0.2 * Math.exp(-Math.abs(a.age - b.age) / 6) + 0.2 * (1 - d / radius);
}

/** The per-user terms that do not depend on the pod: wF·f(u) + wR·r(u). */
export function selfScore(ctx: MatchContext, u: number): number {
  const w = ctx.params.weights;
  const user = ctx.users[u]!;
  return w.wF * user.f + w.wR * user.r;
}

/** V(P,t) = Σ_u [B + wT·q(t)·s(u,t) + wF·f(u) + wR·r(u) + wP·avg_{v≠u} pair(u,v)] − sizePen(|P|) (§6.2). */
export function podValue(ctx: MatchContext, members: readonly number[], theme: number): number {
  const w = ctx.params.weights;
  const q = ctx.themeQ(theme);
  const n = members.length;
  const pairSums = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = pairScore(ctx, members[i]!, members[j]!);
      pairSums[i]! += p;
      pairSums[j]! += p;
    }
  }
  let v = 0;
  for (let i = 0; i < n; i++) {
    const u = members[i]!;
    v += w.B + w.wT * q * ctx.themeS(u, theme) + selfScore(ctx, u) + (n > 1 ? (w.wP * pairSums[i]!) / (n - 1) : 0);
  }
  return v - (ctx.params.sizePenalty[n] ?? 0);
}
