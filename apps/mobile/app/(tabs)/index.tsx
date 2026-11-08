import {
  ACTIVE_POD_STATES,
  dropSchedule,
  getLaunchArea,
  getMatchingProfile,
  isWaitlisted,
  nextDropWeek,
  weekIdAt,
  type MatchingProfileId,
  type PodCardDoc,
  type PodState,
  type UserDoc,
} from '@grouper/core';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, ErrorText, Icon, Loading, Screen, Text, TextLink } from '@/components/ui';
import { Layout, usePalette } from '@/components/theme';
import { useAreaDoc, useInterests, usePodCards, useUserDoc } from '@/data/docs';
import type { WithId } from '@/data/live';
import { useTabTopPadding } from '@/features/drop/layout';
import { MatchOnCard } from '@/features/drop/MatchOnCard';
import { NextDropField, ParticipationActions } from '@/features/drop/NextDropCard';
import { NoPodCard } from '@/features/drop/NoPodCard';
import { SectionTitle, TabTitle } from '@/features/drop/parts';
import { PodRow } from '@/features/drop/PodRow';
import { clock, useNow, weekday, weekNumber } from '@/features/drop/time';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { WaitlistScreen } from '@/features/waitlist/WaitlistScreen';
import { currentLocale } from '@/i18n';

/**
 * "This week" (§3.2). Three states, each with its own storyboard:
 * - after the drop with a proposal: "Your weekly drop" with the proposal card in the pod's tint (drop-proposal; quiet
 *   white and Ink for a private interest, priv-sensitive), or "3 of 5 said yes" with lit seats once the viewer is in
 *   (drop-waiting);
 * - after the drop without one: "No pod for you this week", the reason and tips, in a calm card (drop-none);
 * - otherwise the ritual (drop-home): the Thursday drop on the Skov poster field with the countdown on its foot, then
 *   skip or pause, what we match on (pod chips) and the viewer's pods.
 * While the user's launch area is not live, Home is the per-city waitlist screen instead (§3.1 step 13), on every
 * open, until `areas/{areaId}.status` turns live (a live read, so it switches without a restart).
 */
export default function ThisWeek() {
  const { t } = useTranslation();
  const uid = useUid();
  const user = useUserDoc(uid);
  const cards = usePodCards(uid);
  const areaId = user.data?.area.areaId ?? null;
  const area = useAreaDoc(areaId);
  const hideHeader = <Tabs.Screen options={{ headerShown: false }} />;
  if (user.isLoading || cards.isLoading || (areaId !== null && area.isLoading)) {
    return (
      <>
        {hideHeader}
        <Loading label={t('common.loading')} />
      </>
    );
  }

  const locale = currentLocale();
  const launchArea = areaId ? getLaunchArea(areaId) : null;
  const status = area.data?.status ?? launchArea?.status ?? null;
  if (areaId && launchArea && isWaitlisted(status)) {
    return (
      <WaitlistScreen
        areaId={areaId}
        city={area.data?.label[locale] ?? launchArea.label[locale]}
        count={area.data?.waitlistCount ?? 0}
        goal={area.data?.goal.waitlist ?? launchArea.goal.waitlist}
      />
    );
  }
  if (!user.data || cards.error) {
    return (
      <HomeScreen title={t('home.title')} now={Date.now()}>
        {hideHeader}
        <Card>
          <ErrorText>{t('common.loadFailed')}</ErrorText>
        </Card>
      </HomeScreen>
    );
  }
  return (
    <>
      {hideHeader}
      <Home uid={uid} user={user.data} cards={cards.data ?? []} profileId={area.data?.profile ?? launchArea?.profile ?? null} />
    </>
  );
}

function HomeScreen({ title, now, children }: { title: string; now: number; children: ReactNode }) {
  const { t } = useTranslation();
  const top = useTabTopPadding();
  return (
    <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }}>
      <TabTitle title={title} meta={t('home.week', { week: weekNumber(now) })} />
      {children}
    </Screen>
  );
}

