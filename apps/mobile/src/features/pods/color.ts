import type { PodCardDoc } from '@grouper/core';
import { podColorFor, type PodColor } from '@/lib/podColor';

/** What of the viewer's pod card the colour needs. */
export type PodCardColorInput = Pick<PodCardDoc, 'themeLabel' | 'themeSensitive' | 'reasons'>;

/** An open-to-anyone pod: no theme word (or the server says so). Its colour comes from the pod id. */
export function isOpenToAnyone(card: Pick<PodCardDoc, 'themeLabel' | 'reasons'>): boolean {
  return card.themeLabel === null || card.reasons.some((r) => r.code === 'OPEN_TO_ANYONE');
}

/**
 * The pod's colour on its own screens (blend decision 9): from the theme word the viewer's card shows
 * (`themeLabel`), normalized, so it matches that word's interest chip everywhere; an open-to-anyone pod takes it
 * from its pod id. A pod about a private interest has none (decision 1: it stays quiet), and neither does a pod
 * whose card has not loaded.
 */
export function podColorOf(podId: string, card: PodCardColorInput | null | undefined): PodColor | null {
  if (!card || card.themeSensitive) return null;
  if (isOpenToAnyone(card)) return podColorFor({ podId });
  return podColorFor({ word: card.themeLabel });
}
