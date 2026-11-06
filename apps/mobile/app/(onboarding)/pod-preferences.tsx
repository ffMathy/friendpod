import type { Prefs } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Loading } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { OnboardingStep, useStepBack } from '@/features/onboarding/OnboardingStep';
import { PreferencesFields, usePreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/**
 * Step 5 of 6, "Who would you like to meet?" (onb-prefs; DESIGN §3.1 step 9). The defaults come from
 * completeOnboarding and the area's profile (own age ±7, or ±13 in the alpha profile, which also turns "open to anyone"
 * on; §6.10); Continue saves them. As on the storyboard, "open to anyone" is not asked here: it keeps the profile's
 * default and can be changed in Settings → Preferences.
 */
export default function PodPreferences() {
  const { t } = useTranslation();
  const user = useUserDoc(useUid());
  if (!user.data) return <Loading label={t('common.loading')} />;
  return <PreferencesStep initial={user.data.prefs} />;
}

function PreferencesStep({ initial }: { readonly initial: Prefs }) {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useStepBack();
  const controller = usePreferencesForm({ initial, onSaved: () => router.push('/almost-done') });
  return (
    <OnboardingStep
      step={5}
      title={t('onboarding.prefs.title')}
      gap={18}
      onBack={back}
      // Continue follows the same-gender card, as onb-prefs draws it, so a pinned button never covers that card.
      footerPinned={false}
      footer={<Button testID="prefs-continue" label={t('common.continue')} busy={controller.saving} onPress={controller.save} />}
    >
      <PreferencesFields controller={controller} locale={currentLocale()} showOpenToAnyone={false} />
    </OnboardingStep>
  );
}
