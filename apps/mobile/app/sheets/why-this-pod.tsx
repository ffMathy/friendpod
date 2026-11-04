import type { PodReason } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Body, Loading, Screen } from '@/components/ui';
import { usePodCard } from '@/data/docs';
import { useUid } from '@/features/session/SessionProvider';

/** Renders the server's reason codes (§6.7); THEME and ALSO_SHARE carry only the viewer's own wording. */
function reasonText(t: TFunction, r: PodReason): string {
  switch (r.code) {
    case 'THEME':
      return t('reasons.THEME', { wording: r.yourWording });
    case 'ALSO_SHARE':
      return t('reasons.ALSO_SHARE', { list: r.yourWordings.join(', ') });
    case 'AREA':
      return t('reasons.AREA', { label: r.label });
    case 'NEAR_YOU':
      return t('reasons.NEAR_YOU', { km: r.km });
    case 'AGE_SPAN':
      return t('reasons.AGE_SPAN', { min: r.min, max: r.max });
    case 'PRIORITY':
      return t('reasons.PRIORITY', { count: r.weeks });
    case 'SOFT_THEME':
      return t('reasons.SOFT_THEME', { yourTag: r.yourTag, podTheme: r.podTheme });
    case 'OPEN_TO_ANYONE':
      return t('reasons.OPEN_TO_ANYONE');
  }
}

export default function WhyThisPod() {
  const { t } = useTranslation();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const card = usePodCard(useUid(), podId);
  if (!card.data) return <Loading label={t('common.loading')} />;
  return (
    <Screen>
      {card.data.reasons.map((r, i) => (
        <Body key={`${r.code}-${i}`}>{`• ${reasonText(t, r)}`}</Body>
      ))}
      <Body muted>{t('reasons.footer')}</Body>
    </Screen>
  );
}
