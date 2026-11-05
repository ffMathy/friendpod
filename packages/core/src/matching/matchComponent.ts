import type { NonSensitiveConceptId } from '../types/ids';
import type { MatchedPod, MatchInput, MatchResult, PodTheme, ReasonSeed } from '../types/matching';
import type { UnmatchedReason } from '../reasons';
import { deriveContext, OPEN_THEME, seedPriorityCompare, type MatchContext } from './context';
import { assertAllConstraints, holdsTheme } from './constraints';
import { collectCandidates, grow, holdersWithinRadius, topCandidates, viablePod } from './grow';
import { commitPod, createSearchState, insertLeftover, localSearch, swapInLeftover, type SearchState } from './localSearch';
import { podValue } from './score';
import { unmatchedReason } from './unmatched';

/** Themes with enough holders within the user's radius to seed a pod, ignoring other constraints. */
function feasibleThemeCount(ctx: MatchContext, u: number): number {
  const need = ctx.params.minSize - 1;
  return ctx.users[u]!.themes.filter((t) => holdersWithinRadius(ctx, u, t) >= need).length;
}

/** topThemes(i, k) by s(i,t)·q(t), ties by concept id order. */
function topThemes(ctx: MatchContext, u: number): number[] {
  const user = ctx.users[u]!;
  return [...user.themes]
    .sort((a, b) => ctx.themeQ(b) * user.themeS.get(b)! - ctx.themeQ(a) * user.themeS.get(a)! || a - b)
    .slice(0, ctx.params.topThemes);
}

/** Seed-and-grow (§6.3 Phase 1): the best viable pod around `seed` over the given themes, or null. */
function bestPodFor(ctx: MatchContext, state: SearchState, seed: number, themes: readonly number[]): { members: number[]; theme: number } | null {
  let best: { members: number[]; theme: number; v: number } | null = null;
  for (const theme of themes) {
    const candidates = collectCandidates(ctx, seed, theme, state.podOf);
    if (candidates.length < ctx.params.minSize - 1) continue;
    const members = grow(ctx, seed, theme, topCandidates(ctx, seed, candidates));
    if (!viablePod(ctx, members, theme)) continue;
    const v = podValue(ctx, members, theme);
    if (!best || v > best.v) best = { members, theme, v };
  }
  return best;
}

function seedAndGrow(ctx: MatchContext, state: SearchState, seeds: readonly number[], themesFor: (u: number) => readonly number[]): number {
  const feasible = new Map(seeds.map((u) => [u, feasibleThemeCount(ctx, u)]));
  const order = [...seeds].sort((a, b) => {
    return seedPriorityCompare(ctx, a, b) || feasible.get(a)! - feasible.get(b)! || ctx.users[a]!.tie - ctx.users[b]!.tie || a - b;
  });
  let created = 0;
  for (const u of order) {
    if (state.podOf[u] !== -1) continue;
    const best = bestPodFor(ctx, state, u, themesFor(u));
    if (best) {
      commitPod(ctx, state, best.members, best.theme);
      created++;
    }
  }
  return created;
}

const roundUpTo5 = (km: number): number => Math.max(5, Math.ceil(km / 5 - 1e-9) * 5);

