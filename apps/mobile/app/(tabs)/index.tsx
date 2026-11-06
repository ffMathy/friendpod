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
import { Card, ErrorText, Loading, Screen, Text } from '@/components/ui';
import { useAreaDoc, useInterests, usePodCards, useUserDoc } from '@/data/docs';
import type { WithId } from '@/data/live';
import { useTabTopPadding } from '@/features/drop/layout';
import { MatchOnCard } from '@/features/drop/MatchOnCard';
import { NextDropCard } from '@/features/drop/NextDropCard';
import { NoPodCard } from '@/features/drop/NoPodCard';
import { SmallLink, TabTitle } from '@/features/drop/parts';
import { PodRow } from '@/features/drop/PodRow';
import { clock, useNow, weekday, weekNumber } from '@/features/drop/time';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { WaitlistScreen } from '@/features/waitlist/WaitlistScreen';
import { currentLocale } from '@/i18n';

/**
 * "This week" (§3.2). Three states, each with its own storyboard:
 * - after the drop with a proposal: "Your weekly drop" with the proposal card (drop-proposal, priv-sensitive), or
 *   "3 of 5 said yes" once the viewer is in (drop-waiting);
 * - after the drop without one: "No pod for you this week", the reason and tips (drop-none);
 * - otherwise: the next drop with a countdown, skip or pause, what we match on, and the viewer's pods (drop-home).
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
        <Text variant="small" color="textMuted" align="center" style={styles.nextDrop}>
          {t('home.nextDropAt', { day: weekday(nextRelease, locale), time: clock(nextRelease, locale) })}
        </Text>
      </HomeScreen>
    );
  }

  const active = cards.filter((c) => c.data.myStatus === 'accepted' && ACTIVE_POD_STATES.includes(c.data.state));
  const waiting = proposed.filter((c) => c.data.myStatus === 'accepted' && acknowledged.includes(c.id));
  const mine = [...waiting, ...active];
  return (
    <HomeScreen title={t('home.title')} now={now}>
      <NextDropCard user={user} now={now} />
      <MatchOnCard interests={interests.data} prefs={user.prefs} areaLabel={user.area.label} />
      {mine.length > 0 ? (
        <View style={styles.section}>
          {/* As tall as its text, like the storyboard's h2 (SectionHeader keeps a 24 px row for a trailing action). */}
          <Text accessibilityRole="header" variant="heading" style={styles.sectionTitle}>
            {`${t('home.yourPods')} `}
            <Text variant="heading" weight="500" color="textMuted" style={styles.sectionTitle}>
              {`· ${t('home.activeCount', { active: active.length, max: profile.params.maxActivePods })}`}
            </Text>
          </Text>
          {mine.map((c) => (
            <PodRow key={c.id} uid={uid} card={c} now={now} />
          ))}
        </View>
      ) : null}
      <SmallLink label={t('home.howMatching')} onPress={() => router.push('/info/how-matching-works')} />
    </HomeScreen>
  );
}

/** Pod states in which an invitation can still be answered (respondToPod). */
const RESPONDABLE: ReadonlySet<PodState> = new Set<PodState>(['proposed', 'planning', 'scheduled']);

const styles = StyleSheet.create({
  proposal: { gap: 16 },
  section: { gap: 10 },
  // 15 px at the font's natural line height (1.26), as the storyboard sets none; the muted part too, or its own
  // 20 px line box would make the row a pixel taller.
  sectionTitle: { lineHeight: 19 },
  // 14 px at the font's natural line height.
  nextDrop: { lineHeight: 18 },
});
