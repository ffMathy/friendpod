import { OPTIONS_PER_POD, WINNING_YES_VOTES, winningOption, type Place } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddButton, AppText, Banner, Body, Button, Card, ErrorText, Loading, Screen, ScreenHeader } from '@/components/ui';
import { usePod, usePodCard, usePodOptions, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { PlacePicker } from '@/features/places/PlacePicker';
import { LockedPlan } from '@/features/pods/LockedPlan';
import type { MemberStackItem } from '@/features/pods/MemberCircle';
import { memberFills, viewerLast } from '@/features/pods/memberFill';
import { isConfirmedMember } from '@/features/pods/membership';
import { validateOptionForm, type OptionFormError } from '@/features/pods/optionForm';
import { OptionWhen } from '@/features/pods/OptionWhen';
import { PlanOptionCard } from '@/features/pods/PlanOptionCard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * Meetup planner (§3.5; storyboards 3.2 and 3.3): 2–3 options of a time and a public place from Google Places (D8),
 * yes/no votes, Report on other members' options. "Suggest a time" switches the screen to the option form (3.3); it
 * opens by itself while there is nothing to vote on. When the deadline passes without 3 yes votes on one option, the
 * pod gets one 24 h extension round (D7). Once the plan has locked, the screen shows it with the map link and "Add to
 * calendar".
 */
export default function Plan() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const planning = member && card.data?.state === 'planning';
  const options = usePodOptions(podId, planning);
  const user = useUserDoc(uid);
  const vote = useCallable('voteOption');
  const propose = useCallable('proposeOption');
  const locale = currentLocale();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [formError, setFormError] = useState<OptionFormError | null>(null);
  /** null: the default (the form while there are no options yet); true/false once the viewer chose. */
  const [composing, setComposing] = useState<boolean | null>(null);
  const [now] = useState(() => Date.now());
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/pod/[podId]', params: { podId } }, { withAnchor: true }));

  if (card.isLoading || (planning && options.isLoading)) return <Loading label={t('common.loading')} />;
  if (!planning) {
    const locked = member ? pod.data?.planning : undefined;
    const meetupAt = locked?.meetupAt?.toMillis();
    const lockedPlace = locked?.place;
    return (
      <Screen>
        <ScreenHeader title={meetupAt !== undefined && lockedPlace ? t('pod.sections.plan') : t('plan.heading')} backLabel={t('common.back')} onBack={back} />
        {meetupAt !== undefined && lockedPlace ? (
          <Card radius="lg">
            <LockedPlan meetupAt={meetupAt} place={lockedPlace} />
          </Card>
        ) : (
          <Body muted>{t('plan.notPlanning')}</Body>
        )}
      </Screen>
    );
  }

  const submit = () => {
    const v = validateOptionForm({ date, time, place }, Date.now());
    if (!v.ok) {
      setFormError(v.error);
      return;
    }
    setFormError(null);
    propose.mutate(
      { podId, startsAt: v.startsAt, place: v.place },
      {
        onSuccess: () => {
          setDate('');
          setTime('');
          setPlace(null);
          setComposing(false);
        },
      },
    );
  };

  const rows = options.data ?? [];
  const extended = pod.data?.planning.extended === true;
  const deadline = pod.data ? formatDateTime(pod.data.planning.deadline.toMillis(), locale) : '';
  const extensionBanner = extended ? (
    <Banner tone="amber" icon="clock" title={t('plan.extendedTitle')}>
      {t('plan.extendedBody', { when: deadline })}
    </Banner>
  ) : null;
  const spotsLeft = Math.max(0, OPTIONS_PER_POD - rows.length);
  // A started draft keeps the form open when someone else's option arrives meanwhile.
  const drafting = date !== '' || time !== '' || place !== null;
  const compose = spotsLeft > 0 && (composing ?? (rows.length === 0 || drafting));

  // Storyboard 3.3: suggest a time and a public place.
  if (compose) {
    return (
      <Screen
        footer={<Button testID="option-propose" label={t('plan.suggestSubmit')} variant="accent" busy={propose.isPending} onPress={submit} />}
      >
        <ScreenHeader title={t('plan.suggestTitle')} size="md" closeLabel={t('common.close')} onClose={() => setComposing(false)} />
        {extensionBanner}
        <OptionWhen date={date} time={time} onDate={setDate} onTime={setTime} locale={locale} />
        <PlacePicker language={locale} gh5={user.data?.area.gh5 ?? null} value={place} onChange={setPlace} />
        {formError ? <ErrorText>{t(`plan.errors.${formError}`)}</ErrorText> : null}
        {propose.error ? <ErrorText>{t(errorMessageKey(propose.error))}</ErrorText> : null}
      </Screen>
    );
  }

  // Storyboard 3.2: the options and votes.
  const roster = pod.data?.roster;
  const memberUids = pod.data?.memberUids ?? [];
  const leading = winningOption(
    rows.map(({ id, data }) => ({ id, startsAt: data.startsAt.toMillis(), votes: data.votes })),
    memberUids,
    now,
  );
  // Current members who said yes, in pod order with the viewer last (storyboard 3.2), each in their pod colour.
  const fillOf = memberFills(memberUids, uid);
  const votersOf = (votes: Readonly<Record<string, 'yes' | 'no'>>): MemberStackItem[] =>
    viewerLast(memberUids, uid).flatMap((voter): MemberStackItem[] => {
      if (votes[voter] !== 'yes') return [];
      if (voter === uid) return [{ uid: voter, name: '', fill: fillOf(voter), you: true }];
      const name = roster?.[voter]?.firstName;
      return name ? [{ uid: voter, name, fill: fillOf(voter) }] : [];
    });

  return (
    <Screen gap={14} footer={rows.length > 0 ? <Button label={t('plan.doneVoting')} onPress={back} /> : undefined}>
      <ScreenHeader
        title={t('plan.heading')}
        subtitle={deadline ? t('plan.votingCloses', { when: deadline }) : undefined}
        subtitleIcon="clock"
        backLabel={t('common.back')}
        onBack={back}
      />
      {extensionBanner}
      {rows.length === 0 ? <Body muted>{t('plan.noOptions')}</Body> : null}
      {rows.map(({ id, data }) => {
        const mine = data.votes[uid] ?? null;
        return (
          <PlanOptionCard
            key={id}
            id={id}
            when={formatDateTime(data.startsAt.toMillis(), locale)}
            place={data.place}
            yes={Object.values(data.votes).filter((x) => x === 'yes').length}
            voters={votersOf(data.votes)}
            leading={leading?.id === id && rows.length > 1}
            mine={mine}
            onVote={(v) => vote.mutate({ podId, optionId: id, vote: v })}
            {...(data.authorUid !== uid ? { onReport: () => router.push({ pathname: '/sheets/report', params: { podId, optionId: id } }) } : {})}
          />
        );
      })}
      {vote.error ? <ErrorText>{t(errorMessageKey(vote.error))}</ErrorText> : null}

      {spotsLeft > 0 ? (
        <AddButton
          testID="option-add"
          label={rows.length === 0 ? t('plan.suggestTitle') : t('plan.suggestAnother')}
          detail={t('plan.spotsLeft', { count: spotsLeft })}
          onPress={() => setComposing(true)}
        />
      ) : null}
      <AppText variant="caption" tone="muted">
        {extended ? t('plan.rules', { min: WINNING_YES_VOTES }) : `${t('plan.rules', { min: WINNING_YES_VOTES })} ${t('plan.rulesExtension', { min: WINNING_YES_VOTES })}`}
      </AppText>
    </Screen>
  );
}
