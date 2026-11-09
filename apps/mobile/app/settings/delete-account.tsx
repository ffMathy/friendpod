import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/components/theme';
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
 * and what is kept without a name, "Download my data first" (secondary), then "Sign in again and delete" as the 54 px
 * danger outline with its trash icon (never a red fill): one more confirmation, re-authentication (Apple: a fresh
 * authorization code, revoked before deletion), deletion, sign-out and cleared device caches. Email-link accounts get
 * a sign-in link instead and come back to finish. "Cancel" is the quiet link.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const p = usePalette();
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
    // One scrolling column, as priv-delete draws it (a flexible space before the actions): the note, "Sign in again and
    // delete" and "Cancel" sit at the bottom while everything fits, and scroll with the rest when it does not (Danish
    // with an export status, large text), so nothing ever hides behind a pinned footer.
    <Screen safeTop gutter="compact" gap={14} contentStyle={{ paddingTop: Math.max(8, 32 - insets.top) }}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackButton onPress={back} accessibilityLabel={t('common.back')} />
      <Title>{t('deleteAccount.title')}</Title>
      <Text variant="bodySmall" color="textSecondary">
        {t('deleteAccount.lede')}
      </Text>

      <Card gap={10}>
        <Heading>{t('deleteAccount.whatHappens')}</Heading>
        <View style={styles.list}>
          {WHAT_HAPPENS.map((key) => (
            <View key={key} style={styles.item}>
              <View style={styles.bullet} accessibilityElementsHidden importantForAccessibility="no">
                <View style={[styles.disc, { backgroundColor: p.text }]} />
              </View>
              <Text variant="bodySmall" color="text" style={styles.flex}>
                {t(`deleteAccount.${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* The export's state stays right under "Download my data first". */}
      <View style={styles.export}>
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
      </View>

      {/* priv-delete: 14 px between the note, "Sign in again and delete" and "Cancel", 28 px under "Cancel". */}
      <View style={styles.actions}>
        <Text variant="caption" color="textMuted" align="center" style={styles.note}>
          {t('deleteAccount.reauthNote')}
        </Text>
        {state === 'linkSent' ? (
          <Text variant="caption" color="textSecondary" align="center" accessibilityLiveRegion="polite">
            {t('settings.reauthLinkSent')}
          </Text>
        ) : null}
        {typeof state === 'object' ? <ErrorText>{state.error}</ErrorText> : null}
        <Button testID="delete-account" variant="danger" label={t('deleteAccount.confirm')} busy={state === 'working'} onPress={confirm} />
        {state === 'working' ? (
          <View style={styles.cancelSpace} />
        ) : (
          <Button variant="quietLink" fullWidth accessibilityRole="button" label={t('common.cancel')} onPress={back} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** "Download my data first" with the export's state under it (8 px, as on Privacy). */
  export: { gap: 8 },
  /**
   * Pushed to the bottom by the free space (`marginTop: 'auto'` in the growing scroll column), at least the column's
   * 14 px under the export. The storyboard's 28 px under "Cancel": the page's bottom padding (32), less 4.
   */
  actions: { marginTop: 'auto', gap: 14, marginBottom: -4 },
  /** 13/1.5. */
  note: { lineHeight: 19.5 },
  /** `ul` with 20 px padding: the bullet sits in that padding, the text starts 20 px in. */
  list: { gap: 8 },
  item: { flexDirection: 'row' },
  /** The list disc, drawn (the font's "•" is smaller): 5 px, 3 px into the padding, on the first line's x-height. */
  bullet: { width: 20, height: 22, paddingLeft: 3, paddingTop: 2, justifyContent: 'center' },
  disc: { width: 5, height: 5, borderRadius: 2.5 },
  /** Keeps the footer's height while "Cancel" is hidden during the deletion. */
  cancelSpace: { height: 44 },
});
