import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Button, Card, ChoiceChip, ErrorText, Heading, Loading, Screen, Text, Title } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { GridCheck, MEET_AGAIN_WIDTH, MeetAgainChoice, SmallCheck, useTopPadding, type MeetAgain } from '@/features/after/parts';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberAvatar } from '@/features/pods/MemberAvatar';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

const HEADER_HIDDEN = { headerShown: false } as const;
const RATINGS = [1, 2, 3, 4, 5] as const;
/** Width of the "Was there" column (after-feedback grid). */
const WAS_THERE_WIDTH = 56;
/**
 * "Keep pod" against "Not for me" (1). The storyboard grows label-sized pills 1.4 : 1, which on its 310 px row
 * comes to about 164 : 146 px; this share gives the same widths from a zero basis.
 */
const KEEP_GROW = 1.16;
/**
 * The "Who was there?" card's 14 px top and bottom padding (16 at the sides, the card's own). A plain object rather
 * than a StyleSheet entry: react-native-web draws the card's own padding inline, which beats a stylesheet class.
 */
const WHO_CARD_PADDING = { paddingTop: 14, paddingBottom: 14 } as const;

/**
 * "How did it go?" (§3.6, after-feedback), opened from the push the morning after:
 * - "Who was there?" with everyone pre-ticked, so the user only unticks whoever was missing (D15, F30);
 * - a private "meet again" per person who was there: yes, no, or no answer (D9);
 * - "I wasn't there myself" (`met: false`): then no attendance and no meet-again answers are sent;
 * - an optional 1–5 rating;
 * - Keep pod / Not for me, which also sends the answers.
 * None of it is shown to the others.
 */
