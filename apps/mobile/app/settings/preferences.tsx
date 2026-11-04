import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Loading, Screen } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

export default function Preferences() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserDoc(useUid());
  if (!user.data) return <Loading label={t('common.loading')} />;
  return (
    <Screen>
      <PreferencesForm initial={user.data.prefs} locale={currentLocale()} submitLabel={t('common.save')} onSaved={() => router.back()} />
    </Screen>
  );
}
