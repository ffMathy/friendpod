import { geohashCentroid } from '../geo/geohash';
import { haversineKm } from '../geo/haversine';
import type { Gh5 } from '../types/ids';

export interface MatchingComponent {
  /** The lowest geohash in the component; deterministic for a frozen input (§6.4). */
  readonly componentId: Gh5;
  readonly cells: readonly Gh5[];
}

/** 25 km is the largest radius, so no compatible pair can be split across components. */
export const COMPONENT_LINK_KM = 25;

/**
 * Union-find over opted-in cells of live areas, linking cells whose centroids are ≤ `linkKm` apart.
 * Components only partition the drop's compute and are never stored on users.
 */
export function matchingComponents(cells: Iterable<Gh5>, linkKm: number = COMPONENT_LINK_KM): MatchingComponent[] {
  const list = [...new Set(cells)].sort();
  const parent = list.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const centroids = list.map((c) => geohashCentroid(c));
  // Cheap latitude reject first: 1° of latitude is ~111 km everywhere.
  const latSpan = linkKm / 110;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (Math.abs(centroids[i]!.lat - centroids[j]!.lat) > latSpan) continue;
      if (haversineKm(centroids[i]!, centroids[j]!) <= linkKm) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const groups = new Map<number, Gh5[]>();
  list.forEach((cell, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(cell);
    else groups.set(root, [cell]);
  });
  return [...groups.values()].map((g) => ({ componentId: g[0]!, cells: g })).sort((a, b) => (a.componentId < b.componentId ? -1 : 1));
}
