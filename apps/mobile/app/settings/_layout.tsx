import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/**
 * Settings under Me, over the tabs (storyboard 5.4 and the pages without a storyboard). Privacy itself (5.3) lives in
 * the Me tab's stack (app/(tabs)/(me)/settings/privacy) at the same /settings/privacy URL, so it keeps the tab bar.
 * Every screen draws its own in-page header (ScreenHeader), so no native bar.
 */
export default function SettingsLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="index" options={{ title: t('settings.title') }} />
      <Stack.Screen name="delete-account" options={{ title: t('settings.delete.title') }} />
      <Stack.Screen name="blocked" options={{ title: t('settings.blocked.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('settings.notifications.title') }} />
      <Stack.Screen name="preferences" options={{ title: t('me.preferences') }} />
      <Stack.Screen name="sensitive-consent" options={{ title: t('settings.privacy.sensitiveTitle') }} />
      <Stack.Screen name="photo" options={{ title: t('me.photo') }} />
      <Stack.Screen name="notices" options={{ title: t('notices.title') }} />
    </Stack>
  );
}
