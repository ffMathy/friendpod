import * as SecureStore from 'expo-secure-store';

/**
 * Steps 7–11 of onboarding (§3.1) run after `completeOnboarding` has set the `onb` claim, so the claim
 * alone cannot tell whether the user finished them. A per-uid device flag does; after a reinstall the
 * user simply sees those optional steps once more.
 */
const key = (uid: string) => `onboardingComplete.${uid}`;

export async function isOnboardingComplete(uid: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(key(uid))) === '1';
}

export async function setOnboardingComplete(uid: string): Promise<void> {
  await SecureStore.setItemAsync(key(uid), '1');
}

export async function clearOnboardingFlag(uid: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(uid));
}
