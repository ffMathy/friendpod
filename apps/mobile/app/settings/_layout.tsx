import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: t('settings.title') }} />
      <Stack.Screen name="privacy" options={{ title: t('settings.privacy.title') }} />
      <Stack.Screen name="delete-account" options={{ title: t('settings.delete.title') }} />
      <Stack.Screen name="blocked" options={{ title: t('settings.blocked.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('settings.notifications.title') }} />
      <Stack.Screen name="preferences" options={{ title: t('me.preferences') }} />
      <Stack.Screen name="sensitive-consent" options={{ title: t('settings.privacy.sensitiveTitle') }} />
      <Stack.Screen name="notices" options={{ title: t('notices.title') }} />
    </Stack>
  );
}
