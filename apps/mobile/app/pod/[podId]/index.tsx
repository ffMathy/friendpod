import {
  feedbackClosesAt,
  firstAttendanceAsk,
  getLaunchArea,
  getMatchingProfile,
  HOUR_MS,
  meetupTimers,
  podNextStep,
  type AttendanceStatus,
  type Locale,
  type PodDoc,
} from '@friendpod/core';
import type { TFunction } from 'i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Banner, Button, ErrorText, Icon, Loading, StatusText, Switch, Text, UnreadBadge } from '@/components/ui';
import { BorderWidth, Radius, useColorSchemeName, usePalette, usePodColors } from '@/components/theme';
import { useAreaDoc, usePod, usePodCard, usePodOptions, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useChatSeenAt, unreadCount } from '@/features/chat/readMarker';
import { TabTitle } from '@/features/drop/parts';
import { weekNumber } from '@/features/drop/time';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useChatStatus, type ChatStatus } from '@/features/chat/window';
import { AttendanceCard } from '@/features/pods/AttendanceCard';
import { podColorOf } from '@/features/pods/color';
import { planningDeadlineAsk } from '@/features/pods/deadline';
import { useFeedbackSent } from '@/features/pods/feedbackSent';
import { LockedPlan, PlanCardHeader } from '@/features/pods/LockedPlan';
import { isConfirmedMember } from '@/features/pods/membership';
import { CardButton, NextStepCard, PodCard, PodMenu, PodPage, PodPageBand, PodTopBar, SafetyCard } from '@/features/pods/parts';
import { AboutMembersCard, MembersCard, PodInterestsCard, podMembers } from '@/features/pods/PodMembers';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { Reveal } from '@/features/pods/Reveal';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { meetupWhen, relativeMeetup, weekdayAt } from '@/features/pods/time';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import type { PodColor } from '@/lib/podColor';

/** When "Still coming?" is first asked, from the same timers the server uses (D5); null until the plan locks. */
function attendanceAskedAt(pod: PodDoc): number | null {
  const meetupAt = pod.planning.meetupAt?.toMillis();
  const lockedAt = pod.planning.planLockedAt?.toMillis();
  if (meetupAt === undefined || lockedAt === undefined) return null;
  return firstAttendanceAsk(meetupTimers(meetupAt, lockedAt));
}

/**
 * A pod (§3.4, D13), on the Pods tab (its tab bar at the foot), in direction E where colour grows with commitment.
 * Before confirmation: the proposal card under the drop's header, "Your weekly drop · Week 46", as on This week
 * (drop-proposal, drop-waiting, priv-sensitive). While planning: the reveal (pod-confirmed), the pod's base colour as a
 * poster field with every member on its foot, what more than one of them likes, "Meeting safely", and "Plan the
 * meetup" with the viewer's deadline as the one next step. From the locked plan on (pod-scheduled): the calm pod band
 * in the pod's tint, one "Next step" card driven by state (confirm attendance → chat during the window → give
 * feedback), then Plan, Chat and Members and nothing more (the pod interests belong to the reveal). Once the meetup is
 * past, the Plan card is a plain record of when and where. "Leave pod" and the safety tips are in the pod menu (§3.8);
 * block and report live in each member's sheet. The colour comes from the theme word on the viewer's card; a pod about a private
 * interest has none (white and Ink with a lock).
 */
