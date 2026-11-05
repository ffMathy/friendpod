import { Redirect } from 'expo-router';
import { useSession } from '@/features/session/SessionProvider';

/** Resumes onboarding: before `completeOnboarding` at the terms, after it at the interests step. */
export default function OnboardingStart() {
  const { onboarded } = useSession();
  return <Redirect href={onboarded ? '/add-interests' : '/terms'} />;
}
