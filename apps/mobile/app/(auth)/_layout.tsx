import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/** Signed-out screens. Each draws its own header (logo or back chevron), as on the storyboards. */
export default function AuthLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stackOptions, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="email" options={{ title: t('auth.email.title') }} />
    </Stack>
  );
}