export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const submit = useCallable('submitFeedback');
  const top = useTopPadding();
  const [met, setMet] = useState(true);
  const [notThere, setNotThere] = useState<ReadonlySet<string>>(new Set());
  const [meetAgain, setMeetAgain] = useState<Readonly<Record<string, MeetAgain>>>({});
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [keepPressed, setKeepPressed] = useState<boolean | null>(null);

  const goBack = () => {
    if (router.canGoBack?.() ?? true) router.back();
    else router.replace({ pathname: '/pod/[podId]', params: { podId } });
  };

  const answerMeetAgain = (m: string, answer: MeetAgain | undefined) =>
    setMeetAgain((x) => {
      const { [m]: _dropped, ...rest } = x;
      return answer ? { ...rest, [m]: answer } : rest;
    });

  const toggleThere = (m: string, there: boolean) =>
    setNotThere((s) => {
      const next = new Set(s);
      if (there) next.delete(m);
      else next.add(m);
      return next;
    });

  const gone = !card.isLoading && !member;
  if (!pod.data && !gone) {
    return (
      <>
        <Stack.Screen options={HEADER_HIDDEN} />
        <Loading label={t('common.loading')} />
      </>
    );
  }

  const header = (
    <View style={styles.header}>
      <BackButton onPress={goBack} accessibilityLabel={t('common.back')} />
      <Title style={styles.title}>{t('feedback.heading')}</Title>
      <Text variant="small" color="textMuted" style={styles.subtitle}>
        {t('feedback.private')}
      </Text>
    </View>
  );

  if (!pod.data) {
    return (
      <>
        <Stack.Screen options={HEADER_HIDDEN} />
        <Screen safeTop gutter="compact" gap={14} contentStyle={{ paddingTop: top }}>
          {header}
          <Text variant="body" color="textSecondary">
            {t('pod.gone')}
          </Text>
        </Screen>
      </>
    );
  }

  const others = pod.data.memberUids.filter((m) => m !== uid);
  const roster = pod.data.roster;

  const send = (keep: boolean) => {
    setKeepPressed(keep);
    submit.mutate(
      {
        podId,
        met,
        notThere: met ? others.filter((m) => notThere.has(m)) : [],
        // Only people who were there can be met again; no answer means no signal.
        meetAgain: met
          ? Object.fromEntries(others.flatMap((m) => (!notThere.has(m) && meetAgain[m] ? [[m, meetAgain[m] === 'yes'] as const] : [])))
          : {},
        ...(met && rating !== undefined ? { rating } : {}),
        keep,
      },
      { onSuccess: goBack },
    );
  };

  return (
    <>
      <Stack.Screen options={HEADER_HIDDEN} />
      <Screen safeTop gutter="compact" gap={14} contentStyle={{ paddingTop: top }}>
        {header}

        <Card gap={4} style={WHO_CARD_PADDING} testID="feedback-who">
          <View style={[styles.gridRow, styles.gridHead]}>
            <Heading style={[styles.flex, styles.heading]}>{t('feedback.whoWasThere')}</Heading>
            {met ? (
              <>
                <Text variant="microBold" color="textMuted" align="center" style={[styles.thereCol, styles.colHead]} importantForAccessibility="no" accessibilityElementsHidden>
                  {t('feedback.wasThere')}
                </Text>
                <Text variant="microBold" color="textMuted" align="center" style={[styles.againCol, styles.colHead]} importantForAccessibility="no" accessibilityElementsHidden>
                  {t('feedback.meetAgainColumn')}
                </Text>
              </>
            ) : null}
          </View>
          {met
            ? others.map((m) => {
                const name = roster[m]?.firstName ?? t('member.formerMember');
                const there = !notThere.has(m);
                return (
                  <View key={m} style={[styles.gridRow, styles.personRow]}>
                    <View style={[styles.flex, styles.person]}>
                      <MemberAvatar uid={m} name={name} size={32} photoV={roster[m]?.photoV ?? null} />
                      <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
                        {name}
                      </Text>
                    </View>
                    <View style={[styles.thereCol, styles.center]}>
                      <GridCheck testID={`there-${m}`} label={t('feedback.cameLabel', { name })} checked={there} onChange={(on) => toggleThere(m, on)} />
                    </View>
                    <View style={[styles.againCol, styles.center]}>
                      {there ? (
                        <MeetAgainChoice
                          testID={`again-${m}`}
                          value={meetAgain[m]}
                          onChange={(answer) => answerMeetAgain(m, answer)}
                          yesLabel={t('feedback.yes')}
                          noLabel={t('feedback.no')}
                          yesAccessibilityLabel={t('feedback.meetAgainYes', { name })}
                          noAccessibilityLabel={t('feedback.meetAgainNo', { name })}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })
            : null}
          <Text variant="micro" color="textMuted" style={styles.explainer}>
            {met ? t('feedback.explainer') : t('feedback.notThereMyselfBody')}
          </Text>
          <SmallCheck testID="not-there-myself" label={t('feedback.notThereMyself')} checked={!met} onChange={(on) => setMet(!on)} />
        </Card>

        {met ? (
          <View style={styles.rating} accessibilityRole="radiogroup" accessibilityLabel={t('feedback.rating')}>
            <Heading style={styles.heading}>{t('feedback.rating')}</Heading>
            <View style={styles.ratingRow}>
              {RATINGS.map((n) => (
                <ChoiceChip
                  key={n}
                  size="lg"
                  fill
                  testID={`rating-${n}`}
                  label={String(n)}
                  accessibilityLabel={t('feedback.ratingValue', { n })}
                  selected={rating === n}
                  onPress={() => setRating((r) => (r === n ? undefined : n))}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Card gap={10} testID="feedback-keep">
          <Heading style={styles.heading}>{t('feedback.keepTitle')}</Heading>
          <Text variant="caption" color="textSecondary" style={styles.keepBody}>
            {t('feedback.keepBody')}
          </Text>
          <View style={styles.buttons}>
            <Button
              testID="feedback-keep-pod"
              size="md"
              grow={KEEP_GROW}
              style={styles.pairButton}
              label={t('feedback.keep')}
              busy={submit.isPending && keepPressed === true}
              disabled={submit.isPending}
              onPress={() => send(true)}
            />
            <Button
              testID="feedback-not-for-me"
              size="md"
              grow={1}
              style={styles.pairButton}
              variant="secondary"
              label={t('feedback.notForMe')}
              busy={submit.isPending && keepPressed === false}
              disabled={submit.isPending}
              onPress={() => send(false)}
            />
          </View>
          {submit.error ? <ErrorText>{t(errorMessageKey(submit.error))}</ErrorText> : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { gap: 6 },
  // The storyboard's title and subtitle sit at the browser's "normal" line height (38 at 30 px, 18 at 14 px).
  title: { lineHeight: 38 },
  subtitle: { lineHeight: 18 },
  // The 15 px section headings at the same "normal" line height (19), as the storyboard's h2 and legend.
  heading: { lineHeight: 19 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gridHead: { paddingBottom: 4 },
  thereCol: { width: WAS_THERE_WIDTH },
  // The storyboard's column heads sit at the browser's "normal" line height for 12 px.
  colHead: { lineHeight: 15 },
  againCol: { width: MEET_AGAIN_WIDTH },
  personRow: { minHeight: 44 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 1 px under the explainer (the storyboard's 4 less the room the "I wasn't there myself" row needs), so the
  // card still ends where the storyboard's does.
  explainer: { marginTop: 6, marginBottom: 1 },
  rating: { gap: 10 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  keepBody: { lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: 8 },
  // Fixed shares of the row rather than label-sized ones, so the pills keep their width while busy and in Danish.
  pairButton: { flexBasis: 0, paddingHorizontal: 8 },
});
