/**
 * The colour of a pod card on This week, the Pods tab and the "Why this pod" sheet (blend decisions 1, 5 and 9).
 *
 * A pod's colour comes from its theme's concept id, never from the word the viewer sees. Before confirmation the
 * shared pod document (which carries the concept id) is not readable, and the viewer's card carries only their own
 * wording: the server copies it from the viewer's interest that holds the pod's concept (`themeLabel` = that
 * interest's `display`). So the concept id is that interest's: the same colour every member's app computes, and the
 * same colour the confirmed pod page shows. Open-to-anyone pods take theirs from the pod id; a pod about a private
 * interest has none (it stays quiet).
 */
import type { InterestDoc, PodCardDoc, PodDoc } from '@grouper/core';
import { useInterests } from '@/data/docs';
import type { WithId } from '@/data/live';
import { podColorFor, podColorOfTheme, type PodColor } from '@/lib/podColor';

/**
 * A pod colour; `private` (a pod about a private interest: no colour anywhere, Ink and white with a lock); or
 * `plain`: the colour cannot be known (the viewer has since removed the interest the pod is about, or their interests
 * are still loading), drawn without a colour but not as private.
 */
export type CardColor = PodColor | 'private' | 'plain';

export function cardColor(
  podId: string,
  card: Pick<PodCardDoc, 'themeLabel' | 'themeSensitive' | 'reasons'>,
  pod: Pick<PodDoc, 'theme'> | null | undefined,
  interests: readonly WithId<InterestDoc>[] | undefined,
): CardColor {
  if (card.themeSensitive) return 'private';
  if (pod) return podColorOfTheme(pod.theme, podId) ?? 'private';
  if (card.themeLabel === null || card.reasons.some((r) => r.code === 'OPEN_TO_ANYONE')) return podColorFor({ podId }) ?? 'plain';
  const held = interests?.find((i) => i.data.display === card.themeLabel);
  return (held ? podColorFor({ conceptId: held.data.conceptId }) : null) ?? 'plain';
}

/** `cardColor` with the viewer's interests read live. Pass the pod document when the viewer may read it. */
export function useCardColor(
  uid: string,
  podId: string,
  card: Pick<PodCardDoc, 'themeLabel' | 'themeSensitive' | 'reasons'>,
  pod?: Pick<PodDoc, 'theme'> | null,
): CardColor {
  const interests = useInterests(uid).data;
  return cardColor(podId, card, pod, interests);
}

/** The colour for the design-system pieces: a pod colour, or `null` (the quiet private set) for private and plain. */
export function dsColor(color: CardColor): PodColor | null {
  return color === 'private' || color === 'plain' ? null : color;
}
