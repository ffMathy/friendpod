import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Spacing, usePalette } from '@/components/theme';
import { AppText, Button, ErrorText, Icon, type ButtonProps } from '@/components/ui';
import { useExports } from '@/data/docs';
import { toAppError } from '@/firebase/callables';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { requestDataExport } from './account';
import { downloadExport } from './exportDownload';

export type ExportRequestState = 'idle' | 'working' | 'requested' | 'linkSent' | { readonly error: string };

/**
 * "Download my data" (§3.9): re-authenticates, then asks the server to build the file. Shared by Settings → Privacy
 * (storyboard 5.3) and "Download my data first" on Delete account (5.4).
 */
export function useExportRequest(): { readonly state: ExportRequestState; readonly request: () => void } {
  const { t } = useTranslation();
  const [state, setState] = useState<ExportRequestState>('idle');
  const run = async () => {
    setState('working');
    try {
      const outcome = await requestDataExport();
      setState(outcome.kind === 'done' ? 'requested' : 'linkSent');
    } catch (e) {
      setState({ error: t(errorMessageKey(toAppError(e))) });
    }
  };
  return { state, request: () => void run() };
}

/** What happened to the last request: preparing, a sign-in link was sent instead, or an error. */
export function ExportRequestMessage({ state, style }: { state: ExportRequestState; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const body =
    state === 'requested' ? (
      <StatusLine icon="clock" text={t('settings.privacy.exportRequested')} />
    ) : state === 'linkSent' ? (
      <StatusLine icon="info" text={t('settings.reauthLinkSent')} />
    ) : typeof state === 'object' ? (
      <ErrorText>{state.error}</ErrorText>
    ) : null;
  return body ? <View style={[styles.column, style]}>{body}</View> : null;
}

function StatusLine({ icon, text }: { icon: 'clock' | 'info' | 'check'; text: string }) {
  const p = usePalette();
  return (
    <View style={styles.statusLine}>
      <Icon name={icon} size={16} color={icon === 'check' ? p.primary : p.muted} style={styles.statusIcon} />
      <AppText variant="caption" tone={icon === 'check' ? 'ink' : 'muted'} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

/** The authenticated download of one ready export (§3.9); shared by Settings → Privacy and the "export ready" notice. */
export function DownloadExportButton({ uid, exportId, size = 'sm' }: { uid: string; exportId: string; size?: ButtonProps['size'] }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');
  const run = async () => {
    setState('working');
    try {
      await downloadExport(uid, exportId, t('settings.privacy.exportFileTitle'));
      setState('idle');
    } catch {
      setState('failed');
    }
  };
  return (
    <>
      <Button
        testID="export-download"
        label={t('settings.privacy.exportDownload')}
        variant="accent"
        icon="download"
        size={size}
        inline
        busy={state === 'working'}
        onPress={() => void run()}
      />
      {state === 'failed' ? <ErrorText>{t('settings.privacy.exportDownloadFailed')}</ErrorText> : null}
    </>
  );
}

export interface ExportStatusProps {
  readonly uid: string;
  readonly now?: number;
  /** Leave out the "being prepared" line (the caller already says so after a request). */
  readonly hidePending?: boolean;
  /** Style of the wrapper, drawn only when there is something to show. */
  readonly style?: StyleProp<ViewStyle>;
}

/** The newest export's state: being prepared, ready to download until it expires, or failed. */
export function ExportStatus({ uid, now = Date.now(), hidePending = false, style }: ExportStatusProps) {
  const { t } = useTranslation();
  const exports = useExports(uid);
  const latest = exports.data?.[0];
  if (!latest) return null;
  const expiresAt = latest.data.expiresAt.toMillis();
  if (expiresAt <= now) return null;
  switch (latest.data.status) {
    case 'pending':
      return hidePending ? null : (
        <View style={[styles.column, style]}>
          <StatusLine icon="clock" text={t('settings.privacy.exportPending')} />
        </View>
      );
    case 'failed':
      return (
        <View style={[styles.column, style]}>
          <ErrorText>{t('settings.privacy.exportFailed')}</ErrorText>
        </View>
      );
    case 'ready':
      return (
        <View style={[styles.column, style]}>
          <StatusLine icon="check" text={t('settings.privacy.exportReady', { when: formatDateTime(expiresAt, currentLocale()) })} />
          <DownloadExportButton uid={uid} exportId={latest.id} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { gap: Spacing.sm, alignItems: 'flex-start', alignSelf: 'stretch' },
  statusLine: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', alignSelf: 'stretch' },
  statusIcon: { marginTop: 1 },
});
