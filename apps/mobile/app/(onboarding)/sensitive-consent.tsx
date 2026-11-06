import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StepHeader } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9BlanketConsent } from '@/features/consent/Art9BlanketConsent';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/** "Step 3 of 6" (storyboards 1.2–1.7 count six steps, About you to Almost done). */
const STEP = 3;
const STEPS = 6;

/**
 * The blanket Art. 9 consent step (D3, storyboard 1.4), after `completeOnboarding` (setArt9Consent needs the onboarding
 * claim) and before the interests. "Not now" records nothing and carries on; the consent can be given later in
 * Settings → Privacy. There is no back chevron: the area step behind it has already run `completeOnboarding`.
 */
export default function SensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const give = useCallable('setArt9Consent');
  const next = () => router.replace('/add-interests');
  return (
    <Art9BlanketConsent
      layout="screen"
      header={<StepHeader step={STEP} total={STEPS} stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })} />}
      locale={currentLocale()}
      busy={give.isPending}
      error={give.error ? t(errorMessageKey(give.error)) : null}
      onAgree={(consent) => give.mutate({ consent }, { onSuccess: next })}
      onNotNow={next}
      onReadMore={() => router.push('/info/sensitive-interests')}
    />
  );
}
