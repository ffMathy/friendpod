import type { Prefs } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, ErrorText, Loading } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PreferencesFields, usePreferencesForm } from '@/features/profile/PreferencesForm';
import { useUid } from '@/features/session/SessionProvider';
import { PageLede, ShellPage } from '@/features/shell/parts';
import { currentLocale } from '@/i18n';

/**
 * Me → Pod preferences: the same fields as onboarding step 5 (onb-prefs: ages, how far, meetup language, when you're
 * free, open to anyone, same-gender pods behind their own consent), with Save pinned at the bottom.
 */
export default function Preferences() {
  const { t } = useTranslation();
  const user = useUserDoc(useUid());
  if (user.data) return <PreferencesPage initial={user.data.prefs} />;
  if (user.error) {
    return (
      <ShellPage title={t('me.preferences')} eyebrow={t('tabs.me')}>
        <Card>
          <ErrorText>{t('common.loadFailed')}</ErrorText>
        </Card>
      </ShellPage>
    );
  }
  return <Loading label={t('common.loading')} />;
}

function PreferencesPage({ initial }: { readonly initial: Prefs }) {
  const { t } = useTranslation();
  const router = useRouter();
  const controller = usePreferencesForm({ initial, onSaved: () => router.back() });
  return (
    <ShellPage
      title={t('me.preferences')}
      eyebrow={t('tabs.me')}
      gap={18}
      testID="preferences"
      footer={<Button testID="prefs-save" label={t('common.save')} busy={controller.saving} onPress={controller.save} />}
    >
      <PageLede>{t('me.preferencesLede')}</PageLede>
      <PreferencesFields controller={controller} locale={currentLocale()} />
    </ShellPage>
  );
}
