import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, Checkbox, ChipRow, ErrorText, Heading, Loading, Screen, Toggle } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

type MeetAgain = 'yes' | 'no';

/**
 * "Did you meet?" (§3.6): "Who was there?" with everyone pre-ticked, so the user only unticks whoever was missing
 * (D15); a private "meet again" per person whose answer has an effect (D9); a 1–5 rating and Keep pod / Not for me.
 * None of it is shown to the others.
 */
export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const pod = usePod(podId, isConfirmedMember(card.data));
  const submit = useCallable('submitFeedback');
  const [met, setMet] = useState(true);
  const [notThere, setNotThere] = useState<ReadonlySet<string>>(new Set());
  const [meetAgain, setMeetAgain] = useState<Record<string, MeetAgain>>({});
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [keep, setKeep] = useState<boolean | null>(null);

  const answerMeetAgain = (m: string, answer: MeetAgain | null) =>
    setMeetAgain((x) => {
      const { [m]: _dropped, ...rest } = x;
      return answer ? { ...rest, [m]: answer } : rest;
    });

  if (!pod.data) return <Loading label={t('common.loading')} />;
  const others = pod.data.memberUids.filter((m) => m !== uid);
  const roster = pod.data.roster;

  const send = () => {
    if (keep === null) return;
    submit.mutate(
      {
        podId,
        met,
        notThere: met ? others.filter((m) => notThere.has(m)) : [],
        // Only people who were there can be met again; no answer means no signal.
        meetAgain: met ? Object.fromEntries(others.filter((m) => !notThere.has(m) && meetAgain[m]).map((m) => [m, meetAgain[m] === 'yes'])) : {},
        ...(rating !== undefined ? { rating } : {}),
        keep,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen>
      <Heading>{t('feedback.didYouMeet')}</Heading>
      <ChipRow>
        <Toggle label={t('feedback.yes')} value={met} onChange={() => setMet(true)} />
        <Toggle label={t('feedback.no')} value={!met} onChange={() => setMet(false)} />
      </ChipRow>
      {met ? (
        <>
          <Heading>{t('feedback.whoWasThere')}</Heading>
          <Body muted>{t('feedback.whoWasThereHint')}</Body>
          {others.map((m) => {
            const name = roster[m]?.firstName ?? '';
            const there = !notThere.has(m);
            return (
              <Card key={m}>
                <Checkbox
                  testID={`there-${m}`}
                  label={name}
                  checked={there}
                  onChange={(on) =>
                    setNotThere((s) => {
                      const next = new Set(s);
                      if (on) next.delete(m);
                      else next.add(m);
                      return next;
                    })
                  }
                />
                {there ? (
                  <>
                    <Body>{t('feedback.meetAgain', { name })}</Body>
                    <ChipRow>
                      <Toggle
                        label={t('feedback.yes')}
                        value={meetAgain[m] === 'yes'}
                        onChange={(on) => answerMeetAgain(m, on ? 'yes' : null)}
                      />
                      <Toggle
                        label={t('feedback.no')}
                        value={meetAgain[m] === 'no'}
                        onChange={(on) => answerMeetAgain(m, on ? 'no' : null)}
                      />
                    </ChipRow>
                  </>
                ) : null}
              </Card>
            );
          })}
          <Body muted>{t('feedback.meetAgainEffect')}</Body>
        </>
      ) : null}
      {met ? (
        <>
          <Body>{t('feedback.rating')}</Body>
          <ChipRow>
            {[1, 2, 3, 4, 5].map((n) => (
              <Toggle key={n} label={String(n)} value={rating === n} onChange={(on) => setRating(on ? n : undefined)} />
            ))}
          </ChipRow>
        </>
      ) : null}
      <Body muted>{t('feedback.private')}</Body>
      <ChipRow>
        <Toggle label={t('feedback.keep')} value={keep === true} onChange={() => setKeep(true)} />
        <Toggle label={t('feedback.notForMe')} value={keep === false} onChange={() => setKeep(false)} />
      </ChipRow>
      {submit.error ? <ErrorText>{t(errorMessageKey(submit.error))}</ErrorText> : null}
      <Button label={t('feedback.send')} disabled={keep === null} busy={submit.isPending} onPress={send} />
    </Screen>
  );
}
