import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Fonts, Spacing, usePalette } from '@/components/theme';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ErrorText,
  Heading,
  Loading,
  Screen,
  ScreenHeader,
  SectionTitle,
  Segmented,
  Toggle,
} from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberFace } from '@/features/safety/MemberFace';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

type MeetAgain = 'yes' | 'no';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * "How did it go?" (§3.6, storyboard 4.1): "Who was there?" with everyone pre-ticked, so the user only unticks whoever
 * was missing (D15); a private "meet again" per person who was there, answered yes or no or left open (D9: an open
 * answer sends no signal); a 1–5 rating; and Keep pod / Not for me, which sends the answers. None of it is shown to the
 * others.
 */
export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const pod = usePod(podId, isConfirmedMember(card.data));
  const submit = useCallable('submitFeedback');
  const [met, setMet] = useState(true);
  const [notThere, setNotThere] = useState<ReadonlySet<string>>(new Set());
  const [meetAgain, setMeetAgain] = useState<Record<string, MeetAgain>>({});
  const [rating, setRating] = useState<number | undefined>(undefined);

  const answerMeetAgain = (m: string, answer: MeetAgain | null) =>
    setMeetAgain((x) => {
      const { [m]: _dropped, ...rest } = x;
      return answer ? { ...rest, [m]: answer } : rest;
    });
  const setThere = (m: string, there: boolean) =>
    setNotThere((s) => {
      const next = new Set(s);
      if (there) next.delete(m);
      else next.add(m);
      return next;
    });

  if (!pod.data) return <Loading label={t('common.loading')} />;
  const others = pod.data.memberUids.filter((m) => m !== uid);
  const roster = pod.data.roster;

  // Keep pod / Not for me is the last answer and sends the form (storyboard 4.1).
  const send = (keep: boolean) =>
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
  const sending = submit.isPending ? submit.variables?.keep : undefined;

  return (
    <Screen>
      <ScreenHeader title={t('feedback.howDidItGo')} subtitle={t('feedback.subtitle')} backLabel={t('common.back')} onBack={router.back} />

      <View style={styles.section}>
        <SectionTitle title={t('feedback.didYouMeet')} />
        <Segmented
          options={[
            { value: 'yes', label: t('feedback.yes'), accessibilityLabel: `${t('feedback.didYouMeet')} ${t('feedback.yes')}`, testID: 'met-yes' },
            { value: 'no', label: t('feedback.no'), accessibilityLabel: `${t('feedback.didYouMeet')} ${t('feedback.no')}`, testID: 'met-no' },
          ]}
          value={met ? 'yes' : 'no'}
          onChange={(v) => setMet(v === 'yes')}
        />
      </View>

      {met && others.length > 0 ? (
        <Card gap={Spacing.xs}>
          <View style={styles.gridRow}>
            <View style={styles.nameCol}>
              <SectionTitle title={t('feedback.whoWasThere')} />
            </View>
            <AppText variant="micro" tone="muted" align="center" style={[Fonts.bold, styles.thereCol]}>
              {t('feedback.wasThere')}
            </AppText>
            <AppText variant="micro" tone="muted" align="center" style={[Fonts.bold, styles.againCol]}>
              {t('feedback.meetAgainColumn')}
            </AppText>
          </View>
          {others.map((m) => {
            const entry = roster[m];
            const name = entry?.firstName ?? '';
            const there = !notThere.has(m);
            const question = t('feedback.meetAgain', { name });
            return (
              <View key={m} style={[styles.gridRow, styles.memberRow]}>
                <View style={[styles.nameCol, styles.person]}>
                  <MemberFace uid={m} name={name} size={32} photoV={entry?.photoV} />
                  <AppText variant="bodyMd" tone={there ? 'ink' : 'muted'} style={[Fonts.semibold, styles.shrink]}>
                    {name}
                  </AppText>
                </View>
                <View style={styles.thereCol}>
                  <Checkbox testID={`there-${m}`} label={t('feedback.wasThereLabel', { name })} hideLabel checked={there} onChange={(on) => setThere(m, on)} />
                </View>
                <View style={[styles.againCol, styles.againChoices]}>
                  {there ? (
                    <>
                      <Toggle
                        testID={`again-yes-${m}`}
                        label={t('feedback.yes')}
                        accessibilityLabel={`${question} ${t('feedback.yes')}`}
                        tone="accent"
                        grow
                        value={meetAgain[m] === 'yes'}
                        onChange={(on) => answerMeetAgain(m, on ? 'yes' : null)}
                      />
                      <Toggle
                        testID={`again-no-${m}`}
                        label={t('feedback.no')}
                        accessibilityLabel={`${question} ${t('feedback.no')}`}
                        grow
                        value={meetAgain[m] === 'no'}
                        onChange={(on) => answerMeetAgain(m, on ? 'no' : null)}
                      />
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
          <AppText variant="micro" tone="muted" style={styles.gridNote}>
            {`${t('feedback.whoWasThereHint')} ${t('feedback.meetAgainEffect')}`}
          </AppText>
        </Card>
      ) : null}

      {met ? (
        <View style={styles.section}>
          <SectionTitle title={t('feedback.ratingTitle')} />
          <View style={styles.ratingRow}>
            {RATINGS.map((n) => (
              <Toggle
                key={n}
                testID={`rating-${n}`}
                label={String(n)}
                accessibilityLabel={t('feedback.ratingValue', { value: n })}
                size="lg"
                shape="rounded"
                grow
                value={rating === n}
                onChange={(on) => setRating(on ? n : undefined)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Card tone="mint" gap={10}>
        <Heading size="sm">{t('feedback.keepTitle')}</Heading>
        <AppText variant="caption" color={p.onMint}>
          {t('feedback.keepBody')}
        </AppText>
        <View style={styles.keepRow}>
          <Button
            testID="feedback-keep"
            label={t('feedback.keep')}
            variant="accent"
            size="md"
            flex={1.4}
            busy={sending === true}
            disabled={sending === false}
            onPress={() => send(true)}
          />
          <Button
            testID="feedback-not-for-me"
            label={t('feedback.notForMe')}
            variant="secondary"
            size="md"
            flex={1}
            busy={sending === false}
            disabled={sending === true}
            onPress={() => send(false)}
          />
        </View>
      </Card>
      {submit.error ? <ErrorText>{t(errorMessageKey(submit.error))}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberRow: { minHeight: 48 },
  nameCol: { flex: 1, minWidth: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shrink: { flexShrink: 1 },
  thereCol: { width: 56, alignItems: 'center' },
  // Two Yes / No chips: "meet again" can also be left open (D9), which a single checkbox could not say.
  againCol: { width: 116 },
  againChoices: { flexDirection: 'row', gap: Spacing.xs },
  gridNote: { marginTop: 6 },
  ratingRow: { flexDirection: 'row', gap: Spacing.sm },
  keepRow: { flexDirection: 'row', gap: Spacing.sm },
});
