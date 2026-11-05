import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Heading, Loading, Screen } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/** §3.1 step 8: defaults come from completeOnboarding (own age ±7, or ±10 in the alpha profile). */
export default function PodPreferences() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserDoc(useUid());
  if (!user.data) return <Loading label={t('common.loading')} />;
  return (
    <Screen>
      <Heading>{t('onboarding.prefs.title')}</Heading>
      <Body muted>{t('onboarding.prefs.body')}</Body>
      <PreferencesForm
        initial={user.data.prefs}
        locale={currentLocale()}
        submitLabel={t('common.continue')}
        onSaved={() => router.push('/photo')}
      />
    </Screen>
  );
}
