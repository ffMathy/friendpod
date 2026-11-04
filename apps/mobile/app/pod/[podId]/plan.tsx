import type { Place } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ChipRow, ErrorText, Field, Heading, Loading, Screen, Toggle } from '@/components/ui';
import { usePod, usePodCard, usePodOptions, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { PlacePicker } from '@/features/places/PlacePicker';
import { isConfirmedMember } from '@/features/pods/membership';
import { validateOptionForm, type OptionFormError } from '@/features/pods/optionForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * Meetup planner (§3.5): 2–3 options of a time and a public place from Google Places (D8), yes/no votes. When the
 * deadline passes without 3 yes votes on one option, the pod gets one 24 h extension round (D7).
 */
export default function Plan() {
  const { t } = useTranslation();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const options = usePodOptions(podId, member);
  const user = useUserDoc(uid);
  const vote = useCallable('voteOption');
  const propose = useCallable('proposeOption');
  const locale = currentLocale();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [formError, setFormError] = useState<OptionFormError | null>(null);

  if (card.isLoading || (member && options.isLoading)) return <Loading label={t('common.loading')} />;
  if (!member || card.data?.state !== 'planning') {
    return (
      <Screen>
        <Body>{t('plan.notPlanning')}</Body>
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
        },
      },
    );
  };

  const rows = options.data ?? [];
  return (
    <Screen>
      {pod.data?.planning.extended ? (
        <Card>
          <Body bold>{t('plan.extendedTitle')}</Body>
          <Body>{t('plan.extendedBody', { when: formatDateTime(pod.data.planning.deadline.toMillis(), locale) })}</Body>
        </Card>
      ) : null}
      <Heading>{t('plan.options')}</Heading>
      {rows.length === 0 ? <Body muted>{t('plan.noOptions')}</Body> : null}
      {rows.map(({ id, data }) => {
        const yes = Object.values(data.votes).filter((x) => x === 'yes').length;
        const mine = data.votes[uid] ?? null;
        return (
          <Card key={id}>
            <Body bold>{formatDateTime(data.startsAt.toMillis(), locale)}</Body>
            <Body>{data.place.name}</Body>
            <Body muted>{data.place.address}</Body>
            <Body muted>{t('plan.yesVotes', { count: yes })}</Body>
            <ChipRow>
              <Toggle label={t('plan.yes')} value={mine === 'yes'} onChange={(on) => vote.mutate({ podId, optionId: id, vote: on ? 'yes' : null })} />
              <Toggle label={t('plan.no')} value={mine === 'no'} onChange={(on) => vote.mutate({ podId, optionId: id, vote: on ? 'no' : null })} />
            </ChipRow>
          </Card>
        );
      })}
      {vote.error ? <ErrorText>{t(errorMessageKey(vote.error))}</ErrorText> : null}

      {rows.length < 3 ? (
        <Card>
          <Heading>{rows.length === 0 ? t('plan.proposeFirst') : t('plan.proposeAnother')}</Heading>
          <Field label={t('plan.date')} value={date} onChangeText={setDate} placeholder={t('plan.dateHint')} />
          <Field label={t('plan.time')} value={time} onChangeText={setTime} placeholder={t('plan.timeHint')} />
          <PlacePicker language={locale} gh5={user.data?.area.gh5 ?? null} value={place} onChange={setPlace} />
          {formError ? <ErrorText>{t(`plan.errors.${formError}`)}</ErrorText> : null}
          {propose.error ? <ErrorText>{t(errorMessageKey(propose.error))}</ErrorText> : null}
          <Button label={t('plan.propose')} busy={propose.isPending} onPress={submit} />
        </Card>
      ) : null}
    </Screen>
  );
}
