import { OPTIONS_PER_POD, yesVotes } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Badge, Banner, Button, ErrorText, Icon, Loading, StatusText, Text, Title } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { usePod, usePodCard, usePodOptions } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { AttendanceCard } from '@/features/pods/AttendanceCard';
import { podColorOf } from '@/features/pods/color';
import { planningDeadlineAsk } from '@/features/pods/deadline';
import { LockedPlan, PlanCardHeader } from '@/features/pods/LockedPlan';
import { isConfirmedMember } from '@/features/pods/membership';
import { goBack, PodCard, PodPage } from '@/features/pods/parts';
import { MembersCard, podMembers } from '@/features/pods/PodMembers';
import { PlanOptionCard, SuggestTimeButton } from '@/features/pods/PlanOption';
import { relativeMeetup, weekdayAt } from '@/features/pods/time';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Plan the meetup (§3.5, pod-plan): 2–3 options of a time and a public place from Google Places (D8), each with the
 * faces of everyone who said yes and the viewer's Yes / No; the option ahead is marked "Leading". The voting deadline
 * is the viewer's own, so it is a needs-you pill under the title (decision 2) while they still have an option to vote
 * on, and a quiet status once they have voted on every one (the pod page's rule, deadline.ts). Other members' options
 * can be reported by pressing and holding them. "Suggest another time" opens the form (pod-propose). When the deadline
 * passes without 3 yes votes on one option, the pod gets one 24 h extension round (D7). Once the plan has locked ("Your
 * meetup"), the screen says that voting has closed and how many yes votes won it (a yes counts as "I'm coming"), shows
 * the plan with "Open in Maps", "Add to calendar" and "Meeting safely", the viewer's own answer (a needs-you note while
 * it is missing), and who else is coming. The header shows no pod name (the storyboard's does not), so there is no pod
 * band here; the pod's colour is in the faces.
 */
export default function Plan() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const planning = member && card.data?.state === 'planning';
  // Options stay readable after the plan locks (until a new planning round), so the locked view can count the winner's votes.
  const options = usePodOptions(podId, member);
  const vote = useCallable('voteOption');
  const [now] = useState(() => Date.now());
  const locale = currentLocale();

  if (card.isLoading || (member && pod.isLoading) || (planning && options.isLoading)) {
    return <Loading label={t('common.loading')} />;
  }
  const color = podColorOf(podId, card.data);
  if (!planning) {
    const d = pod.data;
    const locked = d?.planning;
    const meetupAt = locked?.meetupAt?.toMillis();
    if (!member || !d || meetupAt === undefined || !locked?.place) {
      return (
        <PodPage top={32} gap={14}>
          <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} />
          <Title>{t('plan.lockedTitle')}</Title>
          <Text variant="body" color="textSecondary">
            {t('plan.notPlanning')}
          </Text>
        </PodPage>
      );
    }
    const scheduled = d.state === 'scheduled';
    const past = now >= meetupAt || d.state === 'happened' || d.state === 'archived';
    const winner = (options.data ?? []).find((o) => o.id === locked.winningOptionId);
    const won = winner ? yesVotes({ id: winner.id, startsAt: winner.data.startsAt.toMillis(), votes: winner.data.votes }, d.memberUids) : null;
    const mine = d.attendance?.[uid] ?? null;
    // "Your yes counts as I'm coming" only while it still does: a later "Can't make it" overrides the vote.
    const yesCounts = scheduled && !past && winner?.data.votes[uid] === 'yes' && mine === 'coming';
    const status = [won !== null ? t('plan.lockedWon', { count: won }) : t('plan.lockedClosed'), yesCounts ? t('plan.lockedYourYes') : null].filter(Boolean).join(' ');
    return (
      <PodPage top={32} gap={14}>
        <View style={styles.header}>
          <BackButton onPress={() => goBack(router)} accessibilityLabel={t('chat.backToPod')} />
          <Title>{t('plan.lockedTitle')}</Title>
          {/* A quiet status (check + Ink 2 13/700) that can run to two lines; the tick stays on the first. */}
          <View style={styles.status} testID="plan-locked-status">
            <Icon name="check" size={14} strokeWidth={2.4} color={p.textSecondary} style={styles.statusIcon} />
            <Text variant="captionBold" color="textSecondary" style={styles.shrink}>
              {status}
            </Text>
          </View>
        </View>
        {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
        <PodCard gap={6} testID="pod-plan">
          <PlanCardHeader {...(scheduled && !past ? { onSafety: () => router.push('/info/safety') } : {})} />
          <LockedPlan meetupAt={meetupAt} place={locked.place} color={color} past={past} />
          {scheduled && !past ? <AttendanceCard podId={podId} when={relativeMeetup(t, meetupAt, now, locale)} mine={mine} ask={false} /> : null}
        </PodCard>
        <MembersCard podId={podId} members={podMembers(d.memberUids, d.roster, uid)} viewer={uid} color={color} attendance={scheduled ? (d.attendance ?? null) : null} />
      </PodPage>
    );
  }

  const rows = options.data ?? [];
  const roster = pod.data?.roster ?? {};
  const memberUids = pod.data?.memberUids ?? [];
  const yesCount = (votes: Readonly<Record<string, 'yes' | 'no'>>) => Object.values(votes).filter((x) => x === 'yes').length;
  // Ahead: the most yes votes, the earlier time on a tie (as the deadline decides, §3.5); nobody leads on zero.
  const leadingId = rows
    .filter((r) => yesCount(r.data.votes) > 0)
    .sort((a, b) => yesCount(b.data.votes) - yesCount(a.data.votes) || a.data.startsAt.toMillis() - b.data.startsAt.toMillis())[0]?.id;
  const spotsLeft = Math.max(0, OPTIONS_PER_POD - rows.length);
  const deadline = pod.data?.planning.deadline.toMillis();
  const reportable = rows.some((r) => r.data.authorUid !== uid);

  return (
    <PodPage
      top={32}
      gap={14}
      footer={<Button testID="plan-done" label={rows.length > 0 ? t('plan.doneVoting') : t('plan.backToPod')} variant="primary" onPress={() => goBack(router)} />}
    >
      <View style={styles.header}>
        <BackButton onPress={() => goBack(router)} accessibilityLabel={t('chat.backToPod')} />
        <Title>{t('plan.heading')}</Title>
        {deadline !== undefined ? (
          <View style={styles.deadline}>
            {/* The pod page's rule (deadline.ts): needs-you while the viewer still has an option to vote on or none to
                vote on yet; once they have voted on every option, a quiet clock status. */}
            {planningDeadlineAsk(rows.map((r) => r.data.votes), uid) === null ? (
              <StatusText testID="deadline-quiet" icon="clock" label={t('plan.votingCloses', { when: weekdayAt(t, deadline, locale) })} />
            ) : (
              <Badge testID="deadline-needs-you" tone="needsYou" label={t('plan.votingCloses', { when: weekdayAt(t, deadline, locale) })} />
            )}
          </View>
        ) : null}
      </View>

      {pod.data?.planning.extended ? (
        <Banner tone="needsYou" icon="clock" title={t('plan.extendedTitle')}>
          {t('plan.extendedBody', { when: weekdayAt(t, pod.data.planning.deadline.toMillis(), locale) })}
        </Banner>
      ) : null}
      {pod.error || options.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
      {rows.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('plan.noOptions')}
        </Text>
      ) : null}

      {rows.map(({ id, data }) => {
        const yesVoters = memberUids.filter((m) => data.votes[m] === 'yes').map((m) => ({ uid: m, firstName: roster[m]?.firstName ?? '', photoV: roster[m]?.photoV ?? null }));
        return (
          <PlanOptionCard
            key={id}
            id={id}
            startsAt={data.startsAt.toMillis()}
            place={data.place}
            yesVoters={yesVoters}
            yesCount={yesCount(data.votes)}
            viewer={uid}
            mine={data.votes[uid] ?? null}
            leading={id === leadingId}
            color={color}
            onVote={(v) => vote.mutate({ podId, optionId: id, vote: v })}
            {...(data.authorUid !== uid ? { onReport: () => router.push({ pathname: '/sheets/report', params: { podId, optionId: id } }) } : {})}
          />
        );
      })}
      {vote.error ? <ErrorText>{t(errorMessageKey(vote.error))}</ErrorText> : null}

      {spotsLeft > 0 ? (
        <SuggestTimeButton
          testID="suggest-time"
          label={rows.length === 0 ? t('plan.suggestFirst') : t('plan.suggestAnother')}
          hint={t('plan.spotsLeft', { count: spotsLeft })}
          onPress={() => router.push({ pathname: '/pod/[podId]/propose', params: { podId } })}
        />
      ) : null}
      <Text variant="caption" color="textSecondary">
        {t('plan.rules')}
        {reportable ? ` ${t('plan.reportHint')}` : null}
      </Text>
    </PodPage>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  deadline: { marginTop: 4, alignItems: 'flex-start' },
  shrink: { flexShrink: 1 },
  status: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  statusIcon: { marginTop: 2 },
});
