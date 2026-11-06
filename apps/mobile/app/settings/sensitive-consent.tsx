import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { IconButton } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9BlanketConsent } from '@/features/consent/Art9BlanketConsent';
import { useBack } from '@/features/settings/useBack';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Settings → Privacy → give the blanket Art. 9 consent (D3); the same screen as in onboarding (storyboard 1.4), with
 * a back chevron instead of the step header. Its own title comes from the versioned copy, so the header has none.
 */
export default function SettingsSensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/settings/privacy');
  const give = useCallable('setArt9Consent');
  return (
    <Art9BlanketConsent
      layout="screen"
      header={<IconButton icon="chevronLeft" label={t('common.back')} onPress={back} style={styles.back} />}
      locale={currentLocale()}
      busy={give.isPending}
      error={give.error ? t(errorMessageKey(give.error)) : null}
      onAgree={(consent) => give.mutate({ consent }, { onSuccess: back })}
      onNotNow={back}
      onReadMore={() => router.push('/info/sensitive-interests')}
    />
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
});
