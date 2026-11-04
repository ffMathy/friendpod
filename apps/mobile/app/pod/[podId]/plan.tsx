import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, Checkbox, ChipRow, ErrorText, Field, Heading, Loading, Screen, Toggle } from '@/components/ui';
import { usePodCard, usePodOptions } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { isConfirmedMember } from '@/features/pods/membership';
import { validateOptionForm, type OptionFormError } from '@/features/pods/optionForm';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** Meetup planner (§3.5): 2–3 options, yes/no votes. The only way to talk until the meetup chat opens (F6, §3.6). */
export default function Plan() {
  const { t } = useTranslation();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const options = usePodOptions(podId, member);
  const vote = useCallable('voteOption');
  const propose = useCallable('proposeOption');
  const locale = currentLocale();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [placeText, setPlaceText] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [publicPlace, setPublicPlace] = useState(false);
  const [formError, setFormError] = useState<OptionFormError | null>(null);
  const [homeWarning, setHomeWarning] = useState(false);

  if (card.isLoading || (member && options.isLoading)) return <Loading label={t('common.loading')} />;
  if (!member || card.data?.state !== 'planning') {
    return (
      <Screen>
        <Body>{t('plan.notPlanning')}</Body>
      </Screen>
    );
  }

  const submit = (ackWarnings: boolean) => {
    const v = validateOptionForm({ date, time, placeText, mapUrl, publicPlace }, Date.now());
    if (!v.ok) {
      setFormError(v.error);
      return;
    }
    setFormError(null);
    propose.mutate(
      { podId, startsAt: v.startsAt, placeText: v.placeText, publicPlace: true, ...(v.mapUrl ? { mapUrl: v.mapUrl } : {}), ...(ackWarnings ? { ackWarnings } : {}) },
      {
        onSuccess: (result) => {
          if ('warnings' in result) {
            setHomeWarning(true);
            return;
          }
          setHomeWarning(false);
          setDate('');
          setTime('');
          setPlaceText('');
          setMapUrl('');
          setPublicPlace(false);
        },
      },
    );
  };

  const rows = options.data ?? [];
  return (
    <Screen>
      <Heading>{t('plan.options')}</Heading>
      {rows.length === 0 ? <Body muted>{t('plan.noOptions')}</Body> : null}
      {rows.map(({ id, data }) => {
        const yes = Object.values(data.votes).filter((x) => x === 'yes').length;
        const mine = data.votes[uid] ?? null;
        return (
          <Card key={id}>
            <Body bold>{formatDateTime(data.startsAt.toMillis(), locale)}</Body>
            <Body>{data.placeText}</Body>
            {data.mapUrl ? <Body muted>{data.mapUrl}</Body> : null}
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
          <Field label={t('plan.place')} value={placeText} onChangeText={setPlaceText} maxLength={120} />
          <Field label={t('plan.mapUrl')} value={mapUrl} onChangeText={setMapUrl} autoCapitalize="none" keyboardType="url" />
          <Checkbox label={t('plan.publicPlace')} checked={publicPlace} onChange={setPublicPlace} />
          {formError ? <ErrorText>{t(`plan.errors.${formError}`)}</ErrorText> : null}
          {homeWarning ? <ErrorText>{t('plan.homeAddressWarning')}</ErrorText> : null}
          {propose.error ? <ErrorText>{t(errorMessageKey(propose.error))}</ErrorText> : null}
          <Button
            label={homeWarning ? t('plan.proposeAnyway') : t('plan.propose')}
            busy={propose.isPending}
            onPress={() => submit(homeWarning)}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
