import type { PodCardDoc } from '@grouper/core';

const CONFIRMED_STATES = new Set(['planning', 'scheduled', 'happened', 'archived']);

/** `pods/{podId}` is readable once the pod is confirmed and the viewer is a current member (§9). */
export function isConfirmedMember(card: PodCardDoc | null | undefined): boolean {
  return !!card && card.myStatus === 'accepted' && CONFIRMED_STATES.has(card.state);
}
