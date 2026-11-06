import { useTranslation } from 'react-i18next';
import { Banner, Card, Screen, ScreenHeader } from '@/components/ui';
import { BulletList } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';

const TIPS = ['public', 'transport', 'tellFriend', 'leave', 'drink', 'address'] as const;

/** Safety tips (§4.5), shown at confirmation and at T−24 h. The last one (Report, 112) stands out in coral. */
export default function Safety() {
  const { t } = useTranslation();
  const back = useBack('/');
  return (
    <Screen>
      <ScreenHeader title={t('info.safety.title')} backLabel={t('common.back')} onBack={back} />
      <Card>
        <BulletList icon="check" variant="bodyMd" items={TIPS.map((tip) => t(`info.safety.tips.${tip}`))} />
      </Card>
      <Banner tone="coral" icon="shield">
        {t('info.safety.tips.report')}
      </Banner>
    </Screen>
  );
}
