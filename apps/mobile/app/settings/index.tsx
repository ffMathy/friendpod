import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ListGroup, Screen, ScreenHeader } from '@/components/ui';
import { signOut } from '@/features/account/account';
import { SettingsRow } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/me');
  const [busy, setBusy] = useState(false);
  const legal = (doc: 'terms' | 'privacy' | 'licences') => () => router.push({ pathname: '/info/legal/[doc]', params: { doc } });
  return (
    <Screen>
      <ScreenHeader eyebrow={t('tabs.me')} title={t('settings.title')} backLabel={t('common.back')} onBack={back} />

      <ListGroup>
        <SettingsRow icon="people" title={t('me.preferences')} role="link" onPress={() => router.push('/settings/preferences')} />
        <SettingsRow icon="lock" title={t('settings.privacy.title')} role="link" onPress={() => router.push('/settings/privacy')} />
        <SettingsRow icon="block" title={t('settings.blocked.title')} role="link" onPress={() => router.push('/settings/blocked')} />
        <SettingsRow icon="bell" title={t('settings.notifications.title')} role="link" onPress={() => router.push('/settings/notifications')} />
        <SettingsRow icon="chat" title={t('notices.title')} role="link" onPress={() => router.push('/settings/notices')} />
      </ListGroup>

      <ListGroup title={t('info.legalTitle')}>
        <SettingsRow title={t('info.legalTerms')} role="link" onPress={legal('terms')} />
        <SettingsRow title={t('info.legalPrivacy')} role="link" onPress={legal('privacy')} />
        <SettingsRow title={t('info.legalLicences')} role="link" onPress={legal('licences')} />
      </ListGroup>

      <Button
        label={t('settings.signOut')}
        variant="secondary"
        busy={busy}
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}
