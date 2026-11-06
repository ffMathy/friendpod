import { useTranslation } from 'react-i18next';
import { Loading, ScreenHeader } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { useBack } from '@/features/settings/useBack';
import { currentLocale } from '@/i18n';

/** Me → Pod preferences: the onboarding form (storyboard 1.6) with an in-page header and Save pinned at the bottom. */
export default function Preferences() {
  const { t } = useTranslation();
  const back = useBack('/me');
  const user = useUserDoc(useUid());
  if (!user.data) return <Loading label={t('common.loading')} />;
  return (
    <PreferencesForm
      layout="screen"
      header={<ScreenHeader title={t('me.preferences')} backLabel={t('common.back')} onBack={back} />}
      initial={user.data.prefs}
      locale={currentLocale()}
      submitLabel={t('common.save')}
      onSaved={back}
    />
  );
}
