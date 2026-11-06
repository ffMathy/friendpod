import { getLaunchArea, getMatchingProfile } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Loading, StepHeader, Title } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

const STEP = 5;
const STEPS = 6;

/**
 * §3.1 step 9 (storyboard 1.6): defaults come from completeOnboarding (own age ± the area profile's half-width: 7 at
 * launch, wider in the alpha profile, §6.10).
 */
export default function PodPreferences() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserDoc(useUid());
  if (!user.data) return <Loading label={t('common.loading')} />;
  const areaId = user.data.area.areaId;
  const profile = getMatchingProfile((areaId ? getLaunchArea(areaId)?.profile : undefined) ?? 'launch');
  return (
    <PreferencesForm
      layout="screen"
      header={
        <>
          <StepHeader
            step={STEP}
            total={STEPS}
            stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })}
            backLabel={t('common.back')}
            onBack={router.back}
          />
          <Title>{t('onboarding.prefs.question')}</Title>
        </>
      }
      initial={user.data.prefs}
      locale={currentLocale()}
      ageHalfWidth={profile.defaults.ageHalfWidth}
      submitLabel={t('common.continue')}
      submitVariant="accent"
      onSaved={() => router.push('/done')}
    />
  );
}
