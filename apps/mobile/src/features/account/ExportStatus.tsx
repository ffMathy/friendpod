import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Button, ErrorText, Icon, Text, type ButtonSize, type ButtonVariant } from '@/components/ui';
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
 * priv-delete's "Download my data first": a full-width 52 px white pill with the input border, a 20 px download icon,
 * 8 px and a 15/700 label. (Button's medium size draws its icon at 16 px.)
 */
export function ExportButton({ label, onPress, busy = false, testID, style }: ExportButtonProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.wide, { backgroundColor: pressed ? p.inset : p.surface, borderColor: p.borderStrong }, style]}
    >
      {busy ? (
        <ActivityIndicator color={p.text} />
      ) : (
        <>
          <Icon name="download" size={20} color={p.text} />
          <Text variant="heading" style={styles.wideLabel}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
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
  wide: {
    minHeight: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: BorderWidth.hairline,
    borderRadius: Radius.pill,
  },
  wideLabel: { flexShrink: 1, textAlign: 'center' },
});
