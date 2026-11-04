import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Heading, Screen } from '@/components/ui';
import { registerPushToken, requestPushPermission } from '@/features/notifications/push';

/** §3.1 step 10a: notification permission; pushes never name a theme or a person (S4). */
export default function Notifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      if (await requestPushPermission()) await registerPushToken();
    } catch {
      // Notifications stay off; the user can enable them later in Settings.
    } finally {
      setBusy(false);
      router.push('/pledge');
    }
  };

  return (
    <Screen>
      <Heading>{t('onboarding.notifications.title')}</Heading>
      <Body>{t('onboarding.notifications.body')}</Body>
      <Button label={t('onboarding.notifications.enable')} busy={busy} onPress={() => void enable()} />
      <Button label={t('common.notNow')} variant="secondary" onPress={() => router.push('/pledge')} />
    </Screen>
  );
}
