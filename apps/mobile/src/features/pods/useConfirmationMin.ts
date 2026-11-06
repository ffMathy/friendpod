import { getLaunchArea, getMatchingProfile } from '@grouper/core';
import { useAreaDoc, useUserDoc } from '@/data/docs';

/**
 * How many accepts confirm a pod in the viewer's launch area (the matching profile's `confirmationMin`), for the
 * proposal card's "Names and photos appear when N people have said yes". Pods form within the viewer's own area, so
 * its profile applies. Undefined while unknown; the card then says "once the pod is confirmed" instead.
 */
export function useConfirmationMin(uid: string): number | undefined {
  const user = useUserDoc(uid);
  const areaId = user.data?.area.areaId ?? null;
  const area = useAreaDoc(areaId);
  const profileId = area.data?.profile ?? (areaId ? getLaunchArea(areaId)?.profile : undefined);
  return profileId ? getMatchingProfile(profileId).defaults.confirmationMin : undefined;
}
