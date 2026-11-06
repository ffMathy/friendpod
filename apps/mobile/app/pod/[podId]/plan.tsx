import { OPTIONS_PER_POD } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Banner, Button, Card, ErrorText, Icon, Loading, Overline, Text, Title } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { usePod, usePodCard, usePodOptions } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { LockedPlan } from '@/features/pods/LockedPlan';
import { isConfirmedMember } from '@/features/pods/membership';
import { goBack, PodPage } from '@/features/pods/parts';
import { PlanOptionCard, SuggestTimeButton } from '@/features/pods/PlanOption';
import { weekdayAt } from '@/features/pods/time';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Plan the meetup (§3.5, pod-plan): 2–3 options of a time and a public place from Google Places (D8), each with the
 * faces of everyone who said yes and the viewer's Yes / No; the option ahead is marked "Leading". Other members'
 * options can be reported by pressing and holding them. "Suggest another time" opens the form (pod-propose). When the deadline passes without 3
 * yes votes on one option, the pod gets one 24 h extension round (D7). Once the plan has locked, the screen shows it
 * with the map link and "Add to calendar".
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
  const options = usePodOptions(podId, planning);
  const vote = useCallable('voteOption');
  const locale = currentLocale();

  if (card.isLoading || (planning && options.isLoading)) {
    return <Loading label={t('common.loading')} />;
  }
  if (!planning) {
    const locked = pod.data?.planning;
    const meetupAt = locked?.meetupAt?.toMillis();
    return (
      <PodPage top={32} gap={14}>
        <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} />
        <Title>{t('plan.lockedTitle')}</Title>
        {member && meetupAt !== undefined && locked?.place ? (
          <Card radius={22} gap={12} testID="pod-plan">
            <Overline>{t('pod.sections.plan')}</Overline>
            <LockedPlan meetupAt={meetupAt} place={locked.place} />
          </Card>
        ) : (
          <Text variant="body" color="textSecondary">
            {t('plan.notPlanning')}
          </Text>
        )}
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
      footer={<Button testID="plan-done" label={rows.length > 0 ? t('plan.doneVoting') : t('plan.backToPod')} variant="dark" onPress={() => goBack(router)} />}
    >
      <View style={styles.header}>
        <BackButton onPress={() => goBack(router)} accessibilityLabel={t('chat.backToPod')} />
        <Title style={styles.title}>{t('plan.heading')}</Title>
        {deadline !== undefined ? (
          <View style={styles.deadline}>
            <Icon name="clock" size={16} color={p.textMuted} />
            <Text variant="small" color="textMuted" style={styles.deadlineText}>
              {t('plan.votingCloses', { when: weekdayAt(t, deadline, locale) })}
            </Text>
          </View>
        ) : null}
      </View>

      {pod.data?.planning.extended ? (
        <Banner tone="warning" icon="clock" title={t('plan.extendedTitle')}>
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
      <Text variant="caption" color="textMuted">
        {t('plan.rules')}
        {reportable ? ` ${t('plan.reportHint')}` : null}
      </Text>
    </PodPage>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  // 30/800 at its natural line height, as the storyboard's h1.
  title: { lineHeight: 38 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineText: { lineHeight: 18 },
});
