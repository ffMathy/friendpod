import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, Card, ErrorText, Heading, Screen, Text, Title } from '@/components/ui';
import { deleteAccount } from '@/features/account/account';
import { DownloadExportButton, ExportButton, ExportRequestStatus, ExportStatus, useLatestExport, useRequestExport } from '@/features/account/ExportStatus';
import { AuthCancelled } from '@/features/auth/errors';
import { useUid } from '@/features/session/SessionProvider';
import { toAppError } from '@/firebase/callables';
import { errorMessageKey } from '@/lib/errors';

const WHAT_HAPPENS = ['deletedNow', 'leavePods', 'backups', 'signInRecord', 'keptRecords'] as const;

/**
 * "Delete your account?" (priv-delete; §3.10): what is deleted, the backup (7 days) and Auth (up to 180 days) windows
 * and what is kept without a name, "Download my data first", then "Sign in again and delete": one more confirmation,
 * re-authentication (Apple: a fresh authorization code, revoked before deletion), deletion, sign-out and cleared
 * device caches. Email-link accounts get a sign-in link instead and come back to finish.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useUid();
  const exportRequest = useRequestExport();
  const latest = useLatestExport(uid);
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
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deleteAccount.confirmButton'), style: 'destructive', onPress: () => void run() },
    ]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/privacy'));

  return (
    <Screen
      safeTop
      gutter="compact"
      contentStyle={{ paddingTop: Math.max(8, 32 - insets.top) }}
      footer={
        // priv-delete: 16 px between the note, "Sign in again and delete" and "Cancel", 28 px under "Cancel".
        <View style={styles.footer}>
          <Text variant="caption" color="textMuted" align="center">
            {t('deleteAccount.reauthNote')}
          </Text>
          {state === 'linkSent' ? (
            <Text variant="caption" color="textSecondary" align="center" accessibilityLiveRegion="polite">
              {t('settings.reauthLinkSent')}
            </Text>
          ) : null}
          {typeof state === 'object' ? <ErrorText>{state.error}</ErrorText> : null}
          <Button testID="delete-account" variant="danger" label={t('deleteAccount.confirm')} busy={state === 'working'} onPress={confirm} />
          <Button variant="ghost" label={t('common.cancel')} disabled={state === 'working'} onPress={back} style={styles.cancel} />
        </View>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <BackButton onPress={back} accessibilityLabel={t('common.back')} />
      <Title>{t('deleteAccount.title')}</Title>
      <Text variant="body" color="textSecondary" style={styles.lede}>
        {t('deleteAccount.lede')}
      </Text>

      <Card gap={10}>
        <Heading style={styles.heading}>{t('deleteAccount.whatHappens')}</Heading>
        <View style={styles.list}>
          {WHAT_HAPPENS.map((key) => (
            <View key={key} style={styles.item}>
              <Text variant="small" color="textBody" style={styles.dot} accessibilityElementsHidden importantForAccessibility="no">
                {'•'}
              </Text>
              <Text variant="small" color="textBody" style={styles.flex}>
                {t(`deleteAccount.${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {latest?.data.status === 'ready' ? (
        // A file is ready: "Download my data first" downloads it rather than asking for another one.
        <>
          <DownloadExportButton uid={uid} exportId={latest.id} wide label={t('deleteAccount.downloadFirst')} />
          <ExportStatus uid={uid} hideAction />
        </>
      ) : (
        <>
          <ExportButton
            testID="delete-export"
            label={t('deleteAccount.downloadFirst')}
            busy={exportRequest.state === 'working'}
            onPress={() => void exportRequest.request()}
          />
          <ExportRequestStatus state={exportRequest.state} />
          <ExportStatus uid={uid} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: 16, marginBottom: -4 },
  /** The storyboard's h2 keeps the font's normal line height. */
  heading: { lineHeight: 19 },
  /** `ul` with 20 px padding: the bullet sits in that padding, the text starts 20 px in. */
  list: { gap: 8 },
  item: { flexDirection: 'row' },
  dot: { width: 20, paddingLeft: 3 },
  /** The storyboard's p: 15 px at exactly 1.5 (the body variant rounds it up to 23 px). */
  lede: { lineHeight: 22.5 },
  cancel: { minHeight: 48 },
});
