import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText } from '@/components/ui';
import { useExports } from '@/data/docs';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { downloadExport } from './exportDownload';

/** The authenticated download of one ready export (§3.9); shared by Settings → Privacy and the "export ready" notice. */
export function DownloadExportButton({ uid, exportId }: { uid: string; exportId: string }) {
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
      <Button testID="export-download" label={t('settings.privacy.exportDownload')} busy={state === 'working'} onPress={() => void run()} />
      {state === 'failed' ? <ErrorText>{t('settings.privacy.exportDownloadFailed')}</ErrorText> : null}
    </>
  );
}

/** The newest export's state: being prepared, ready to download until it expires, or failed. */
export function ExportStatus({ uid, now = Date.now() }: { uid: string; now?: number }) {
  const { t } = useTranslation();
  const exports = useExports(uid);
  const latest = exports.data?.[0];
  if (!latest) return null;
  const expiresAt = latest.data.expiresAt.toMillis();
  if (expiresAt <= now) return null;
  switch (latest.data.status) {
    case 'pending':
      return <Body muted>{t('settings.privacy.exportPending')}</Body>;
    case 'failed':
      return <ErrorText>{t('settings.privacy.exportFailed')}</ErrorText>;
    case 'ready':
      return (
        <>
          <Body>{t('settings.privacy.exportReady', { when: formatDateTime(expiresAt, currentLocale()) })}</Body>
          <DownloadExportButton uid={uid} exportId={latest.id} />
        </>
      );
  }
}
