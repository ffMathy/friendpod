import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Checkbox, Heading, Screen } from '@/components/ui';

/** §3.1 step 10b: the safety pledge. */
export default function Pledge() {
  const { t } = useTranslation();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  return (
    <Screen>
      <Heading>{t('onboarding.pledge.title')}</Heading>
      <Body>{t('onboarding.pledge.body')}</Body>
      <Checkbox label={t('onboarding.pledge.checkbox')} checked={agreed} onChange={setAgreed} />
      <Button label={t('common.continue')} disabled={!agreed} onPress={() => router.push('/done')} />
    </Screen>
  );
}
