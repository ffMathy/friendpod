import { feedbackClosesAt, HOUR_MS, meetupTimers, podNextStep, type AttendanceStatus, type PodDoc } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Body, Button, Card, ErrorText, Heading, LinkRow, Loading, Screen, Toggle } from '@/components/ui';
import { usePod, usePodCard, usePodOptions } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useChatStatus } from '@/features/chat/window';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { AttendanceCard } from '@/features/pods/AttendanceCard';
import { addMeetupToCalendar } from '@/features/pods/calendar';
import { useFeedbackSent } from '@/features/pods/feedbackSent';
import { isConfirmedMember } from '@/features/pods/membership';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * When "Still coming?" is first asked: T−3 d when the meetup was planned far enough ahead, else T−24 h (D5).
 * The pod doc has no plan-lock time, so confirmation stands in for it; at worst the card shows a little early.
 */
function attendanceAskedAt(pod: PodDoc): number | null {
  const meetupAt = pod.planning.meetupAt?.toMillis();
  if (meetupAt === undefined) return null;
  const timers = meetupTimers(meetupAt, pod.confirmedAt.toMillis());
  return timers.stillComing3d ?? timers.stillComing24h;
}

/**
 * A confirmed pod (§3.4, D13): one primary "next step" card driven by state (vote → confirm attendance → chat during
 * the window → give feedback), then calm sections Plan, Chat and Members. Block and report live in each member's
 * sheet. Before confirmation the proposal card is shown instead.
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
  const leave = useCallable('leavePod');
  const sharePhoto = useCallable('setPhotoSharing');
  const [now] = useState(() => Date.now());
  const [calendarFailed, setCalendarFailed] = useState(false);
  const locale = currentLocale();

  if (card.isLoading) return <Loading label={t('common.loading')} />;
  if (!card.data) {
    return (
      <Screen>
        <Body>{t('pod.gone')}</Body>
      </Screen>
    );
  }
  const c = card.data;
  if (!member) {
    return (
      <Screen>
        {c.themeSensitive ? <ScreenCaptureGuard /> : null}
        <ProposalCard podId={podId} card={c} />
      </Screen>
    );
  }

  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const p = pod.data;
  const meetupAt = p?.planning.meetupAt?.toMillis() ?? null;
  const place = p?.planning.place ?? null;
  const mine: AttendanceStatus | null = p?.attendance?.[uid] ?? null;
  const step = p
    ? podNextStep({
        state: p.state,
        now,
        votedOnAllOptions: (options.data ?? []).every((o) => o.data.votes[uid] !== undefined),
        meetupAt,
        myAttendance: mine,
        attendanceAskedAt: attendanceAskedAt(p),
        // Past the 7-day window there is nothing left to give.
        feedbackGiven: feedbackSent || (meetupAt !== null && now > feedbackClosesAt(meetupAt + 2 * HOUR_MS)),
      })
    : null;
  const when = meetupAt !== null ? formatDateTime(meetupAt, locale) : '';
  const chatDetail =
    chat?.kind === 'upcoming'
      ? t('pod.chatOpens', { when: formatDateTime(chat.opensAt.getTime(), locale) })
      : chat?.kind === 'open'
        ? t('pod.chatOpenNow')
        : chatClosed && (messages.data?.length ?? 0) > 0
          ? t('pod.chatClosed')
          : null;

  const go = (pathname: '/pod/[podId]/plan' | '/pod/[podId]/chat' | '/pod/[podId]/feedback') => router.push({ pathname, params: { podId } });
  const confirmLeave = () =>
    Alert.alert(t('pod.leaveTitle'), t('pod.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pod.leave'), style: 'destructive', onPress: () => leave.mutate({ podId }, { onSuccess: () => router.back() }) },
    ]);
  const addToCalendar = () => {
    if (meetupAt === null || !place) return;
    setCalendarFailed(false);
    addMeetupToCalendar({ startsAt: meetupAt, place, title: t('pod.calendarTitle') }).catch(() => setCalendarFailed(true));
  };

  return (
    <Screen>
      {c.themeSensitive ? <ScreenCaptureGuard /> : null}
      <Heading>{c.themeSensitive ? `🔒 ${theme}` : theme}</Heading>
      <Body muted>{t(`podState.${c.state}`)}</Body>
      {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}

      {step === 'vote' ? (
        <Card>
          <Body bold>{p?.planning.extended ? t('plan.extendedTitle') : t('pod.next.vote')}</Body>
          <Body muted>{t('pod.next.voteBody', { when: p ? formatDateTime(p.planning.deadline.toMillis(), locale) : '' })}</Body>
          <Button testID="next-step" label={t('pod.next.voteAction')} onPress={() => go('/pod/[podId]/plan')} />
        </Card>
      ) : null}
      {step === 'confirmAttendance' ? <AttendanceCard podId={podId} when={when} mine={mine} ask /> : null}
      {step === 'chat' ? (
        <Card>
          <Body bold>{t('pod.next.chat')}</Body>
          <Button testID="next-step" label={t('pod.next.chatAction')} onPress={() => go('/pod/[podId]/chat')} />
        </Card>
      ) : null}
      {step === 'feedback' ? (
        <Card>
          <Body bold>{t('pod.next.feedback')}</Body>
          <Button testID="next-step" label={t('pod.giveFeedback')} onPress={() => go('/pod/[podId]/feedback')} />
        </Card>
      ) : null}

      {p ? (
        <>
          <Heading>{t('pod.sections.plan')}</Heading>
          {meetupAt !== null ? (
            <View style={{ gap: 8 }}>
              <Body bold>{t('pod.meetup', { when })}</Body>
              {place ? (
                <>
                  <Body>{place.name}</Body>
                  <Body muted>{place.address}</Body>
                  <Button testID="add-to-calendar" label={t('pod.addToCalendar')} variant="secondary" onPress={addToCalendar} />
                  {calendarFailed ? <ErrorText>{t('pod.calendarFailed')}</ErrorText> : null}
                </>
              ) : null}
              {p.state === 'scheduled' && step !== 'confirmAttendance' ? <AttendanceCard podId={podId} when={when} mine={mine} ask={false} /> : null}
            </View>
          ) : (
            <>
              {p.planning.extended && step !== 'vote' ? <Body>{t('plan.extendedTitle')}</Body> : null}
              <Body>{t('pod.planBy', { when: formatDateTime(p.planning.deadline.toMillis(), locale) })}</Body>
              {p.state === 'planning' ? <LinkRow label={t('pod.openPlanner')} onPress={() => go('/pod/[podId]/plan')} /> : null}
            </>
          )}

          {chatDetail ? (
            <>
              <Heading>{t('pod.sections.chat')}</Heading>
              <LinkRow label={t('pod.chat')} detail={chatDetail} onPress={() => go('/pod/[podId]/chat')} />
            </>
          ) : null}

          <Heading>{t('pod.sections.members')}</Heading>
          {p.memberUids.map((memberUid) => {
            const entry = p.roster[memberUid];
            if (!entry) return null;
            const status = p.state === 'scheduled' ? p.attendance?.[memberUid] : undefined;
            const detail =
              memberUid === uid || status === undefined || status === 'pending'
                ? undefined
                : status === 'unconfirmed'
                  ? t('attendance.hasntConfirmed', { name: entry.firstName })
                  : t(`attendance.other.${status}`);
            return (
              <View key={memberUid} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {entry.photoV !== null ? (
                  <AuthenticatedPhoto
                    owner={memberUid}
                    version={entry.photoV}
                    size="thumb"
                    accessibilityLabel={t('pod.photoOf', { name: entry.firstName })}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <LinkRow
                    label={memberUid === uid ? t('pod.you', { name: entry.firstName }) : entry.firstName}
                    {...(detail ? { detail } : {})}
                    onPress={() => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId, uid: memberUid } })}
                  />
                </View>
              </View>
            );
          })}
          {p.podInterests[locale].length > 0 ? <Body muted>{t('pod.podInterests', { list: p.podInterests[locale].join(', ') })}</Body> : null}
        </>
      ) : null}

      {c.themeSensitive ? (
        <Toggle label={t('pod.showMyPhoto')} value={c.photoShared === true} onChange={(share) => sharePhoto.mutate({ podId, share })} />
      ) : null}
      {sharePhoto.error ? <ErrorText>{t(errorMessageKey(sharePhoto.error))}</ErrorText> : null}
      <LinkRow label={t('info.safety.title')} onPress={() => router.push('/info/safety')} />
      {c.state !== 'archived' ? <Button label={t('pod.leave')} variant="danger" busy={leave.isPending} onPress={confirmLeave} /> : null}
      {leave.error ? <ErrorText>{t(errorMessageKey(leave.error))}</ErrorText> : null}
    </Screen>
  );
}
