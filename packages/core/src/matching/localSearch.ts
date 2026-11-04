import { OPEN_THEME, type MatchContext } from './context';
import { compat, holdsTheme, sensitiveDensityOk } from './constraints';
import { podValue } from './score';

export interface BuildPod {
  readonly theme: number;
  members: number[];
  value: number;
  avail: number;
}

export interface SearchState {
  readonly pods: BuildPod[];
  /** User index → pod index, or −1. */
  readonly podOf: Int32Array;
  readonly podsByTheme: Map<number, number[]>;
  /** Remaining evaluated moves (§6.3: a move budget, never a wall clock). */
  budget: number;
  movesEvaluated: number;
  inserts: number;
  swaps: number;
}

export function createSearchState(ctx: MatchContext): SearchState {
  return {
    pods: [],
    podOf: new Int32Array(ctx.users.length).fill(-1),
    podsByTheme: new Map(),
    budget: ctx.params.moveBudget,
    movesEvaluated: 0,
    inserts: 0,
    swaps: 0,
  };
}

const availOf = (ctx: MatchContext, members: readonly number[]): number =>
  members.reduce((a, m) => a & ctx.users[m]!.avail, 0b111111);

export function commitPod(ctx: MatchContext, state: SearchState, members: number[], theme: number): void {
  const index = state.pods.length;
  state.pods.push({ theme, members, value: podValue(ctx, members, theme), avail: availOf(ctx, members) });
  for (const m of members) state.podOf[m] = index;
  const list = state.podsByTheme.get(theme);
  if (list) list.push(index);
  else state.podsByTheme.set(theme, [index]);
}

function spend(state: SearchState): boolean {
  if (state.budget <= 0) return false;
  state.budget--;
  state.movesEvaluated++;
  return true;
}

function densityOk(ctx: MatchContext, theme: number, members: readonly number[]): boolean {
  return theme === OPEN_THEME || ctx.conceptSensitive[theme] !== 1 || sensitiveDensityOk(ctx, theme, members);
}

/** Themes a leftover could join: its eligible themes, plus open-to-anyone if it qualifies. */
function themesOf(ctx: MatchContext, u: number): number[] {
  const themes = [...ctx.users[u]!.themes];
  if (holdsTheme(ctx, u, OPEN_THEME)) themes.push(OPEN_THEME);
  return themes;
}

export type Move = (ctx: MatchContext, state: SearchState, u: number) => boolean;

/** Adds leftover `u` to the first pod (by theme, then pod order) where every constraint holds and V improves. */
export const insertLeftover: Move = (ctx, state, u) => {
  const user = ctx.users[u]!;
  for (const theme of themesOf(ctx, u)) {
    for (const pi of state.podsByTheme.get(theme) ?? []) {
      const pod = state.pods[pi]!;
      if (pod.members.length >= ctx.params.maxSize) continue;
      if (!spend(state)) return false;
      if ((pod.avail & user.avail) === 0 || !pod.members.every((m) => compat(ctx, u, m))) continue;
      const members = [...pod.members, u];
      if (!densityOk(ctx, theme, members)) continue;
      const value = podValue(ctx, members, theme);
      if (value - pod.value <= ctx.params.minDelta) continue;
      pod.members = members;
      pod.value = value;
      pod.avail &= user.avail;
      state.podOf[u] = pi;
      state.inserts++;
      return true;
    }
  }
  return false;
};

/** Replaces a member `w` with leftover `u`, only if f(u) > f(w) (u has waited longer) and V improves. */
export const swapInLeftover: Move = (ctx, state, u) => {
  const user = ctx.users[u]!;
  for (const theme of themesOf(ctx, u)) {
    for (const pi of state.podsByTheme.get(theme) ?? []) {
      const pod = state.pods[pi]!;
      for (const w of pod.members) {
        if (!(user.f > ctx.users[w]!.f)) continue;
        if (!spend(state)) return false;
        const rest = pod.members.filter((m) => m !== w);
        const avail = availOf(ctx, rest) & user.avail;
        if (avail === 0 || !rest.every((m) => compat(ctx, u, m))) continue;
        const members = [...rest, u];
        if (!densityOk(ctx, theme, members)) continue;
        const value = podValue(ctx, members, theme);
        if (value - pod.value <= ctx.params.minDelta) continue;
        pod.members = members;
        pod.value = value;
        pod.avail = avail;
        state.podOf[u] = pi;
        state.podOf[w] = -1;
        state.swaps++;
        return true;
      }
    }
  }
  return false;
};

// TODO(DESIGN.md §6.3 Phase 2): swapBetweenNearbyPods (20 nearest) and moveMember are not implemented yet.

/** Phase 2: first improvement over leftovers; stops after `maxPasses`, a pass without improvement, or the budget. */
export function localSearch(ctx: MatchContext, state: SearchState, moves: readonly Move[], leftovers: () => number[]): void {
  for (let pass = 0; pass < ctx.params.maxPasses; pass++) {
    let improved = false;
    for (const u of leftovers()) {
      if (state.budget <= 0) return;
      if (state.podOf[u] !== -1) continue;
      for (const move of moves) {
        if (move(ctx, state, u)) {
          improved = true;
          break;
        }
      }
    }
    if (!improved) return;
  }
}
