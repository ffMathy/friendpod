import { feedbackClosesAt, firstAttendanceAsk, HOUR_MS, meetupTimers, podNextStep, type AttendanceStatus, type PodDoc } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';
import { AppText, Banner, Body, Button, Card, ErrorText, IconButton, Loading, Pill, Screen, SectionTitle } from '@/components/ui';
import { usePod, usePodCard, usePodOptions } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useChatStatus } from '@/features/chat/window';
import { AttendanceCard } from '@/features/pods/AttendanceCard';
import { useFeedbackSent } from '@/features/pods/feedbackSent';
import { LockedPlan } from '@/features/pods/LockedPlan';
import { isConfirmedMember } from '@/features/pods/membership';
import { NextStepCard } from '@/features/pods/NextStepCard';
import { ChatEntry, MeetingSafely, PodHeader, PodHero, PodInterests, PodMembers } from '@/features/pods/PodSections';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useConfirmationMin } from '@/features/pods/useConfirmationMin';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** When "Still coming?" is first asked, from the same timers the server uses (D5); null until the plan locks. */
function attendanceAskedAt(pod: PodDoc): number | null {
  const meetupAt = pod.planning.meetupAt?.toMillis();
  const lockedAt = pod.planning.planLockedAt?.toMillis();
  if (meetupAt === undefined || lockedAt === undefined) return null;
  return firstAttendanceAsk(meetupTimers(meetupAt, lockedAt));
}

/**
 * A confirmed pod (§3.4, D13). While the pod plans its meetup it is storyboard 3.1: the green "Confirmed" hero with the
 * members, then the pod interests, Members and "Meeting safely", with "Plan the meetup" pinned at the bottom as the next
 * step. Once a plan exists it is storyboard 3.4: one dark "next step" card driven by state (confirm attendance → chat
 * during the window → give feedback), then calm Plan, Chat and Members sections. Block and report live in each
 * member's sheet. Before confirmation the proposal card is shown instead.
 */
