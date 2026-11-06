import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Loading, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { usePodCards } from '@/data/docs';
import { PodRow } from '@/features/drop/PodRow';
import { useUid } from '@/features/session/SessionProvider';

const ACTIVE = new Set(['proposed', 'planning', 'scheduled', 'happened']);

/** Active and past pods (§11), as the "Your pods" rows of storyboard 2.1. */
export default function Pods() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const cards = usePodCards(uid);
  if (cards.isLoading) return <Loading label={t('common.loading')} />;
  const rows = (cards.data ?? []).filter((c) => c.data.myStatus === 'accepted' || c.data.myStatus === 'invited');
  const active = rows.filter((c) => ACTIVE.has(c.data.state));
  const past = rows.filter((c) => !ACTIVE.has(c.data.state));
  const open = (podId: string) => router.push({ pathname: '/pod/[podId]', params: { podId } });
  return (
    <Screen>
      <ScreenHeader title={t('tabs.pods')} />
      <View style={styles.section}>
        <SectionTitle title={t('pods.active')} />
        {active.length === 0 ? (
          <AppText variant="bodySm" tone="muted">
            {t('pods.noneActive')}
          </AppText>
        ) : null}
        {active.map((c) => (
          <PodRow key={c.id} uid={uid} podId={c.id} card={c.data} onPress={() => open(c.id)} />
        ))}
      </View>
      <View style={styles.section}>
        <SectionTitle title={t('pods.past')} />
        {past.length === 0 ? (
          <AppText variant="bodySm" tone="muted">
            {t('pods.nonePast')}
          </AppText>
        ) : null}
        {past.map((c) => (
          <PodRow key={c.id} uid={uid} podId={c.id} card={c.data} onPress={() => open(c.id)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
