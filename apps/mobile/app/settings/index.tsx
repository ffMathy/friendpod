import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, LinkRow, Screen } from '@/components/ui';
import { signOut } from '@/features/account/account';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <LinkRow label={t('me.preferences')} onPress={() => router.push('/settings/preferences')} />
      <LinkRow label={t('settings.privacy.title')} onPress={() => router.push('/settings/privacy')} />
      <LinkRow label={t('settings.blocked.title')} onPress={() => router.push('/settings/blocked')} />
      <LinkRow label={t('settings.notifications.title')} onPress={() => router.push('/settings/notifications')} />
      <LinkRow label={t('info.legalTerms')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } })} />
      <LinkRow label={t('info.legalPrivacy')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } })} />
      <LinkRow label={t('info.legalLicences')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'licences' } })} />
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
