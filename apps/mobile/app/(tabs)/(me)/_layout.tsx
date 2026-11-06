import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/** A link straight to /settings/privacy still gets the Me hub underneath, so back leads to Me. */
export const unstable_settings = { anchor: 'me' };

/**
 * The Me tab's own stack (storyboard 5.3): Me (/me) and Privacy (/settings/privacy), which keeps the tab bar with Me
 * active, so the tab bar is the way back and Privacy draws no chevron. The rest of /settings (the Settings list,
 * Privacy's sub-pages such as Delete account, 5.4) opens over the tabs from app/settings, as those pages have no tab
 * bar. Every screen draws its own in-page header.
 */
export default function MeLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="me" options={{ title: t('tabs.me') }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('settings.privacy.title') }} />
    </Stack>
  );
}
