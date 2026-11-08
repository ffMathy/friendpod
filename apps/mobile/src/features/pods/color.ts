import type { PodDoc } from '@grouper/core';
import { podColorOfTheme, type PodColor } from '@/lib/podColor';

/**
 * The pod's colour on its own screens (blend decision 9): from the theme's concept id, the same for every member
 * whatever wording they see; an open-to-anyone pod takes it from its pod id. A pod about a private interest has none
 * (decision 1: it stays quiet), and neither does a pod whose shared document has not loaded.
 */
export function podColorOf(podId: string, pod: Pick<PodDoc, 'theme'> | null | undefined, sensitive: boolean): PodColor | null {
  if (sensitive || !pod) return null;
  return podColorOfTheme(pod.theme, podId);
}
