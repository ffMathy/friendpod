/**
 * In-app per-city waitlist (DESIGN.md §3.1 step 12, founder decision 2026-11-05). Users sign up normally; while their
 * launch area is not live, Home shows the waitlist screen: the city, "N of goal", what happens next and share actions.
 */
import type { AreaDoc } from '../schemas/documents';
import type { LaunchAreaStatus } from '../types/domain';
import { LAUNCH_AREAS_VERSION, type LaunchArea } from './areas';

/** Below this the counter shows "<10" instead of the exact city total. */
export const WAITLIST_EXACT_FROM = 10;

/** The counter's number: exact from 10, "<10" below (a city total, so an exact count is fine above that). */
export function waitlistDisplay(count: number): number | '<10' {
  return count < WAITLIST_EXACT_FROM ? '<10' : count;
}

/** Progress for the bar, 0..1. */
export function waitlistProgress(count: number, goal: number): number {
  if (goal <= 0) return 1;
  return Math.min(1, Math.max(0, count / goal));
}

/** The waitlist screen shows until the area is live: waitlist and beta areas are not matched (§6.4). */
export function isWaitlisted(status: LaunchAreaStatus | null | undefined): boolean {
  return status === 'waitlist' || status === 'beta';
}

/**
 * The public city page on Hosting (`hosting/public/c/index.html`): `/c/{areaId}`. It carries the area id only,
 * never anything about the person who shares it (no referral tracking).
 */
export function cityLinkPath(areaId: string): string {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(areaId)) throw new Error('invalid area id');
  return `/c/${areaId}`;
}

/**
 * `areas/{areaId}` as mirrored from `areas.json` (admin CLI `areas sync`), or created by the server the first time a
 * user onboards into an area that has not been synced yet. The status comes from the existing doc when there is one:
 * go-live is an admin change, not a code change.
 */
export function areaDocFromConfig(area: LaunchArea, waitlistCount: number, status: LaunchAreaStatus = area.status): AreaDoc {
  return {
    label: { da: area.label.da, en: area.label.en },
    status,
    profile: area.profile,
    waitlistCount: Math.max(0, Math.trunc(waitlistCount)),
    goal: { ...area.goal },
    chips: [],
    configVersion: LAUNCH_AREAS_VERSION,
  };
}
