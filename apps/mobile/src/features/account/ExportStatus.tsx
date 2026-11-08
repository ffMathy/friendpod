import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, ErrorText, Text, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { useExports } from '@/data/docs';
import { toAppError } from '@/firebase/callables';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { requestDataExport } from './account';
import { downloadExport } from './exportDownload';

export interface DownloadExportButtonProps {
  readonly uid: string;
  readonly exportId: string;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
  /** Default "Download the file". */
  readonly label?: string;
  /** Draw it as the wide `ExportButton` (priv-delete) instead of a `Button`; `size` and `variant` are then unused. */
  readonly wide?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/** The authenticated download of one ready export (§3.9); shared by Settings → Privacy and the "export ready" notice. */
export function DownloadExportButton({ uid, exportId, size = 'lg', variant = 'primary', label, wide = false, style }: DownloadExportButtonProps) {
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
  const text = label ?? t('settings.privacy.exportDownload');
  return (
    <>
      {wide ? (
        <ExportButton testID="export-download" label={text} style={style} busy={state === 'working'} onPress={() => void run()} />
      ) : (
        <Button
          testID="export-download"
          icon="download"
          size={size}
          variant={variant}
          label={text}
          style={style}
          busy={state === 'working'}
          onPress={() => void run()}
        />
      )}
      {state === 'failed' ? <ErrorText>{t('settings.privacy.exportDownloadFailed')}</ErrorText> : null}
    </>
  );
}

export interface ExportButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * priv-delete's "Download my data first": the full-width 48 px secondary button (white, 1.5 px Outline, Ink 16/700)
 * with the download icon.
 */
export function ExportButton({ label, onPress, busy = false, testID, style }: ExportButtonProps) {
  return <Button testID={testID} variant="secondary" size="md" fullWidth icon="download" label={label} busy={busy} onPress={onPress} style={style} />;
}

/** The newest export while it has not expired (a file past `expiresAt` is gone or about to be). */
export function useLatestExport(uid: string, now = Date.now()) {
  const latest = useExports(uid).data?.[0];
  return latest && latest.data.expiresAt.toMillis() > now ? latest : null;
}

/** The newest export's state: being prepared, ready to download until it expires (`hideAction`: without its button), or failed. */
export function ExportStatus({ uid, now, hideAction = false }: { uid: string; now?: number; hideAction?: boolean }) {
  const { t } = useTranslation();
  const latest = useLatestExport(uid, now);
  if (!latest) return null;
  const expiresAt = latest.data.expiresAt.toMillis();
  switch (latest.data.status) {
    case 'pending':
      return (
        <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          {t('settings.privacy.exportPending')}
        </Text>
      );
    case 'failed':
      return <ErrorText>{t('settings.privacy.exportFailed')}</ErrorText>;
    case 'ready':
      return (
        <View style={styles.ready}>
          <Text variant="caption" color="textSecondary">
            {t('settings.privacy.exportReady', { when: formatDateTime(expiresAt, currentLocale()) })}
          </Text>
          {hideAction ? null : <DownloadExportButton uid={uid} exportId={latest.id} size="sm" />}
        </View>
      );
  }
}

export type ExportRequestState = 'idle' | 'working' | 'requested' | 'linkSent' | { readonly error: string };

/**
 * "Download my data" (§3.9): re-authenticates, then asks for the export. For email-link accounts the re-authentication
 * is a sign-in link instead, and the request is made again after it. Shared by Privacy and Delete account.
 */
export function useRequestExport() {
  const { t } = useTranslation();
  const [state, setState] = useState<ExportRequestState>('idle');
  const request = async () => {
    setState('working');
    try {
      const outcome = await requestDataExport();
      setState(outcome.kind === 'done' ? 'requested' : 'linkSent');
    } catch (e) {
      setState({ error: t(errorMessageKey(toAppError(e))) });
    }
  };
  return { state, request };
}

/** What happened to the request: preparing, a sign-in link was sent, or why it failed. */
export function ExportRequestStatus({ state }: { state: ExportRequestState }) {
  const { t } = useTranslation();
  if (typeof state === 'object') return <ErrorText>{state.error}</ErrorText>;
  if (state === 'requested' || state === 'linkSent') {
    return (
      <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
        {state === 'requested' ? t('settings.privacy.exportRequested') : t('settings.reauthLinkSent')}
      </Text>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  ready: { gap: 8, alignItems: 'flex-start' },
});
