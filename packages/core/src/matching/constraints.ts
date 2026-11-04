import { encodeGeohash, geohashCentroid } from '../geo/geohash';
import { haversineKm } from '../geo/haversine';
import { OPEN_THEME, type MatchContext } from './context';

export type HardConstraint = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';

/** The first pairwise hard constraint (§6.1) that `a` and `b` violate, or null if they are compatible. */
export function compatFailure(ctx: MatchContext, a: number, b: number): HardConstraint | null {
  const u = ctx.users[a]!;
  const v = ctx.users[b]!;
  if (u.age < v.ageMin || u.age > v.ageMax || v.age < u.ageMin || v.age > u.ageMax) return 'H1';
  if (ctx.distKm(u.cell, v.cell) > Math.min(u.maxKm, v.maxKm)) return 'H2';
  if ((u.sameGenderOnly || v.sameGenderOnly) && (u.gender === null || u.gender !== v.gender)) return 'H3';
  if (u.blocked.has(v.uidH) || v.blocked.has(u.uidH)) return 'H4';
  if (u.recent.has(v.uidH) || v.recent.has(u.uidH)) return 'H5';
  if ((u.langMask & v.langMask) === 0) return 'H6';
  return null;
}

export function compat(ctx: MatchContext, a: number, b: number): boolean {
  return compatFailure(ctx, a, b) === null;
}

/**
 * S1 local density: at least `densityMin` eligible consenting holders of the sensitive theme whose cells
 * lie within `densityKm` of the pod's centroid cell. Holders outside this component or not opted in this
 * week are not in the input, so the count can only err on the side of fewer sensitive pods.
 */
export function sensitiveDensityOk(ctx: MatchContext, theme: number, members: readonly number[]): boolean {
  const s = ctx.params.sensitive;
  let lat = 0;
  let lon = 0;
  for (const m of members) {
    const c = geohashCentroid(ctx.cells[ctx.users[m]!.cell]!);
    lat += c.lat;
    lon += c.lon;
  }
  const podCell = geohashCentroid(encodeGeohash(lat / members.length, lon / members.length, 5));
  let count = 0;
  for (const [cell, list] of ctx.holders.get(theme) ?? []) {
    if (haversineKm(podCell, geohashCentroid(ctx.cells[cell]!)) <= s.densityKm) count += list.length;
  }
  return count >= s.densityMin;
}

/** Whether `u` may be in a pod themed `theme` (holds it as an eligible theme, or qualifies for open-to-anyone). */
export function holdsTheme(ctx: MatchContext, u: number, theme: number): boolean {
  const user = ctx.users[u]!;
  if (theme === OPEN_THEME) {
    const o = ctx.params.openToAnyone;
    return o.enabled && user.openToAnyone && user.weeksWaiting >= o.minWeeksWaiting;
  }
  return user.themeS.has(theme);
}

export type PodConstraint = 'SIZE' | 'DUPLICATE' | 'INELIGIBLE' | 'THEME' | 'PARTITION' | 'AVAILABILITY' | 'S1_DENSITY' | HardConstraint;

/** Thrown by assertAllConstraints. Carries pod index and constraint code only, never uids (logs are pseudonymised). */
export class MatchConstraintError extends Error {
  readonly constraint: PodConstraint;
  readonly podIndex: number;
  constructor(constraint: PodConstraint, podIndex: number) {
    super(`matchComponent: pod ${podIndex} violates ${constraint}`);
    this.name = 'MatchConstraintError';
    this.constraint = constraint;
    this.podIndex = podIndex;
  }
}

/** The first violated pod-level constraint (§6.1), or null. */
export function podViolation(ctx: MatchContext, members: readonly number[], theme: number): PodConstraint | null {
  const p = ctx.params;
  if (members.length < p.minSize || members.length > p.maxSize) return 'SIZE';
  if (new Set(members).size !== members.length) return 'DUPLICATE';
  let avail = 0b111111;
  for (const m of members) {
    const u = ctx.users[m]!;
    if (u.ineligible !== null) return 'INELIGIBLE';
    if (!holdsTheme(ctx, m, theme)) return 'THEME';
    for (let i = 0; i < u.secondary.length; i++) if (ctx.conceptSensitive[u.secondary[i]!] === 1) return 'PARTITION';
    avail &= u.avail;
  }
  if (avail === 0) return 'AVAILABILITY';
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const f = compatFailure(ctx, members[i]!, members[j]!);
      if (f) return f;
    }
  }
  if (theme !== OPEN_THEME && ctx.conceptSensitive[theme] === 1) {
    if (!members.every((m) => ctx.users[m]!.s5Eligible)) return 'INELIGIBLE';
    if (!sensitiveDensityOk(ctx, theme, members)) return 'S1_DENSITY';
  }
  return null;
}

/** Fail closed (§6.3): every pod is re-checked from scratch, and each user is in at most one pod. */
export function assertAllConstraints(ctx: MatchContext, pods: readonly { readonly members: readonly number[]; readonly theme: number }[]): void {
  const placed = new Set<number>();
  pods.forEach((pod, i) => {
    const v = podViolation(ctx, pod.members, pod.theme);
    if (v) throw new MatchConstraintError(v, i);
    for (const m of pod.members) {
      if (placed.has(m)) throw new MatchConstraintError('DUPLICATE', i);
      placed.add(m);
    }
  });
}
