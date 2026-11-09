import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Button, Card, ChoiceChip, ErrorText, Heading, Loading, Screen, Text, Title } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { GridCheck, MEET_AGAIN_WIDTH, MeetAgainChoice, QuietCheck, useTopPadding, type MeetAgain } from '@/features/after/parts';
import { podColorOf } from '@/features/pods/color';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberAvatar } from '@/features/pods/MemberAvatar';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

const HEADER_HIDDEN = { headerShown: false } as const;
const RATINGS = [1, 2, 3, 4, 5] as const;
/** Width of the "Was there" column (after-feedback grid). */
const WAS_THERE_WIDTH = 56;
/**
 * A grid row: the storyboard's 46 px plus its 1 px divider (the last row has none). React Native counts a border
 * inside the min-height, so a row with a divider asks for 47.
 */
const ROW_HEIGHT = 46;
/** The storyboard leaves 28 px above the back chevron. */
const STORYBOARD_TOP = 28;
/**
 * The "Who was there?" card's padding (12 top, 16 sides, 14 bottom). A plain object rather than a StyleSheet entry:
 * react-native-web draws the card's own padding inline, which beats a stylesheet class.
 */
const WHO_CARD_PADDING = { paddingTop: 12, paddingBottom: 14 } as const;
/** The "Meet this pod again?" card: 14 top, 16 bottom. */
const KEEP_CARD_PADDING = { paddingTop: 14, paddingBottom: 16 } as const;

/**
 * "How did it go?" (§3.6, after-feedback), opened from the push the morning after. A calm screen in the pod's colour
 * context (the members' avatars in its deep tone):
 * - "Who was there?" with everyone pre-ticked, so the user only unticks whoever was missing (D15, F30);
 * - a private "meet again" per person who was there: yes, no, or no answer (D9), the chosen answer in Ink;
 * - "I wasn't there myself" (`met: false`), a quiet check at the right of the back row so it adds no height to the
 *   storyboard's one-screen page: then no attendance and no meet-again answers are sent;
 * - an optional 1–5 rating (the selected choice in Ink);
 * - Keep pod (Skov) / Not for me (secondary), 1.4 : 1, which also send the answers.
 * None of it is shown to the others.
 */