function reasonSeed(ctx: MatchContext, members: readonly number[], theme: number, u: number): ReasonSeed {
  const user = ctx.users[u]!;
  const ordinaryTheme = theme === OPEN_THEME || ctx.conceptSensitive[theme] !== 1;
  const others = members.filter((m) => m !== u);
  let alsoShare: NonSensitiveConceptId[] = [];
  if (ordinaryTheme) {
    // S2: only ordinary holdings (secondary) are ever named, and only on ordinary themes (§3.2).
    alsoShare = [...user.secondary]
      .filter((c) => c !== theme)
      .map((c) => ({ c, n: others.filter((o) => ctx.users[o]!.secondary.includes(c)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.c - b.c)
      .slice(0, 3)
      .map((x) => ctx.conceptIds[x.c] as NonSensitiveConceptId);
  }
  const ages = members.map((m) => ctx.users[m]!.age);
  return {
    alsoShare,
    nearKm: roundUpTo5(Math.max(0, ...others.map((o) => ctx.distKm(user.cell, ctx.users[o]!.cell)))),
    ageSpan: ordinaryTheme ? { min: Math.min(...ages), max: Math.max(...ages) } : null,
    priorityWeeks: user.weeksWaiting >= 1 ? user.weeksWaiting : null,
  };
}

function toPodTheme(ctx: MatchContext, theme: number): PodTheme {
  return theme === OPEN_THEME
    ? { kind: 'openToAnyone' }
    : { kind: 'concept', conceptId: ctx.conceptIds[theme]!, sensitive: ctx.conceptSensitive[theme] === 1 };
}

/**
 * matchComponent (DESIGN.md §6.3): pure and deterministic for a frozen input and seed. Same input in any
 * order gives the same pods; there is no clock and no RNG state. Throws MatchConstraintError rather than
 * return a pod that violates H1–H6, S1–S3 or S5 (fail closed: the caller writes nothing and alerts).
 */
export function matchComponent(input: MatchInput): MatchResult {
  const ctx = deriveContext(input);
  const state = createSearchState(ctx);
  const eligible = ctx.users.filter((u) => u.ineligible === null).map((u) => u.idx);
  const leftovers = (): number[] =>
    eligible
      .filter((u) => state.podOf[u] === -1)
      .sort((a, b) => seedPriorityCompare(ctx, a, b) || ctx.users[a]!.tie - ctx.users[b]!.tie || a - b);

  // Phase 1: seed-and-grow; first-timers first (§6.2), then longest-waiting and hardest-to-place.
  const phase1Pods = seedAndGrow(ctx, state, eligible, (u) => topThemes(ctx, u));
  // Phase 2: local search over leftovers.
  localSearch(ctx, state, [insertLeftover, swapInLeftover], leftovers);
  // Phase 3: users who waited ≥ 2 weeks and opted in to "open to anyone" (Q12, q = 0.3); then Phase 2 again.
  let phase3Pods = 0;
  if (ctx.params.openToAnyone.enabled) {
    const open = leftovers().filter((u) => holdsTheme(ctx, u, OPEN_THEME));
    phase3Pods = seedAndGrow(ctx, state, open, () => [OPEN_THEME]);
    if (phase3Pods > 0) localSearch(ctx, state, [insertLeftover, swapInLeftover], leftovers);
  }
  // TODO(DESIGN.md §6.3 Phase 3): confirmed soft links (non-sensitive only) and the H5 co-member window
  // 26 → 8 weeks for users waiting ≥ 2 weeks. The H5 relaxation needs the co-member week per pair,
  // which `recentH: {uidH: untilWeek}` does not record.

  assertAllConstraints(ctx, state.pods);

  const pods: MatchedPod[] = state.pods
    .map((pod) => {
      const members = [...pod.members].sort((a, b) => a - b);
      return {
        members: members.map((m) => ctx.users[m]!.uid),
        theme: toPodTheme(ctx, pod.theme),
        value: pod.value,
        reasons: Object.fromEntries(members.map((m) => [ctx.users[m]!.uid, reasonSeed(ctx, members, pod.theme, m)])),
      };
    })
    .sort((a, b) => (a.members[0]! < b.members[0]! ? -1 : 1));

  const unmatched = ctx.users
    .filter((u) => u.ineligible !== 'excluded' && state.podOf[u.idx] === -1)
    .map((u) => ({ uid: u.uid, reason: unmatchedReason(ctx, u.idx) }));
  const unmatchedByReason: Partial<Record<UnmatchedReason, number>> = {};
  for (const u of unmatched) unmatchedByReason[u.reason] = (unmatchedByReason[u.reason] ?? 0) + 1;
  const podsBySize: Record<number, number> = {};
  for (const p of pods) podsBySize[p.members.length] = (podsBySize[p.members.length] ?? 0) + 1;

  return {
    pods,
    unmatched,
    excluded: ctx.users.filter((u) => u.ineligible === 'excluded').map((u) => u.uid),
    stats: {
      users: ctx.users.length,
      eligible: eligible.length,
      matched: pods.reduce((n, p) => n + p.members.length, 0),
      pods: pods.length,
      podsBySize,
      sensitivePods: pods.filter((p) => p.theme.kind === 'concept' && p.theme.sensitive).length,
      openToAnyonePods: pods.filter((p) => p.theme.kind === 'openToAnyone').length,
      phase1Pods,
      phase3Pods,
      movesEvaluated: state.movesEvaluated,
      inserts: state.inserts,
      swaps: state.swaps,
      objective: state.pods.reduce((v, p) => v + p.value, 0),
      droppedThemes: { ...ctx.dropped },
      unmatchedByReason,
    },
  };
}
