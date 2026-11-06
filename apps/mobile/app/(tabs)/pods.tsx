import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, ErrorText, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { usePodCards } from '@/data/docs';
import { useTabTopPadding } from '@/features/drop/layout';
import { TabTitle } from '@/features/drop/parts';
import { PodRow } from '@/features/drop/PodRow';
import { useNow } from '@/features/drop/time';
import { useUid } from '@/features/session/SessionProvider';

const ACTIVE = new Set(['proposed', 'planning', 'scheduled', 'happened']);

/** Active and past pods (§11), as rows like "Your pods" on Home: initials, theme in the viewer's wording, status. */
export default function Pods() {
  const { t } = useTranslation();
  const uid = useUid();
  const cards = usePodCards(uid);
  const now = useNow();
  const top = useTabTopPadding();
  const hideHeader = <Tabs.Screen options={{ headerShown: false }} />;
  if (cards.isLoading) {
    return (
      <>
        {hideHeader}
        <Loading label={t('common.loading')} />
      </>
    );
  }
  const rows = (cards.data ?? []).filter((c) => c.data.myStatus === 'accepted' || c.data.myStatus === 'invited');
  const active = rows.filter((c) => ACTIVE.has(c.data.state));
  const past = rows.filter((c) => !ACTIVE.has(c.data.state));

  return (
    <Screen safeTop gutter="compact" gap={24} contentStyle={{ paddingTop: top }}>
      {hideHeader}
      <TabTitle title={t('tabs.pods')} />
      {cards.error ? (
        <Card>
          <ErrorText>{t('common.loadFailed')}</ErrorText>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState title={t('pods.emptyTitle')} body={t('pods.emptyBody')} />
      ) : (
        <>
          <View style={styles.section}>
            <SectionHeader title={t('pods.active')} count={active.length > 0 ? String(active.length) : undefined} />
            {active.length === 0 ? (
              <Text variant="small" color="textMuted">
                {t('pods.noneActive')}
              </Text>
            ) : null}
            {active.map((c) => (
              <PodRow key={c.id} uid={uid} card={c} now={now} />
            ))}
          </View>
          <View style={styles.section}>
            <SectionHeader title={t('pods.past')} count={past.length > 0 ? String(past.length) : undefined} />
            {past.length === 0 ? (
              <Text variant="small" color="textMuted">
                {t('pods.nonePast')}
              </Text>
            ) : null}
            {past.map((c) => (
              <PodRow key={c.id} uid={uid} card={c} now={now} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
