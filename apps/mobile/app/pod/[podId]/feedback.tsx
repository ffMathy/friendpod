import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ChipRow, ErrorText, Heading, Loading, Screen, Toggle } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

type Attendance = 'came' | 'noShow';

/**
 * "Did you meet?" (§3.6): attendance per member, a private "would meet again", a 1–5 rating and
 * Keep pod / Not for me. None of it is shown to the others.
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
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [meetAgain, setMeetAgain] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [keep, setKeep] = useState<boolean | null>(null);

  if (!pod.data) return <Loading label={t('common.loading')} />;
  const others = pod.data.memberUids.filter((m) => m !== uid);
  const roster = pod.data.roster;

  const send = () => {
    if (keep === null) return;
    submit.mutate(
      {
        podId,
        met,
        attendance: met ? attendance : {},
        meetAgain: met ? meetAgain : {},
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
      {met
        ? others.map((m) => (
            <Card key={m}>
              <Body bold>{roster[m]?.firstName ?? ''}</Body>
              <ChipRow>
                <Toggle label={t('feedback.came')} value={attendance[m] === 'came'} onChange={() => setAttendance((a) => ({ ...a, [m]: 'came' }))} />
                <Toggle label={t('feedback.noShow')} value={attendance[m] === 'noShow'} onChange={() => setAttendance((a) => ({ ...a, [m]: 'noShow' }))} />
              </ChipRow>
              <Toggle label={t('feedback.meetAgain')} value={meetAgain[m] === true} onChange={(on) => setMeetAgain((x) => ({ ...x, [m]: on }))} />
            </Card>
          ))
        : null}
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
