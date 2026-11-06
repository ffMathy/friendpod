import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, ErrorText, Loading, Text } from '@/components/ui';
import { useExports, useNotices } from '@/data/docs';
import { NoticeCard } from '@/features/notices/NoticeCard';
import { useUid } from '@/features/session/SessionProvider';
import { IconDot, PageLede, ShellPage } from '@/features/shell/parts';

/**
 * Messages from Grouper (§8.1 `notices`): statements of reasons for automated pauses and holds, report receipts,
 * "a member left", "your data is ready" and the inactivity warning, newest first. Each is kept for a year (TTL).
 */
export default function Notices() {
  const { t } = useTranslation();
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
    <ShellPage title={t('notices.title')} eyebrow={t('tabs.me')} testID="notices">
      <PageLede>{t('notices.lede')}</PageLede>
      {notices.error ? (
        <Card>
          <ErrorText>{t('common.loadFailed')}</ErrorText>
        </Card>
      ) : rows.length === 0 ? (
        <Card style={styles.empty} gap={14}>
          <IconDot icon="chat" tone="mint" size={40} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('notices.none')}</Text>
            <Text variant="caption" color="textMuted">
              {t('notices.noneBody')}
            </Text>
          </View>
        </Card>
      ) : (
        rows.map(({ id, data }) => (
          <NoticeCard
            key={id}
            uid={uid}
            notice={data}
            exportReady={typeof data.params.exportId === 'string' && ready.has(data.params.exportId)}
          />
        ))
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  empty: { flexDirection: 'row', alignItems: 'center' },
});
