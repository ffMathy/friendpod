import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { BulletList } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';

const PAUSES = ['reports', 'noShow', 'underage', 'notGenuine'] as const;

/** "How matching works" (§11, PRIVACY.md §4.4): inputs used and not used, every automated pause, and that no person reviews decisions (D2). */
export default function HowMatchingWorks() {
  const { t } = useTranslation();
  const back = useBack('/');
  return (
    <Screen>
      <ScreenHeader title={t('info.howMatchingWorks.title')} backLabel={t('common.back')} onBack={back} />
      <AppText variant="body">{t('info.howMatchingWorks.inputs')}</AppText>

      <Card>
        <AppText variant="bodyMd">{t('info.howMatchingWorks.notUsed')}</AppText>
      </Card>
      <Banner tone="violet" icon="lock">
        {t('info.howMatchingWorks.sensitive')}
      </Banner>

      <SectionTitle title={t('info.howMatchingWorks.pausesTitle')} icon="pause" />
      <Card>
        <AppText variant="bodyMd">{t('info.howMatchingWorks.pauses')}</AppText>
        <BulletList items={PAUSES.map((p) => t(`info.howMatchingWorks.pauseList.${p}`))} />
      </Card>
      <Banner tone="subtle" icon="info">
        {t('info.howMatchingWorks.humanReview')}
      </Banner>
      <AppText variant="bodySm" tone="soft">
        {t('info.howMatchingWorks.pause')}
      </AppText>
    </Screen>
  );
}
