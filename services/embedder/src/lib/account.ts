import type { AccountStatus } from '@grouper/core';
import { AppError } from './errors';

/**
 * Account states in which addInterests may run and write. Once `users.status` is `deleting`, nothing may
 * recreate the user's subtree (PRIVACY.md §6 step 1), although the caller's ID and App Check tokens stay
 * valid for up to an hour and purgeUser runs asynchronously; a suspended account adds nothing either.
 */
const ACCEPTS_INTERESTS: ReadonlySet<unknown> = new Set<AccountStatus>(['active', 'paused']);

export function assertAcceptsInterests(status: unknown): void {
  if (!ACCEPTS_INTERESTS.has(status)) throw new AppError('STATE');
}