export default function PodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const options = usePodOptions(podId, member && card.data?.state === 'planning');
  const chat = useChatStatus(pod.data);
  // Messages exist only from the window on: read them for "3 new" while open, and to keep the row while they last.
  const messages = useChatMessages(uid, podId, member && chat !== null && chat.kind !== 'upcoming');
  const seen = useChatSeenAt(podId);
  const feedbackSent = useFeedbackSent(podId);
  // Before confirmation only: the area's matching profile says how many yes votes confirm a pod ("4 needed").
  const user = useUserDoc(card.data && !member ? uid : null);
  const areaId = user.data?.area.areaId ?? null;
  const area = useAreaDoc(areaId);
  const leave = useCallable('leavePod');
  const sharePhoto = useCallable('setPhotoSharing');
  const [now] = useState(() => Date.now());
  const locale = currentLocale();

  // A member's page waits for the shared pod document too: it carries the members, the plan and the pod interests.
  if (card.isLoading || (member && pod.isLoading)) {
    return <Loading label={t('common.loading')} />;
  }
  if (!card.data) {
    return (
      <PodPage tabBar top={32}>
        <PodTopBar />
        <Text variant="body" color="textSecondary">
          {t('pod.gone')}
        </Text>
      </PodPage>
    );
  }
  const c = card.data;
  const guard = c.themeSensitive ? <ScreenCaptureGuard /> : null;
  if (!member) {
    const profileId = area.data?.profile ?? (areaId ? getLaunchArea(areaId)?.profile : undefined);
    return (
      <PodPage tabBar top={32} gap={16}>
        {guard}
        <PodTopBar />
        {/* The drop's header, as This week draws it over the same card; the card itself names the theme. */}
        <TabTitle title={t('home.titleDrop')} meta={t('home.week', { week: weekNumber(c.acceptBy.toMillis()) })} />
        <ProposalCard podId={podId} card={c} {...(profileId ? { confirmationMin: getMatchingProfile(profileId).defaults.confirmationMin } : {})} />
      </PodPage>
    );
  }

  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const d = pod.data;
  const color = podColorOf(podId, c);
  const members = d ? podMembers(d.memberUids, d.roster, uid) : [];
  const interests = d ? d.podInterests[locale] : [];
  const subtitle = t('pod.peopleNear', { count: d?.memberUids.length ?? c.acceptedCount, area: d?.areaLabel ?? c.areaLabel });
  const meetupAt = d?.planning.meetupAt?.toMillis() ?? null;
  const mine: AttendanceStatus | null = d?.attendance?.[uid] ?? null;
  const step = d
    ? podNextStep({
        state: d.state,
        now,
        votedOnAllOptions: (options.data ?? []).every((o) => o.data.votes[uid] !== undefined),
        // Unknown while the options load: no "add an option" step flashes before they arrive.
        optionCount: options.data?.length ?? (d.state === 'planning' ? 1 : 0),
        extended: d.planning.extended === true,
        meetupAt,
        myAttendance: mine,
        attendanceAskedAt: attendanceAskedAt(d),
        // Past the 7-day window there is nothing left to give.
        feedbackGiven: feedbackSent || (meetupAt !== null && now > feedbackClosesAt(meetupAt + 2 * HOUR_MS)),
      })
    : null;

  const rows = messages.data ?? [];
  const unread = chat?.kind === 'open' ? unreadCount(rows, uid, seen) : 0;
  const chatRow = chatEntry(t, chat, rows.length > 0, locale);

  const go = (pathname: '/pod/[podId]/plan' | '/pod/[podId]/chat' | '/pod/[podId]/feedback') => router.push({ pathname, params: { podId } });
  // §3.8: from the pod menu, after a confirmation there; an archived pod has nothing left to leave.
  const menu = (menuColor?: string) => (
    <PodMenu {...(c.state !== 'archived' ? { onLeave: () => leave.mutate({ podId }, { onSuccess: () => router.back() }) } : {})} {...(menuColor ? { color: menuColor } : {})} />
  );
  const leaveError = leave.error ? <ErrorText>{t(errorMessageKey(leave.error))}</ErrorText> : null;

  // The Chat row (pod-scheduled): the pod-tint disc with the chat icon, "Chat", its window, the Ink unread badge.
  const chatCard = chatRow ? (
    <Pressable
      onPress={() => go('/pod/[podId]/chat')}
      accessibilityRole="link"
      accessibilityLabel={[t('pod.sections.chat'), chatRow, unread > 0 ? t('pod.newMessages', { count: unread }) : null].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.chatRow, { backgroundColor: pressed ? p.page : p.surface, borderColor: p.border }]}
      testID="pod-chat-row"
    >
      <ChatDisc color={color} />
      <View style={styles.chatText}>
        <Text variant="heading" style={styles.chatTitle}>
          {t('pod.sections.chat')}
        </Text>
        <Text variant="captionStrong" weight="400" color="textMuted">
          {chatRow}
        </Text>
      </View>
      {/* The badge pins itself to the top of a row; centred on the row as the storyboard draws it. */}
      {unread > 0 ? (
        <View style={styles.unread}>
          <UnreadBadge label={t('pod.newMessages', { count: unread })} />
        </View>
      ) : null}
    </Pressable>
  ) : null;

  // S6: in a pod about a private interest, the viewer's photo stays hidden until they share it.
  const photoSwitch = c.themeSensitive ? (
    <>
      <Switch
        label={t('pod.showMyPhoto')}
        description={t('pod.showMyPhotoHint')}
        value={c.photoShared === true}
        disabled={sharePhoto.isPending}
        onChange={(share) => sharePhoto.mutate({ podId, share })}
      />
      {sharePhoto.error ? <ErrorText>{t(errorMessageKey(sharePhoto.error))}</ErrorText> : null}
    </>
  ) : null;

  // ------------------------------------------------------------------ planning: the reveal (pod-confirmed)
  if (c.state === 'planning' && (!d || d.state === 'planning')) {
    const deadline = d ? d.planning.deadline.toMillis() : null;
    const when = deadline === null ? null : weekdayAt(t, deadline, locale);
    // The viewer's own deadline is a needs-you pill (decision 2): pick a first time, or vote. Once they have voted on
    // every option there is nothing left for them to do, so the closing time is a quiet status (the plan page follows
    // the same rule, deadline.ts).
    const ask = planningDeadlineAsk((options.data ?? []).map((o) => o.data.votes), uid);
    const deadlineLine =
      when === null ? null : ask === 'pickTime' ? (
        <Badge testID="deadline-needs-you" tone="needsYou" label={t('pod.pickTimeBy', { when })} />
      ) : ask === 'vote' ? (
        <Badge testID="deadline-needs-you" tone="needsYou" label={t('pod.voteBy', { when })} />
      ) : (
        <StatusText testID="deadline-quiet" icon="clock" label={t('plan.votingCloses', { when })} />
      );
    return (
      <PodPage
        tabBar
        top={14}
        gap={14}
        hero={<Reveal podId={podId} theme={theme} color={color} subtitle={subtitle} members={members} viewer={uid} menu={menu} />}
        footer={
          <>
            <Button testID={step ? 'next-step' : 'open-planner'} label={t('pod.planTheMeetup')} variant="primary" onPress={() => go('/pod/[podId]/plan')} />
            {deadlineLine ? <View style={styles.deadline}>{deadlineLine}</View> : null}
          </>
        }
      >
        {guard}
        {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
        {d?.planning.extended ? (
          <Banner tone="needsYou" icon="clock" title={t('plan.extendedTitle')} alert>
            {t('plan.extendedBody', { when: weekdayAt(t, d.planning.deadline.toMillis(), locale) })}
          </Banner>
        ) : null}
        {photoSwitch}
        <AboutMembersCard members={members} viewer={uid} color={color} />
        <PodInterestsCard interests={interests} color={color} />
        <SafetyCard />
        {chatCard}
        {leaveError}
      </PodPage>
    );
  }

  // ------------------------------------------------------------------ from the locked plan on (pod-scheduled)
  const place = d?.planning.place ?? null;
  // The meetup has started, or the pod has moved on: no map, safety or calendar actions on a plan that has been.
  const past = (meetupAt !== null && now >= meetupAt) || d?.state === 'happened' || d?.state === 'archived';
  let nextStep = null;
  if (step === 'confirmAttendance' && meetupAt !== null) {
    nextStep = <AttendanceCard podId={podId} when={relativeMeetup(t, meetupAt, now, locale)} mine={mine} ask />;
  } else if (step === 'chat') {
    nextStep = (
      <NextStepCard title={t('pod.next.chat')}>
        <CardButton testID="next-step" variant="primary" label={t('pod.next.chatAction')} onPress={() => go('/pod/[podId]/chat')} />
      </NextStepCard>
    );
  } else if (step === 'feedback') {
    nextStep = (
      <NextStepCard title={t('pod.next.feedback')}>
        <CardButton testID="next-step" variant="primary" label={t('pod.giveFeedback')} onPress={() => go('/pod/[podId]/feedback')} />
      </NextStepCard>
    );
  } else if (step === 'vote' || step === 'addOption') {
    // A reschedule round sends a scheduled pod back to planning; the card catches up before the reveal shows.
    nextStep = (
      <NextStepCard title={d?.planning.extended ? t('plan.extendedTitle') : t('pod.planTheMeetup')}>
        <CardButton testID="next-step" variant="primary" label={t('pod.next.voteAction')} onPress={() => go('/pod/[podId]/plan')} />
      </NextStepCard>
    );
  }

  return (
    <PodPage tabBar top={14} gap={12} band={<PodPageBand title={theme} subtitle={subtitle} color={color} menu={menu()} />}>
      {guard}
      {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
      {nextStep}

      {d && meetupAt !== null ? (
        <PodCard gap={6} testID="pod-plan">
          <PlanCardHeader {...(d.state === 'scheduled' && !past ? { onSafety: () => router.push('/info/safety') } : {})} />
          {place ? (
            <LockedPlan meetupAt={meetupAt} place={place} color={color} past={past} />
          ) : (
            <Text variant="cardTitle">{meetupWhen(t, meetupAt, locale)}</Text>
          )}
          {d.state === 'scheduled' && step !== 'confirmAttendance' ? <AttendanceCard podId={podId} when={relativeMeetup(t, meetupAt, now, locale)} mine={mine} ask={false} /> : null}
        </PodCard>
      ) : null}

      {chatCard}

      {d ? <MembersCard podId={podId} members={members} viewer={uid} color={color} attendance={d.state === 'scheduled' ? (d.attendance ?? null) : null} /> : null}
      {/* The page ends with Members (pod-scheduled, "3.4 is now one next-step card plus Plan, Chat and Members"); the pod
          interests were shown in the reveal (§3.4). The photo switch stays: it is the member's own privacy control (S6). */}
      {photoSwitch}
      {leaveError}
    </PodPage>
  );
}

/**
 * The Chat row's 36 px disc (pod-scheduled, spec §6 chat row): the pod tint with the chat icon in its deep tone and no
 * border, since the deep icon already sets it apart from the white card. A private pod's disc is white, so it keeps
 * its Ink outline; in dark mode the deep disc keeps the base-tone ring that lifts it off the night card.
 */
function ChatDisc({ color }: { color: PodColor | null }) {
  const c = usePodColors(color);
  const dark = useColorSchemeName() === 'dark';
  const outlined = color === null || dark;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.chatDisc, { backgroundColor: c.surface }, outlined ? { borderWidth: BorderWidth.hairline, borderColor: c.surfaceBorder } : null]}
    >
      <Icon name="chat" size={20} color={c.icon} />
    </View>
  );
}

/** The Chat card's line: "Open until Sunday 14:00", "Opens Friday 14:00", "Closed" while messages last; else no card. */
function chatEntry(t: TFunction, chat: ChatStatus | null, hasMessages: boolean, locale: Locale): string | null {
  if (!chat) return null;
  if (chat.kind === 'open') return t('pod.chatOpenUntil', { when: weekdayAt(t, chat.closesAt.getTime(), locale) });
  if (chat.kind === 'upcoming') return t('pod.chatOpens', { when: weekdayAt(t, chat.opensAt.getTime(), locale) });
  return hasMessages ? t('pod.chatClosed') : null;
}

const styles = StyleSheet.create({
  // Chat row (pod-scheduled): padding 8/16/8/10 around the 36 px disc, the title and its window 2 px apart.
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 8, paddingLeft: 10, paddingRight: 16 },
  chatDisc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chatText: { flex: 1, gap: 2 },
  chatTitle: { lineHeight: 20 },
  unread: { alignSelf: 'center' },
  // A row, so the pill (which pins itself to the start of a column) sits centred under "Plan the meetup".
  deadline: { flexDirection: 'row', justifyContent: 'center' },
});