function Home({ uid, user, cards, profileId }: { uid: string; user: UserDoc; cards: readonly WithId<PodCardDoc>[]; profileId: MatchingProfileId | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const now = useNow();
  const interests = useInterests(uid);
  // Waiting cards the viewer has acknowledged with "Okay" in this session: they move to "Your pods".
  const [acknowledged, setAcknowledged] = useState<readonly string[]>([]);
  const locale = currentLocale();
  const profile = getMatchingProfile(profileId ?? 'launch');
  const confirmationMin = profileId ? profile.defaults.confirmationMin : undefined;

  const proposed = cards.filter((c) => c.data.state === 'proposed');
  // Open invitations (a backfill can invite into a pod that is already planning or scheduled), and pods the viewer
  // said yes to that are still waiting for the others.
  const proposals = cards.filter(
    (c) =>
      (c.data.myStatus === 'invited' && RESPONDABLE.has(c.data.state)) ||
      (c.data.state === 'proposed' && c.data.myStatus === 'accepted' && !acknowledged.includes(c.id)),
  );
  if (proposals.length > 0) {
    return (
      <HomeScreen title={t('home.titleDrop')} now={now}>
        {proposals.some((c) => c.data.themeSensitive) ? <ScreenCaptureGuard /> : null}
        {proposals.map((c) => (
          <View key={c.id} style={styles.proposal}>
            <ProposalCard podId={c.id} card={c.data} confirmationMin={confirmationMin} onDone={() => setAcknowledged((ids) => [...ids, c.id])} />
          </View>
        ))}
      </HomeScreen>
    );
  }

  // The no-pod answer stands from Thursday's release to the end of that week; from Monday the next drop is ahead.
  const last = user.lastDrop;
  if (last?.outcome === 'unmatched' && last.weekId === weekIdAt(now)) {
    const nextRelease = dropSchedule(nextDropWeek(now)).releaseAt;
    return (
      <HomeScreen title={t('home.title')} now={now}>
        <NoPodCard reason={last.reason} prefs={user.prefs} />
        {/* Not a needs-you: there is nothing to do but wait. */}
        <View style={styles.nextDrop}>
          <Icon name="clock" size={14} strokeWidth={2.2} color={p.textMuted} />
          <Text variant="captionStrong" color="textMuted">
            {t('home.nextDropAt', { day: weekday(nextRelease, locale), time: clock(nextRelease, locale) })}
          </Text>
        </View>
      </HomeScreen>
    );
  }

  const active = cards.filter((c) => c.data.myStatus === 'accepted' && ACTIVE_POD_STATES.includes(c.data.state));
  const waiting = proposed.filter((c) => c.data.myStatus === 'accepted' && acknowledged.includes(c.id));
  const mine = [...waiting, ...active];
  const howMatching = () => router.push('/info/how-matching-works');
  return (
    // The poster field runs full-bleed from the top edge and brings its own safe-area inset.
    <Screen gutter="none" gap={0} contentStyle={styles.fieldPage}>
      <NextDropField title={t('home.title')} week={t('home.week', { week: weekNumber(now) })} user={user} now={now} onPress={howMatching} />
      <View style={styles.below}>
        <ParticipationActions user={user} now={now} />
        <MatchOnCard interests={interests.data} prefs={user.prefs} areaLabel={user.area.label} />
        {mine.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={t('home.yourPods')} count={t('home.activeCount', { active: active.length, max: profile.params.maxActivePods })} />
            {mine.map((c) => (
              <PodRow key={c.id} uid={uid} card={c} now={now} />
            ))}
          </View>
        ) : null}
        <TextLink align="center" label={t('home.howMatching')} onPress={howMatching} />
      </View>
    </Screen>
  );
}

/** Pod states in which an invitation can still be answered (respondToPod). */
const RESPONDABLE: ReadonlySet<PodState> = new Set<PodState>(['proposed', 'planning', 'scheduled']);

const styles = StyleSheet.create({
  proposal: { gap: 16 },
  section: { gap: 10 },
  nextDrop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fieldPage: { paddingTop: 0 },
  // Under the foot: 14 px, then the blocks 14 px apart (spec §8, drop-home).
  below: { paddingHorizontal: Layout.gutterCompact, paddingTop: 14, gap: 14 },
});
