import {
  ACTIVE_POD_STATES,
  dropSchedule,
  getLaunchArea,
  getMatchingProfile,
  isWaitlisted,
  latestReleasedDropWeek,
  nextDropWeek,
  type PodCardDoc,
  type PodState,
} from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Loading, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useAreaDoc, usePodCards, useUserDoc } from '@/data/docs';
import { formatWeekdayTime, weekNumber } from '@/features/drop/format';
import { MatchOnCard } from '@/features/drop/MatchOnCard';
import { NextDropCard } from '@/features/drop/NextDropCard';
import { NoPodCard } from '@/features/drop/NoPodCard';
import { PodRow } from '@/features/drop/PodRow';
import { UnderlineLink } from '@/features/drop/UnderlineLink';
import { useNow } from '@/features/drop/useNow';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { WaitlistScreen } from '@/features/waitlist/WaitlistScreen';
import { currentLocale } from '@/i18n';

/** Confirmed pods that belong on This week: still being planned, scheduled, or met and awaiting feedback. */
const CONFIRMED_THIS_WEEK: ReadonlySet<PodState> = new Set<PodState>(['planning', 'scheduled', 'happened']);

/**
 * "This week" (§3.2; storyboards 2.1–2.5, 5.1). In order of precedence:
 *   - open proposals: "Your weekly drop" with the proposal card(s), then any confirmed pods as "Your pods" rows;
 *   - confirmed pods (planning, scheduled, happened): the 2.1 layout, i.e. the next drop hero with Skip / Pause, what
 *     we'll match on, then "Your pods · n of m active" with a row per pod opening the pod page (so a user with a pod
 *     never sees "No pod", even if they were unmatched in the latest drop);
 *   - unmatched in the latest drop: "No pod for you this week" with the reason and what often helps;
 *   - otherwise the next drop, whether the user is in it, and what we'll match on.
 * While the user's launch area is not live, Home is the per-city waitlist screen instead (§3.1 step 13), on every open,
 * until `areas/{areaId}.status` turns live (a live read, so it switches without a restart).
 */
export default function ThisWeek() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const user = useUserDoc(uid);
  const cards = usePodCards(uid);
  const areaId = user.data?.area.areaId ?? null;
  const area = useAreaDoc(areaId);
  const now = useNow();
  if (user.isLoading || cards.isLoading || (areaId !== null && area.isLoading)) return <Loading label={t('common.loading')} />;

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

  const u = user.data ?? null;
  const profileId = area.data?.profile ?? launchArea?.profile;
  const profile = profileId ? getMatchingProfile(profileId) : null;
  const all = cards.data ?? [];
  const proposals = all.filter((c) => c.data.state === 'proposed' && (c.data.myStatus === 'invited' || c.data.myStatus === 'accepted'));
  const confirmed = all.filter((c) => c.data.myStatus === 'accepted' && CONFIRMED_THIS_WEEK.has(c.data.state));
  const activeCount = confirmed.filter((c) => ACTIVE_POD_STATES.includes(c.data.state)).length;
  const full = profile !== null && activeCount >= profile.params.maxActivePods;
  const lastDrop = u?.lastDrop ?? null;
  // The latest drop's outcome only: an older "unmatched" (say, before a skip or pause) is not this week's news.
  const unmatched = lastDrop?.outcome === 'unmatched' && lastDrop.weekId === latestReleasedDropWeek(now);
  const reason = unmatched ? lastDrop?.reason : undefined;
  const week = t('home.week', { week: weekNumber(now) });
  const nextDropLine = (
    <AppText variant="bodySm" tone="muted" align="center">
      {t('home.nextDrop', { when: formatWeekdayTime(dropSchedule(nextDropWeek(now)).releaseAt, locale, 'long') })}
    </AppText>
  );
  // The small underlined link closing the screen (2.1), the screen's 16-pt gap below the last card.
  const howMatching = (
    <UnderlineLink label={t('info.howMatchingWorks.title')} size="sm" onPress={() => router.push('/info/how-matching-works')} testID="home-how-matching" />
  );
  // "Your pods · 1 of 2 active" and a row per confirmed pod (storyboard 2.1), each opening the pod page.
  const yourPods = (pods: readonly { id: string; data: PodCardDoc }[]) => (
    <View style={styles.section}>
      <SectionTitle
        title={t('home.yourPods')}
        detail={profile ? t('home.activeOf', { count: activeCount, max: profile.params.maxActivePods }) : undefined}
      />
      {pods.map((c) => (
        <View key={c.id} testID={`home-pod-${c.id}`}>
          <PodRow
            uid={uid}
            podId={c.id}
            card={c.data}
            // The pod page is in the Pods tab (storyboards 3.1, 3.4): this switches to it, with the Pods list underneath.
            onPress={() => router.push({ pathname: '/pod/[podId]', params: { podId: c.id } }, { withAnchor: true })}
            testID={`home-open-pod-${c.id}`}
          />
        </View>
      ))}
    </View>
  );

  // The same sensitive-themed proposal and pod cards that the pod page guards (PRIVACY.md §4.3 Copying).
  const guard = [...proposals, ...confirmed].some((c) => c.data.themeSensitive) ? <ScreenCaptureGuard /> : null;

  if (proposals.length > 0) {
    return (
      <Screen>
        {guard}
        <ScreenHeader title={t('home.dropTitle')} meta={week} />
        {proposals.map((c) => (
          <ProposalCard key={c.id} podId={c.id} card={c.data} confirmationMin={profile?.defaults.confirmationMin} />
        ))}
        {confirmed.length > 0 ? yourPods(confirmed) : null}
      </Screen>
    );
  }

  if (!u) {
    // No profile to show (it is being deleted): just the next drop.
    return (
      <Screen>
        <ScreenHeader title={t('tabs.thisWeek')} meta={week} />
        {nextDropLine}
      </Screen>
    );
  }

  if (confirmed.length > 0) {
    return (
      <Screen>
        {guard}
        <ScreenHeader title={t('tabs.thisWeek')} meta={week} />
        <NextDropCard user={u} now={now} full={full} />
        <MatchOnCard uid={uid} user={u} />
        {yourPods(confirmed)}
        {howMatching}
      </Screen>
    );
  }

  if (unmatched) {
    return (
      <Screen>
        <ScreenHeader title={t('tabs.thisWeek')} meta={week} />
        <NoPodCard user={u} reason={reason} />
        {nextDropLine}
        {howMatching}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('tabs.thisWeek')} meta={week} />
      <NextDropCard user={u} now={now} full={full} />
      <MatchOnCard uid={uid} user={u} />
      {howMatching}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
