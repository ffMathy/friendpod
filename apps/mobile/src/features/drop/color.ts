/**
 * The colour of a pod card on This week, the Pods tab and the "Why this pod" sheet (blend decisions 1, 5 and 9).
 *
 * A pod's colour comes from the theme word the viewer's card shows (`themeLabel`, normalized; `@/lib/podColor`):
 * the same word has the same colour everywhere, so the card matches the viewer's interest chip of that word and the
 * confirmed pod page. Open-to-anyone pods take theirs from the pod id; a pod about a private interest has none (it
 * stays quiet).
 */
import type { PodCardDoc } from '@friendpod/core';
import { podColorOf } from '@/features/pods/color';
import type { PodColor } from '@/lib/podColor';

/**
 * A pod colour; `private` (a pod about a private interest: no colour anywhere, Ink and white with a lock); or
 * `plain`: no colour can be given (nothing to hash), drawn without a colour but not as private.
 */
export type CardColor = PodColor | 'private' | 'plain';

export function cardColor(podId: string, card: Pick<PodCardDoc, 'themeLabel' | 'themeSensitive' | 'reasons'>): CardColor {
  if (card.themeSensitive) return 'private';
  return podColorOf(podId, card) ?? 'plain';
}

/** The colour for the design-system pieces: a pod colour, or `null` (the quiet private set) for private and plain. */
export function dsColor(color: CardColor): PodColor | null {
  return color === 'private' || color === 'plain' ? null : color;
}
