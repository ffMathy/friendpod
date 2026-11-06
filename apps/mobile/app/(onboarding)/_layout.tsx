import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';
import { OnboardingDraftProvider } from '@/features/onboarding/draft';

/** Steps 3–11 of §3.1 (welcome and sign-in live in the (auth) group). */
export default function OnboardingLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ ...stackOptions, title: t('onboarding.title') }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </OnboardingDraftProvider>
  );
}
