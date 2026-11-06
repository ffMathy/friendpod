import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Spacing } from '@/components/theme';
import { AppText, Body, Button, Card, Divider, ErrorText, Screen, ScreenHeader } from '@/components/ui';
import { deleteAccount } from '@/features/account/account';
import { ExportRequestMessage, ExportStatus, useExportRequest } from '@/features/account/ExportStatus';
import { AuthCancelled } from '@/features/auth/errors';
import { useUid } from '@/features/session/SessionProvider';
import { BulletList } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';
import { useFooterFit } from '@/features/settings/useFooterFit';
import { toAppError } from '@/firebase/callables';
import { errorMessageKey } from '@/lib/errors';

const WHAT_HAPPENS = ['profile', 'pods', 'backups', 'signIn', 'kept'] as const;
/** Header, lead, "What happens", the export block: three gaps. */
const BODY_GAPS = 3;
/** Re-auth note, the delete block, Cancel: two gaps. */
const FOOTER_GAPS = 2;

/**
 * §3.10 (storyboard 5.4): explains what is deleted and the backup / Auth windows, offers the export first (§3.9),
 * asks once more, re-authenticates (Apple: a fresh authorization code, revoked before deletion), deletes, then signs
 * out and clears the device caches. The re-auth note, the delete button and Cancel stay pinned at the bottom, so the
 * safe way out is always fully on screen. The explanation and "Download my data first" scroll above them at the
 * storyboard's spacing where both fit, else at a compact one (829-pt Android phones), so the footer never cuts through
 * the export button; where even that does not fit (small phones, large text) a hairline marks where the body scrolls on.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const back = useBack('/settings/privacy');
  const uid = useUid();
  const exportRequest = useExportRequest();
  const fit = useFooterFit(BODY_GAPS, FOOTER_GAPS);
  const { spacing } = fit;
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

  const footer = (
    <View testID="delete-account-footer" style={{ gap: spacing.footerGap }}>
      <AppText variant="caption" tone="muted" align="center">
        {t('settings.delete.reauthNote')}
      </AppText>
      <View style={styles.block}>
        <Button testID="delete-account" label={t('settings.delete.submit')} variant="danger" busy={state === 'working'} onPress={confirm} />
        {state === 'linkSent' ? <Body size="sm">{t('settings.reauthLinkSent')}</Body> : null}
        {typeof state === 'object' ? <ErrorText>{state.error}</ErrorText> : null}
      </View>
      <Button label={t('common.cancel')} variant="ghost" size="md" disabled={state === 'working'} onPress={back} />
    </View>
  );

  return (
    <Screen scroll={false} gap={0} contentStyle={styles.frame} footer={footer}>
      <ScrollView
        testID="delete-account-body"
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingTop: spacing.top, paddingBottom: spacing.bottom, gap: spacing.gap }]}
        keyboardShouldPersistTaps="handled"
        onLayout={fit.onLayout}
        onContentSizeChange={fit.onContentSizeChange}
      >
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

        <View style={styles.block}>
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
        </View>
      </ScrollView>
      {fit.overflowing ? (
        <View testID="delete-account-edge" pointerEvents="none" style={styles.edge}>
          <Divider />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The body scrolls in its own view (it measures what fits), so Screen's padding moves onto its content.
  frame: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
  // No flexGrow: the content's own height is what useFooterFit compares with the viewport.
  body: { paddingHorizontal: Spacing.gutter },
  // A button and the status lines under it.
  block: { gap: Spacing.sm },
  // On the footer's top edge, across the screen.
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
