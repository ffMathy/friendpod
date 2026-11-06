import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';
import { OnboardingDraftProvider } from '@/features/onboarding/draft';

/**
 * Steps 3–11 of §3.1 (welcome and sign-in live in the (auth) group). Every step draws its own in-page header
 * (StepHeader or a big title, storyboards 1.2–1.7), so the native bar is hidden; the title still names the screens
 * for the system.
 */
export default function OnboardingLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ ...stackOptions, title: t('onboarding.title'), headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
