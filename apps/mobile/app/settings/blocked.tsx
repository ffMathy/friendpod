import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BorderWidth, usePalette } from '@/components/theme';
import { Avatar, Button, Card, ErrorText, ListSection, Loading, Text } from '@/components/ui';
import { useBlocks } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useUid } from '@/features/session/SessionProvider';
import { formatDay, IconDot, PageLede, ShellPage } from '@/features/shell/parts';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Me → Blocked people: each with the first name the user saw in that pod (empty if it was never confirmed) and when,
 * as rows in a white list card (priv-settings); "Unblock" takes the block away at once. How to block someone is
 * said either way: in the empty card, or as a caption under the list.
 */
export default function Blocked() {
  const { t } = useTranslation();
  const p = usePalette();
  const blocks = useBlocks(useUid());
  const unblock = useCallable('unblockUser');
  if (blocks.isLoading) return <Loading label={t('common.loading')} />;
  const rows = blocks.data ?? [];
  const locale = currentLocale();
  return (
    <ShellPage title={t('settings.blocked.title')} eyebrow={t('tabs.me')} testID="blocked">
      <PageLede>{t('settings.blocked.lede')}</PageLede>
      {blocks.error ? (
        <Card>
          <ErrorText>{t('common.loadFailed')}</ErrorText>
        </Card>
      ) : rows.length === 0 ? (
        <Card style={styles.empty} gap={14}>
          <IconDot icon="block" tone="neutral" size={40} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('settings.blocked.none')}</Text>
            <Text variant="caption" color="textMuted">
              {t('settings.blocked.howTo')}
            </Text>
          </View>
        </Card>
      ) : (
        <ListSection>
          {rows.map(({ id, data }, i) => {
            const name = data.firstName || t('settings.blocked.unnamed');
            return (
              <View key={id} testID={`blocked-${id}`} style={[styles.row, i < rows.length - 1 ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null]}>
                <Avatar size={32} name={data.firstName || '?'} seed={id} />
                <View style={styles.flex}>
                  <Text variant="rowTitle">{name}</Text>
                  <Text variant="caption" color="textMuted">
                    {t('settings.blocked.since', { date: formatDay(data.since.toMillis(), locale) })}
                  </Text>
                </View>
                <Button
                  label={t('settings.blocked.unblock')}
                  accessibilityLabel={t('settings.blocked.unblockName', { name })}
                  variant="outline"
                  size="xs"
                  busy={unblock.isPending && unblock.variables.uid === id}
                  onPress={() => unblock.mutate({ uid: id })}
                />
              </View>
            );
          })}
        </ListSection>
      )}
      {rows.length > 0 && !blocks.error ? (
        <Text variant="caption" color="textMuted" testID="blocked-how-to">
          {t('settings.blocked.howTo')}
        </Text>
      ) : null}
      {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  empty: { flexDirection: 'row', alignItems: 'center' },
  // priv-settings' list rows: min 56, 12 px gap.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
});
