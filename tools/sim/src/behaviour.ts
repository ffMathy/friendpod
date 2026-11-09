/**
 * Assumed behaviour (DESIGN.md §6.9). None of these constants is measured; they are set so the mean
 * invite acceptance lands in the 0.6–0.7 range that [MAT] uses for its confirmation estimates.
 */
import { type MatchContext, pairScore, secScore } from '@friendpod/core';
import { logistic, type Rng } from './rng';

export const BEHAVIOUR = {
  /** accept = logistic(a + b·(x − x0) − c·(d / maxKm)); x = wT·q(t)·s(u,t) + wP·avgPair(u). */
  accept: { a: 1.0, b: 3.0, x0: 0.35, c: 0.8 },
  /** Probability that a confirmed pod agrees on an option. */
  planningSuccess: 0.85,
  /** Weeks a confirmed pod occupies one of the member's two active slots (planning + meetup). */
  activeWeeks: 2,
  /** Auto-pause after this many declines in a row (§3.3), for this many weeks. */
  pauseAfterDeclines: 3,
  pauseWeeks: 2,
  /** meet again = clamp(m0 + m1·sec + m2·exp(−|Δage|/6) + N(0, sd)). */
  meetAgain: { m0: 0.25, m1: 0.5, m2: 0.25, sd: 0.1 },
} as const;

/** Acceptance probability for member `u` of a proposed pod (indices into `ctx`). */
export function acceptProbability(ctx: MatchContext, members: readonly number[], theme: number, u: number): number {
  const w = ctx.params.weights;
  const others = members.filter((m) => m !== u);
  const avgPair = others.reduce((s, o) => s + pairScore(ctx, u, o), 0) / Math.max(1, others.length);
  const x = w.wT * ctx.themeQ(theme) * ctx.themeS(u, theme) + w.wP * avgPair;
  const user = ctx.users[u]!;
  const maxD = Math.max(0, ...others.map((o) => ctx.distKm(user.cell, ctx.users[o]!.cell)));
  const k = BEHAVIOUR.accept;
  return logistic(k.a + k.b * (x - k.x0) - k.c * (maxD / user.maxKm));
}

export function meetAgainProbability(ctx: MatchContext, u: number, v: number, rng: Rng): number {
  const m = BEHAVIOUR.meetAgain;
  const ageGap = Math.abs(ctx.users[u]!.age - ctx.users[v]!.age);
  const p = m.m0 + m.m1 * secScore(ctx, u, v) + m.m2 * Math.exp(-ageGap / 6) + rng.normal(0, m.sd);
  return Math.min(1, Math.max(0, p));
}
