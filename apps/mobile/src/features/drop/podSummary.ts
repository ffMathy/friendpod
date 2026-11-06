import type { PodCardDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import type { AvatarStackMember } from '@/components/ui';
import { usePod } from '@/data/docs';
import { isConfirmedMember } from '@/features/pods/membership';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';

export interface PodSummary {
  /** The members' initials, the viewer last; empty before confirmation or while the pod doc loads. */
  readonly members: readonly AvatarStackMember[];
  /** "Pick a time by Tue 11 Nov, 18:00" · "Sat 15 Nov, 14:00 · Café Nord" · "Met · Sat 15 Nov, 14:00" · the state. */
  readonly detail: string;
}

/**
 * What a pod row or card shows besides the theme. `pods/{podId}` is read only for a confirmed member (§9), the same
 * read the pod page makes; members are first names, which confirmed members see anyway (§3.4).
 */
export function usePodSummary(uid: string, podId: string, card: PodCardDoc): PodSummary {
  const { t } = useTranslation();
  const pod = usePod(podId, isConfirmedMember(card)).data ?? null;
  const locale = currentLocale();
  const state = t(`podState.${card.state}`);
  if (!pod) return { members: [], detail: state };

  const others = pod.memberUids.filter((m) => m !== uid);
  const ordered = pod.memberUids.includes(uid) ? [...others, uid] : others;
  const members = ordered.flatMap((m) => {
    const entry = pod.roster[m];
    if (!entry) return [];
    return [{ key: m, uid: m, name: entry.firstName, ...(m === uid ? { you: true, label: t('chat.you') } : {}) }];
  });
  const meetupAt = pod.planning.meetupAt?.toMillis();
  const place = pod.planning.place?.name;
  const when = meetupAt !== undefined ? formatDateTime(meetupAt, locale) : null;
  let detail: string;
  if (card.state === 'planning') detail = t('pod.planBy', { when: formatDateTime(pod.planning.deadline.toMillis(), locale) });
  else if (card.state === 'scheduled' && when) detail = place ? `${when} · ${place}` : when;
  else detail = when ? `${state} · ${when}` : state;
  return { members, detail };
}
