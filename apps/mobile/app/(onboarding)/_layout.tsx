import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/components/navigation';
import { OnboardingDraftProvider } from '@/features/onboarding/draft';

/**
 * The six onboarding steps of the storyboards (onb-about … onb-final; DESIGN §3.1 steps 3–11). Welcome and sign-in
 * live in the (auth) group. Every step draws its own "Step n of 6" header, so the native one is hidden.
 *
 * 1 about (name, date of birth, Terms) → 2 area (completeOnboarding) → 3 sensitive-consent → 4 add-interests →
 * 5 pod-preferences → 6 almost-done (photo, About me, notifications, safety pledge, Finish).
 */
export default function OnboardingLayout() {
  const stackOptions = useStackScreenOptions();
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ ...stackOptions, headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
