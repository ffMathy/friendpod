/**
 * Budget kill switches (DESIGN.md §9 Rate limits and abuse ceilings). A Cloud Billing budget publishes to
 * BUDGET_TOPIC; once actual spend reaches the budget, the embedder and photo uploads are switched off in
 * `config/app.features`, which both paths check before doing any work. Budgets do not stop spending (§12).
 */
import type { Firestore } from 'firebase-admin/firestore';
import { PATHS } from '../lib/firestore';
import type { LogFields } from '../lib/log';

/** The budget's Pub/Sub topic; the infra setup must create the budget with this topic. */
export const BUDGET_TOPIC = 'budget-alerts';

/**
 * [A] Trip at 100 % of actual spend. Budget notifications arrive several times a day; `alertThresholdExceeded`
 * is present only once a threshold is crossed, and forecast thresholds never trip.
 */
export const KILL_THRESHOLD = 1;

export function exceedsKillThreshold(notification: unknown): boolean {
  const exceeded = (notification as { alertThresholdExceeded?: unknown } | null)?.alertThresholdExceeded;
  return typeof exceeded === 'number' && exceeded >= KILL_THRESHOLD;
}

export async function handleBudgetAlert(db: Firestore, notification: unknown): Promise<LogFields> {
  if (!exceedsKillThreshold(notification)) return { tripped: false };
  // A partial merge: config/app may not exist yet, and its other fields belong to the admin CLI.
  await db.doc(PATHS.configApp()).set({ features: { embedder: false, uploads: false } }, { merge: true });
  return { tripped: true };
}