export default function Feedback() {
  const { t } = useTranslation();
  const p = usePalette();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const submit = useCallable('submitFeedback');
  const top = useTopPadding(STORYBOARD_TOP);
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

  // `aside` sits at the right of the back row; it comes last in the tree, so screen readers reach it after the title.
  const header = (aside?: ReactNode) => (
    <View style={styles.header}>
      <BackButton onPress={goBack} accessibilityLabel={t('common.back')} />
      <Title>{t('feedback.heading')}</Title>
      <Text variant="small" color="textSecondary">
        {t('feedback.private')}
      </Text>
      {aside ? <View style={styles.aside}>{aside}</View> : null}
    </View>
  );

  if (!pod.data) {
    return (
      <>
        <Stack.Screen options={HEADER_HIDDEN} />
        <Screen safeTop gutter="compact" gap={14} contentStyle={{ paddingTop: top }}>
          {header()}
          <Card>
            <Text variant="bodySmall" color="textSecondary">
              {t('pod.gone')}
            </Text>
          </Card>
        </Screen>
      </>
    );
  }

  const others = pod.data.memberUids.filter((m) => m !== uid);
  const roster = pod.data.roster;
  // The pod's colour from its theme word (the viewer's card); a private pod's avatars stay Ink 2.
  const color = podColorOf(podId, card.data);

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
        {header(<QuietCheck testID="not-there-myself" label={t('feedback.notThereMyself')} checked={!met} onChange={(on) => setMet(!on)} />)}

        <Card gap={0} style={WHO_CARD_PADDING} testID="feedback-who">
          <View style={[styles.gridRow, styles.gridHead]}>
            <Heading style={[styles.flex, styles.heading]}>{t('feedback.whoWasThere')}</Heading>
            {met ? (
              <>
                <Text variant="microBold" color="textMuted" align="center" style={styles.thereCol} importantForAccessibility="no" accessibilityElementsHidden>
                  {t('feedback.wasThere')}
                </Text>
                <Text variant="microBold" color="textMuted" align="center" style={styles.againCol} importantForAccessibility="no" accessibilityElementsHidden>
                  {t('feedback.meetAgainColumn')}
                </Text>
              </>
            ) : null}
          </View>
          {met
            ? others.map((m, i) => {
                const name = roster[m]?.firstName ?? t('member.formerMember');
                const there = !notThere.has(m);
                const last = i === others.length - 1;
                return (
                  <View key={m} style={[styles.gridRow, last ? styles.personRow : [styles.dividedRow, { borderBottomColor: p.separator }]]}>
                    <View style={[styles.flex, styles.person]}>
                      <MemberAvatar uid={m} name={name} size={32} color={roster[m] ? color : null} photoV={roster[m]?.photoV ?? null} />
                      <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
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
          <Card variant="inset" style={styles.explainer}>
            <Text variant="caption" color="textSecondary" style={styles.explainerText}>
              {met ? t('feedback.explainer') : t('feedback.notThereMyselfBody')}
            </Text>
          </Card>
        </Card>

        {met ? (
          <View style={styles.rating} accessibilityRole="radiogroup" accessibilityLabel={t('feedback.rating')}>
            <Heading style={styles.heading}>{t('feedback.rating')}</Heading>
            <View style={styles.ratingRow}>
              {RATINGS.map((n) => (
                // Equal cells: the chip's own flex basis counts its border, which the selected (Ink) chip drops.
                <View key={n} style={styles.ratingCell}>
                  <ChoiceChip
                    testID={`rating-${n}`}
                    label={String(n)}
                    accessibilityLabel={t('feedback.ratingValue', { n })}
                    selected={rating === n}
                    onPress={() => setRating((r) => (r === n ? undefined : n))}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Card gap={8} style={KEEP_CARD_PADDING} testID="feedback-keep">
          <Heading style={styles.heading}>{t('feedback.keepTitle')}</Heading>
          <Text variant="caption" color="textSecondary" style={styles.keepBody}>
            {t('feedback.keepBody')}
          </Text>
          {/* The storyboard's 1.4 : 1, measured on the cells so the secondary button's border does not tip it. */}
          <View style={styles.buttons}>
            <View style={styles.keepCell}>
              <Button
                testID="feedback-keep-pod"
                size="md"
                fullWidth
                style={styles.pairButton}
                label={t('feedback.keep')}
                busy={submit.isPending && keepPressed === true}
                disabled={submit.isPending}
                onPress={() => send(true)}
              />
            </View>
            <View style={styles.notForMeCell}>
              <Button
                testID="feedback-not-for-me"
                size="md"
                fullWidth
                style={styles.pairButton}
                variant="secondary"
                label={t('feedback.notForMe')}
                busy={submit.isPending && keepPressed === false}
                disabled={submit.isPending}
                onPress={() => send(false)}
              />
            </View>
          </View>
          {submit.error ? <ErrorText>{t(errorMessageKey(submit.error))}</ErrorText> : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { gap: 4 },
  // The back row is 44 high: the quiet check (20 px, slop to 44) is centred in it at the right edge.
  aside: { position: 'absolute', top: 0, right: 0, height: 44, justifyContent: 'center' },
  // The storyboard's 15/20 section headings (the design system's Heading is 15/22).
  heading: { lineHeight: 20 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The column heads sit on the heading's baseline row (the storyboard's `align-items: end`).
  gridHead: { alignItems: 'flex-end', paddingBottom: 4 },
  thereCol: { width: WAS_THERE_WIDTH },
  againCol: { width: MEET_AGAIN_WIDTH },
  personRow: { minHeight: ROW_HEIGHT },
  dividedRow: { minHeight: ROW_HEIGHT + 1, borderBottomWidth: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flexShrink: 1, lineHeight: 20 },
  explainer: { marginTop: 8 },
  explainerText: { lineHeight: 19.5 },
  rating: { gap: 10 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingCell: { flex: 1, minWidth: 0 },
  keepBody: { lineHeight: 19.5 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  // Fixed shares of the row rather than label-sized ones, so the pills keep their width while busy and in Danish.
  keepCell: { flex: 1.4, minWidth: 0 },
  notForMeCell: { flex: 1, minWidth: 0 },
  pairButton: { paddingHorizontal: 8 },
});
