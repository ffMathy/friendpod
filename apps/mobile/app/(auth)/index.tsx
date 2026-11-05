import type { Locale } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ChipRow, Screen, Title, Toggle } from '@/components/ui';
import { consumeAccountDeleted } from '@/features/account/account';
import { currentLocale, initI18n } from '@/i18n';

/** §3.1 step 1: the UI language follows the device and can be switched here; confirms an account deletion (§3.10). */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = currentLocale();
  const [deleted] = useState(consumeAccountDeleted);
  const choose = (l: Locale) => initI18n(l);
  return (
    <Screen>
      {deleted ? (
        <Card>
          <Body bold>{t('settings.delete.done')}</Body>
        </Card>
      ) : null}
      <Title>{t('welcome.title')}</Title>
      <Body>{t('welcome.tagline')}</Body>
      <ChipRow>
        <Toggle label={t('languages.da')} value={locale === 'da'} onChange={() => choose('da')} />
        <Toggle label={t('languages.en')} value={locale === 'en'} onChange={() => choose('en')} />
      </ChipRow>
      <Button label={t('welcome.start')} onPress={() => router.push('/sign-in')} />
    </Screen>
  );
}
