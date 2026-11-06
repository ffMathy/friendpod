import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, ErrorText, Loading, Screen, ScreenHeader } from '@/components/ui';
import { useExports, useNotices } from '@/data/docs';
import { NoticeCard } from '@/features/notices/NoticeCard';
import { useUid } from '@/features/session/SessionProvider';
import { useBack } from '@/features/settings/useBack';

/**
 * Messages from Grouper (§8.1 `notices`): statements of reasons for automated pauses and holds, report receipts,
 * "a member left", "your data is ready" and the inactivity warning, newest first. Each is kept for a year (TTL).
 */
export default function Notices() {
  const { t } = useTranslation();
  const back = useBack('/me');
  const uid = useUid();
  const notices = useNotices(uid);
  const exports = useExports(uid);
  const [now] = useState(() => Date.now());
  if (notices.isLoading) return <Loading label={t('common.loading')} />;
  const ready = new Set(
    (exports.data ?? []).filter((e) => e.data.status === 'ready' && e.data.expiresAt.toMillis() > now).map((e) => e.id),
  );
  const rows = notices.data ?? [];
  return (
    <Screen gap={12}>
      <ScreenHeader title={t('notices.title')} backLabel={t('common.back')} onBack={back} />
      {notices.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
      {rows.length === 0 && !notices.error ? (
        <Banner tone="subtle" icon="chat">
          {t('notices.none')}
        </Banner>
      ) : null}
      {rows.map(({ id, data }) => (
        <NoticeCard
          key={id}
          uid={uid}
          notice={data}
          exportReady={typeof data.params.exportId === 'string' && ready.has(data.params.exportId)}
        />
      ))}
    </Screen>
  );
}
