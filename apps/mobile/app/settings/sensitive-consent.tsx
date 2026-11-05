import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9BlanketConsent } from '@/features/consent/Art9BlanketConsent';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/** Settings → Privacy → give the blanket Art. 9 consent (D3); the same screen as in onboarding. */
export default function SettingsSensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const give = useCallable('setArt9Consent');
  return (
    <Screen>
      <Art9BlanketConsent
        locale={currentLocale()}
        busy={give.isPending}
        error={give.error ? t(errorMessageKey(give.error)) : null}
        onAgree={(consent) => give.mutate({ consent }, { onSuccess: () => router.back() })}
        onNotNow={() => router.back()}
        onReadMore={() => router.push('/info/sensitive-interests')}
      />
    </Screen>
  );
}
