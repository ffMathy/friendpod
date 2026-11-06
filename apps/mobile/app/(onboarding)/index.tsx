import { Redirect } from 'expo-router';
import { useSession } from '@/features/session/SessionProvider';

/** Resumes onboarding: before `completeOnboarding` at step 1 (About you), after it at step 4 (interests). */
export default function OnboardingStart() {
  const { onboarded } = useSession();
  return <Redirect href={onboarded ? '/add-interests' : '/about'} />;
}
