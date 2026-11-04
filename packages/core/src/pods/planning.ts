/** Planning-round outcomes (§4.6, D6, D7). Pure: the sweeper applies them in its podState transaction. */
import { BACKFILL_POD_STATES, type PodState } from '../types/domain';

/** An option wins with at least this many yes votes (ties → earlier time; a single option may win). */
export const WINNING_YES_VOTES = 3;

export type PlanningDeadlineOutcome = 'schedule' | 'extend' | 'dissolve' | 'archive';

/**
 * At the planning deadline (D7): a winner → `scheduled`. No winner → one 24 h extension round per planning round
 * ("No time works yet — add another option"); after that a pod that has never met dissolves and a keep-loop pod
 * (one that has met) archives.
 */
export function planningDeadlineOutcome(p: { readonly hasWinner: boolean; readonly extensionUsed: boolean; readonly hasMet: boolean }): PlanningDeadlineOutcome {
  if (p.hasWinner) return 'schedule';
  if (!p.extensionUsed) return 'extend';
  return p.hasMet ? 'archive' : 'dissolve';
}

/** Backfill only before the plan locks (D6), and once per pod (§4.2). */
export function canBackfill(state: PodState, backfillUsed: boolean): boolean {
  return !backfillUsed && BACKFILL_POD_STATES.includes(state);
}