export default function PodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const options = usePodOptions(podId, member && card.data?.state === 'planning');
  const chat = useChatStatus(pod.data);
  // Outside the window the chat row stays only while messages exist; inside it there is no need to read them here.
  const chatClosed = chat?.kind === 'ended' || chat?.kind === 'off';
  const messages = useChatMessages(uid, podId, member && chatClosed);
  const feedbackSent = useFeedbackSent(podId);
  const confirmationMin = useConfirmationMin(uid);
  const leave = useCallable('leavePod');
  const sharePhoto = useCallable('setPhotoSharing');
  const [now] = useState(() => Date.now());
  const locale = currentLocale();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/pods'));

  if (card.isLoading) return <Loading label={t('common.loading')} />;
  if (!card.data) {
    return (
      <Screen>
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={back} style={styles.back} />
        <Body>{t('pod.gone')}</Body>
      </Screen>
    );
  }
  const c = card.data;
  if (!member) {
    return (
      <Screen>
        {c.themeSensitive ? <ScreenCaptureGuard /> : null}
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={back} style={styles.back} />
        <ProposalCard podId={podId} card={c} confirmationMin={confirmationMin} />
      </Screen>
    );
  }

  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const sensitive = c.themeSensitive;
  const p = pod.data;
  const state = p?.state ?? c.state;
  const meetupAt = p?.planning.meetupAt?.toMillis() ?? null;
  const place = p?.planning.place ?? null;
  const mine: AttendanceStatus | null = p?.attendance?.[uid] ?? null;
  const step = p
    ? podNextStep({
        state: p.state,
        now,
        votedOnAllOptions: (options.data ?? []).every((o) => o.data.votes[uid] !== undefined),
        // Unknown while the options load: no "add an option" card flashes before they arrive.
        optionCount: options.data?.length ?? (p.state === 'planning' ? 1 : 0),
        extended: p.planning.extended === true,
        meetupAt,
        myAttendance: mine,
        attendanceAskedAt: attendanceAskedAt(p),
        // Past the 7-day window there is nothing left to give.
        feedbackGiven: feedbackSent || (meetupAt !== null && now > feedbackClosesAt(meetupAt + 2 * HOUR_MS)),
      })
    : null;
  const when = meetupAt !== null ? formatDateTime(meetupAt, locale) : '';
  const deadline = p ? formatDateTime(p.planning.deadline.toMillis(), locale) : '';
  const sizeLine = p ? t('pods.sizeAndArea', { size: p.memberUids.length, area: p.areaLabel || c.areaLabel }) : undefined;
  const chatDetail =
    chat?.kind === 'upcoming'
      ? t('pod.chatOpens', { when: formatDateTime(chat.opensAt.getTime(), locale) })
      : chat?.kind === 'open'
        ? t('chat.openUntil', { when: formatDateTime(chat.closesAt.getTime(), locale) })
        : chatClosed && (messages.data?.length ?? 0) > 0
          ? t('pod.chatClosed')
          : null;

  const go = (pathname: '/pod/[podId]/plan' | '/pod/[podId]/chat' | '/pod/[podId]/feedback') => router.push({ pathname, params: { podId } });
  const openMember = (memberUid: string) => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId, uid: memberUid } });
  const confirmLeave = () =>
    Alert.alert(t('pod.leaveTitle'), t('pod.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pod.leave'), style: 'destructive', onPress: () => leave.mutate({ podId }, { onSuccess: () => router.back() }) },
    ]);

  const planning = p?.state === 'planning';
  const members = p ? (
    <PodMembers
      uid={uid}
      pod={p}
      onOpen={openMember}
      {...(sensitive
        ? { photoShare: { value: c.photoShared === true, disabled: sharePhoto.isPending, onChange: (share: boolean) => sharePhoto.mutate({ podId, share }) } }
        : {})}
    />
  ) : null;
  const interests = p ? <PodInterests interests={p.podInterests[locale]} /> : null;
  const chatEntry = chatDetail ? <ChatEntry detail={chatDetail} onPress={() => go('/pod/[podId]/chat')} /> : null;
  const tail = (
    <>
      {sharePhoto.error ? <ErrorText>{t(errorMessageKey(sharePhoto.error))}</ErrorText> : null}
      <MeetingSafely />
      {c.state !== 'archived' ? (
        <Button label={t('pod.leave')} variant="dangerSoft" size="md" busy={leave.isPending} onPress={confirmLeave} />
      ) : null}
      {leave.error ? <ErrorText>{t(errorMessageKey(leave.error))}</ErrorText> : null}
    </>
  );

  // Storyboard 3.1: planning. The next step (vote, or suggest an option) is the pinned "Plan the meetup" button.
  if (p && planning) {
    return (
      <Screen
        gap={14}
        footer={
          <>
            <Button testID={step ? 'next-step' : 'open-planner'} label={t('pod.next.plan')} onPress={() => go('/pod/[podId]/plan')} />
            <AppText variant="caption" tone="muted" align="center">
              {step === 'vote' ? t('pod.next.voteBody', { when: deadline }) : t('pod.planBy', { when: deadline })}
            </AppText>
          </>
        }
      >
        {sensitive ? <ScreenCaptureGuard /> : null}
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={back} style={styles.back} />
        <PodHero uid={uid} pod={p} theme={theme} sensitive={sensitive} subtitle={sizeLine ?? ''} />
        {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
        {p.planning.extended ? (
          <Banner tone="amber" icon="clock" title={t('plan.extendedTitle')}>
            {t('plan.extendedBody', { when: deadline })}
          </Banner>
        ) : null}
        {interests}
        {members}
        {chatEntry}
        {tail}
      </Screen>
    );
  }

  // Storyboard 3.4: a plan exists (scheduled), or the meetup is behind the pod (met, archived, didn't come together).
  return (
    <Screen gap={16}>
      {sensitive ? <ScreenCaptureGuard /> : null}
      <PodHeader
        theme={theme}
        sensitive={sensitive}
        subtitle={sizeLine}
        backLabel={t('common.back')}
        onBack={back}
        right={!p || state === 'scheduled' ? undefined : <Pill tone="neutral" size="sm" label={t(`podState.${state}`)} />}
      />
      {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}

      {step === 'confirmAttendance' ? <AttendanceCard podId={podId} when={when} mine={mine} ask /> : null}
      {step === 'chat' ? (
        <NextStepCard
          label={t('pod.next.label')}
          title={t('pod.next.chat')}
          {...(chat?.kind === 'open' ? { body: t('chat.openUntil', { when: formatDateTime(chat.closesAt.getTime(), locale) }) } : {})}
          actions={<Button testID="next-step" label={t('pod.next.chatAction')} variant="onDark" size="md" flex={1} onPress={() => go('/pod/[podId]/chat')} />}
        />
      ) : null}
      {step === 'feedback' ? (
        <NextStepCard
          label={t('pod.next.label')}
          title={t('pod.next.feedback')}
          actions={<Button testID="next-step" label={t('pod.giveFeedback')} variant="onDark" size="md" flex={1} onPress={() => go('/pod/[podId]/feedback')} />}
        />
      ) : null}

      {p && meetupAt !== null && place ? (
        <Card radius="lg" gap={12}>
          <SectionTitle title={t('pod.sections.plan')} variant="overline" />
          <LockedPlan meetupAt={meetupAt} place={place}>
            {p.state === 'scheduled' && step !== 'confirmAttendance' ? <AttendanceCard podId={podId} when={when} mine={mine} ask={false} /> : null}
          </LockedPlan>
        </Card>
      ) : null}
      {chatEntry}
      {members}
      {interests}
      {tail}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
});
