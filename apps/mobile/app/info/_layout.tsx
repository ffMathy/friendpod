import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/** Transparency pages (Arts. 13/22), readable signed in or out. Each draws its own in-page header (ScreenHeader). */
export default function InfoLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="how-matching-works" options={{ title: t('info.howMatchingWorks.title') }} />
      <Stack.Screen name="safety" options={{ title: t('info.safety.title') }} />
      <Stack.Screen name="sensitive-interests" options={{ title: t('info.sensitive.title') }} />
      <Stack.Screen name="legal/[doc]" options={{ title: t('info.legalTitle') }} />
    </Stack>
  );
}
