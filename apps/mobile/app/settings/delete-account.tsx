import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AppText, Body, Button, Card, ErrorText, Screen, ScreenHeader, Spacer } from '@/components/ui';
import { deleteAccount } from '@/features/account/account';
import { ExportRequestMessage, ExportStatus, useExportRequest } from '@/features/account/ExportStatus';
import { AuthCancelled } from '@/features/auth/errors';
import { useUid } from '@/features/session/SessionProvider';
import { BulletList } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';
import { toAppError } from '@/firebase/callables';
import { errorMessageKey } from '@/lib/errors';

const WHAT_HAPPENS = ['profile', 'pods', 'backups', 'signIn', 'kept'] as const;

/**
 * §3.10 (storyboard 5.4): explains what is deleted and the backup / Auth windows, offers the export first (§3.9),
 * asks once more, re-authenticates (Apple: a fresh authorization code, revoked before deletion), deletes, then signs
 * out and clears the device caches.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const back = useBack('/settings/privacy');
  const uid = useUid();
  const exportRequest = useExportRequest();
  const [state, setState] = useState<'idle' | 'working' | 'linkSent' | { error: string }>('idle');

  const run = async () => {
    setState('working');
    try {
      const outcome = await deleteAccount();
      // On success the session ends and the guard returns to sign-in.
      if (outcome.kind === 'emailLinkSent') setState('linkSent');
    } catch (e) {
      if (e instanceof AuthCancelled) setState('idle');
      else setState({ error: t(errorMessageKey(toAppError(e))) });
    }
  };

  const confirm = () =>
    Alert.alert(t('settings.delete.confirmTitle'), t('settings.delete.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.delete.confirm'), style: 'destructive', onPress: () => void run() },
    ]);

  return (
    <Screen>
      <ScreenHeader title={t('settings.delete.confirmTitle')} backLabel={t('common.back')} onBack={back} />
      <AppText variant="bodyMd" tone="soft">
        {t('settings.delete.lead')}
      </AppText>

      <Card gap={10}>
        <AppText accessibilityRole="header" variant="section">
          {t('settings.delete.whatHappens')}
        </AppText>
        <BulletList items={WHAT_HAPPENS.map((k) => t(`settings.delete.happens.${k}`))} />
      </Card>

      <Button
        testID="delete-export"
        label={t('settings.delete.exportFirst')}
        variant="secondary"
        size="md"
        icon="download"
        busy={exportRequest.state === 'working'}
        onPress={exportRequest.request}
      />
      <ExportRequestMessage state={exportRequest.state} />
      <ExportStatus uid={uid} hidePending={exportRequest.state === 'requested'} />

      <Spacer />
      <AppText variant="caption" tone="muted" align="center">
        {t('settings.delete.reauthNote')}
      </AppText>
      <Button testID="delete-account" label={t('settings.delete.submit')} variant="danger" busy={state === 'working'} onPress={confirm} />
      {state === 'linkSent' ? <Body size="sm">{t('settings.reauthLinkSent')}</Body> : null}
      {typeof state === 'object' ? <ErrorText>{state.error}</ErrorText> : null}
      <Button label={t('common.cancel')} variant="ghost" size="md" disabled={state === 'working'} onPress={back} />
    </Screen>
  );
}
