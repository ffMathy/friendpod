import { currentLegalText } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Screen, ScreenHeader } from '@/components/ui';
import { useBack } from '@/features/settings/useBack';
import { currentLocale } from '@/i18n';

/** "Read more about sensitive interests" from the blanket consent and the interests screen (PRIVACY.md §3). */
export default function SensitiveInterests() {
  const { t } = useTranslation();
  const back = useBack('/');
  const notice = currentLegalText('interestNotice', currentLocale());
  return (
    <Screen>
      <ScreenHeader title={t('info.sensitive.title')} backLabel={t('common.back')} onBack={back} />
      {/* The standing notice, verbatim from @grouper/core (PRIVACY.md §3.2). */}
      {notice.kind === 'interestNotice' ? (
        <Banner tone="violet" icon="lock">
          {notice.content.text}
        </Banner>
      ) : null}
      <Card>
        {(['what', 'where', 'who'] as const).map((s) => (
          <AppText key={s} variant="bodyMd">
            {t(`info.sensitive.${s}`)}
          </AppText>
        ))}
      </Card>
      <Card>
        <AppText variant="bodyMd">{t('info.sensitive.withdraw')}</AppText>
      </Card>
      <Banner tone="amber" icon="info">
        {t('info.sensitive.risk')}
      </Banner>
    </Screen>
  );
}
