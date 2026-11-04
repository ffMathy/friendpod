import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9BlanketConsent } from '@/features/consent/Art9BlanketConsent';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * The blanket Art. 9 consent step (D3), after `completeOnboarding` (setArt9Consent needs the onboarding claim) and
 * before the interests. "Not now" records nothing and carries on; the consent can be given later in Settings → Privacy.
 */
export default function SensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const give = useCallable('setArt9Consent');
  const next = () => router.replace('/add-interests');
  return (
    <Screen>
      <Art9BlanketConsent
        locale={currentLocale()}
        busy={give.isPending}
        error={give.error ? t(errorMessageKey(give.error)) : null}
        onAgree={(consent) => give.mutate({ consent }, { onSuccess: next })}
        onNotNow={next}
        onReadMore={() => router.push('/info/sensitive-interests')}
      />
    </Screen>
  );
}
