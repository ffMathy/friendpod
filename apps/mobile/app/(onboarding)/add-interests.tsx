import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';
import { InterestManager } from '@/features/interests/InterestManager';
import { OnboardingStep, useStepBack } from '@/features/onboarding/OnboardingStep';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

const MIN_INTERESTS = 3;

/**
 * Step 4 of 6, "What are you into?" (onb-interests; DESIGN §3.1 step 8): free-text interests, minimum 3 (nudged to 5).
 * The list itself is InterestManager's (input + Add, chips in their pod colours from their words, private ones
 * quiet). Continue is pinned at the bottom, as the storyboard draws it: the locked interest notice is longer than the
 * storyboard's note, so the list, the "Did you mean" card and "Popular in …" scroll above it.
 */
export default function AddInterests() {
  const { t } = useTranslation();
  const router = useRouter();
  // Back is the consent step (step 3), as on the storyboard. After a resume this screen is the first in its stack:
  // back then opens the consent step in its place, which carries on here again, as in the first run.
  const back = useStepBack() ?? (() => router.replace('/sensitive-consent'));
  const uid = useUid();
  const ordinary = useInterests(uid).data ?? [];
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const enough = ordinary.length + sensitive.length >= MIN_INTERESTS;
  return (
    <OnboardingStep
      step={4}
      title={t('onboarding.interests.title')}
      lede={t('onboarding.interests.lede')}
      onBack={back}
      footer={<Button testID="interests-continue" label={t('common.continue')} disabled={!enough} onPress={() => router.push('/pod-preferences')} />}
    >
      <InterestManager uid={uid} locale={currentLocale()} mode="onboarding" />
    </OnboardingStep>
  );
}
