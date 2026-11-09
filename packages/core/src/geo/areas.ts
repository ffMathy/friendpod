import { z } from 'zod';
import { LAUNCH_AREA_STATUSES, MATCHING_PROFILE_IDS } from '../types/domain';
import type { Gh5 } from '../types/ids';
import areasJson from './areas.json';
import { GH5_PATTERN } from './geohash';

const launchAreaSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
  label: z.object({ da: z.string().min(1), en: z.string().min(1) }),
  status: z.enum(LAUNCH_AREA_STATUSES),
  profile: z.enum(MATCHING_PROFILE_IDS),
  goal: z.object({
    /** In-app waitlist goal: the counter reads "N of {waitlist}" (§3.1 step 12) [A]. */
    waitlist: z.int().positive(),
    /** Q11 go-live criteria. */
    optedIn: z.int().positive(),
    predictedMatchRate: z.number().min(0).max(1),
    consecutiveWeeks: z.int().positive(),
  }),
  approximation: z
    .object({ method: z.string(), center: z.object({ lat: z.number(), lon: z.number() }), radiusKm: z.number() })
    .optional(),
  cells: z.array(z.string().regex(GH5_PATTERN)).min(1),
});

export const launchAreasFileSchema = z.object({
  version: z.int().positive(),
  note: z.string().optional(),
  areas: z.array(launchAreaSchema).min(1),
});

export type LaunchArea = z.infer<typeof launchAreaSchema>;

/** Static, versioned launch areas (§6.4, A24), mirrored to `areas/{areaId}` by the admin CLI. */
export const LAUNCH_AREAS_VERSION: number = launchAreasFileSchema.parse(areasJson).version;
export const LAUNCH_AREAS: readonly LaunchArea[] = launchAreasFileSchema.parse(areasJson).areas;

const areaByCell = new Map<string, LaunchArea>();
for (const area of LAUNCH_AREAS) {
  for (const cell of area.cells) {
    if (areaByCell.has(cell)) throw new Error(`areas.json: cell ${cell} is in more than one launch area`);
    areaByCell.set(cell, area);
  }
}

/** The launch area containing a home cell, or null ("Friendpod isn't in your area yet"). */
export function resolveLaunchArea(gh5: Gh5): LaunchArea | null {
  return areaByCell.get(gh5) ?? null;
}

export function resolveAreaId(gh5: Gh5): string | null {
  return resolveLaunchArea(gh5)?.id ?? null;
}

export function getLaunchArea(areaId: string): LaunchArea | null {
  return LAUNCH_AREAS.find((a) => a.id === areaId) ?? null;
}
