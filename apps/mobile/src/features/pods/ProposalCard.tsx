import { DECLINE_REASONS, type PodCardDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Button, Card, ChipRow, ChoiceChip, ErrorText, Icon, ProgressSegments, Text } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { CardLink, FactLine } from '@/features/drop/parts';
import { boldList, richText, slot } from '@/features/drop/richText';
import { dayTime } from '@/features/drop/time';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface ProposalCardProps {
  readonly podId: string;
  readonly card: PodCardDoc;
  /**
   * Accepts that confirm a pod in the viewer's area (its matching profile's `confirmationMin`). With it the card says
   * "Names and photos appear when 4 people have said yes" and "4 needed"; without it, it does not name a number.
   */
  readonly confirmationMin?: number;
  /** "Okay" on the waiting card (Home folds the card away). Without it the button is not shown. */
  readonly onDone?: () => void;
}

/**
 * The weekly proposal (drop-proposal, priv-sensitive, drop-waiting; §3.2–3.3) and the link under it.
 *
 * - Theme in the viewer's own wording, size and area, "everyone within about N km", age span and shared interests
 *   (ordinary themes only), and the deadline. Never names, photos, gender or who has accepted.
 * - A pod about a private interest shows less on purpose (no age span, no shared interests, no distance), in purple,
 *   and links to how private interests are protected.
 * - After "I'm in": "3 of 5 said yes" until the pod is confirmed, and "Changed your mind? Leave this pod".
 */
export function ProposalCard({ podId, card, confirmationMin, onDone }: ProposalCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const respond = useCallable('respondToPod');
  const leave = useCallable('leavePod');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);
  const locale = currentLocale();
  const isPrivate = card.themeSensitive;
  const tone = isPrivate ? ('private' as const) : undefined;
  const invited = card.myStatus === 'invited';
  const accepted = card.myStatus === 'accepted';
  const deadline = dayTime(card.acceptBy.toMillis(), locale);
  const near = card.reasons.find((r) => r.code === 'NEAR_YOU');
  const alsoShare = card.reasons.find((r) => r.code === 'ALSO_SHARE');
  const ageSpan = isPrivate ? undefined : card.ageSpan;
  const error = respond.error ?? leave.error;

  const badge = accepted ? (
    <Badge tone="mint" icon="check" label={t('pods.youreIn')} />
  ) : invited ? (
    isPrivate ? (
      // The private badge is drawn 2 px taller than the others (30 px, r15), as on the storyboard.
      <View style={[styles.privateBadge, { backgroundColor: p.privateBg }]}>
        <Icon name="lock" size={14} strokeWidth={2.2} color={p.privateText} />
        <Text variant="badge" color="privateText">
          {t('pods.privateInterest')}
        </Text>
      </View>
    ) : (
      <Badge tone="accent" label={t('pods.newPod')} />
    )
  ) : (
    <Badge tone="outline" label={t('pods.saidNo')} />
  );

  const confirmLeave = () =>
    Alert.alert(t('pods.leaveTitle'), t('pods.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pods.leaveConfirm'), style: 'destructive', onPress: () => leave.mutate({ podId }) },
    ]);

  return (
    <>
      <Card variant="panel" tone={tone} testID={`proposal-${podId}`}>
        <View style={styles.topRow}>
          {badge}
          {invited || accepted ? (
            <Text variant="captionStrong" color="textMuted" style={styles.deadline}>
              {t(accepted ? 'pods.openUntil' : 'pods.answerBy', deadline)}
            </Text>
          ) : null}
        </View>

        <View style={styles.theme}>
          <Text variant="small" color="textMuted" style={styles.lead}>
            {card.themeLabel ? t('pods.around') : t('pods.noThemeLead')}
          </Text>
          <View style={styles.themeRow}>
            <Text accessibilityRole="header" variant="theme" style={styles.flexShrink}>
              {card.themeLabel ?? t('pods.openToAnyone')}
            </Text>
            {isPrivate && !invited ? <Icon name="lock" size={22} color={p.privateText} accessibilityLabel={t('pods.privateInterest')} /> : null}
          </View>
        </View>

        {invited ? (
          <>
            {isPrivate ? null : (
              <View style={styles.seats} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Avatar you youLabel={t('common.you')} size={44} />
                {Array.from({ length: Math.max(0, card.sizeTarget - 1) }, (_, i) => (
                  <Avatar key={i} placeholder size={44} />
                ))}
              </View>
            )}

            <View style={styles.facts}>
              <FactLine icon="people" tone={tone}>
                {ageSpan ? t('pods.peopleAges', { count: card.sizeTarget, min: ageSpan.min, max: ageSpan.max }) : t('pods.people', { count: card.sizeTarget })}
              </FactLine>
              <FactLine icon="pin" tone={tone}>
                {!isPrivate && near?.code === 'NEAR_YOU' ? t('pods.nearWithin', { area: card.areaLabel, km: near.km }) : t('pods.near', { area: card.areaLabel })}
              </FactLine>
              {!isPrivate && alsoShare?.code === 'ALSO_SHARE' ? (
                <FactLine icon="tag" top>
                  {richText(t('pods.alsoShare', { list: slot(0) }), [boldList(t, alsoShare.yourWordings)])}
                </FactLine>
              ) : null}
            </View>

            {isPrivate ? (
              <View style={[styles.privateNote, { backgroundColor: p.privateBg }]}>
                <Text variant="caption" color="privateInk" style={styles.note}>
                  {t('pods.privateNote')}
                </Text>
                <Text variant="caption" color="privateInk" style={styles.note}>
                  {t('pods.privateReveal')}
                </Text>
              </View>
            ) : (
              <Card variant="inset">
                <Text variant="caption" color="textMuted" style={styles.note}>
                  {card.state !== 'proposed'
                    ? t('pods.revealOnJoin')
                    : confirmationMin
                      ? t('pods.revealAt', { count: confirmationMin })
                      : t('pods.revealOnConfirm')}
                </Text>
              </Card>
            )}
          </>
        ) : null}

        {accepted ? (
          <>
            <View style={styles.progress}>
              <View style={styles.progressRow}>
                <Text variant="numeral">{t('pods.saidYes', { accepted: card.acceptedCount, size: card.sizeTarget })}</Text>
                {confirmationMin ? (
                  <Text variant="caption" color="textMuted" style={styles.needed}>
                    {t('pods.needed', { count: confirmationMin })}
                  </Text>
                ) : null}
              </View>
              <ProgressSegments total={card.sizeTarget} filled={card.acceptedCount} />
            </View>
            <Text variant="small" color="textSecondary">
              {t('pods.waitingBody')}
            </Text>
          </>
        ) : null}

        {error ? <ErrorText>{t(errorMessageKey(error))}</ErrorText> : null}

        {invited && !declining ? (
          <View style={styles.actions}>
            <Button label={t('pods.decline')} variant="outline" grow={1} style={styles.pairButton} onPress={() => setDeclining(true)} />
            <Button
              label={t('pods.accept')}
              variant={isPrivate ? 'private' : 'primary'}
              grow={1.4}
              style={styles.pairButton}
              busy={respond.isPending}
              onPress={() => respond.mutate({ podId, accept: true })}
            />
          </View>
        ) : null}

        {invited && declining ? (
          <View style={styles.decline}>
            <Text variant="caption" color="textMuted">
              {t('pods.declineReasonPrompt')}
            </Text>
            <ChipRow>
              {DECLINE_REASONS.map((r) => (
                <ChoiceChip key={r} size="sm" label={t(`pods.declineReasons.${r}`)} selected={reason === r} onPress={() => setReason(reason === r ? undefined : r)} />
              ))}
            </ChipRow>
            <View style={styles.actions}>
              <Button label={t('common.cancel')} variant="outline" grow={1} style={styles.pairButton} onPress={() => setDeclining(false)} />
              <Button
                label={t('pods.confirmDecline')}
                variant="dark"
                grow={1.4}
                style={styles.pairButton}
                busy={respond.isPending}
                onPress={() => respond.mutate({ podId, accept: false, ...(reason ? { reason } : {}) })}
              />
            </View>
          </View>
        ) : null}

        {accepted && onDone ? <Button label={t('pods.okay')} variant="dark" onPress={onDone} /> : null}
      </Card>

      {invited && !isPrivate ? (
        <CardLink label={t('pods.whyLink')} onPress={() => router.push({ pathname: '/sheets/why-this-pod', params: { podId } })} />
      ) : null}
      {invited && isPrivate ? <CardLink tone="private" label={t('pods.privateHow')} onPress={() => router.push('/info/sensitive-interests')} /> : null}
      {accepted ? <CardLink tone="muted" label={t('pods.leaveLink')} onPress={confirmLeave} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  // Badge left, deadline right (space-between, as drawn); the deadline moves under the badge only when both do not
  // fit on one line (large text). The 8 px minimum gap keeps "Privat interesse" and "Svar senest lør. kl. 18.00" on one.
  topRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, rowGap: 8 },
  deadline: { textAlign: 'right' },
  theme: { gap: 6 },
  // 14 px at the font's natural line height (1.26): the storyboard's lead sets none.
  lead: { lineHeight: 18 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seats: { flexDirection: 'row', gap: 8 },
  facts: { gap: 12 },
  privateNote: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  // 13 px at 1.5, unrounded as drawn (the caption's rounded 20 px adds a pixel every two lines).
  note: { lineHeight: 19.5 },
  privateBadge: { height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  progress: { gap: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  // 13 px at the font's natural line height: a taller line box would hang below the 17 px count on the baseline.
  needed: { lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  // The storyboard's pair grows 1 : 1.4 from the labels' own widths (no side padding); padding would even it out.
  pairButton: { paddingHorizontal: 0 },
  decline: { gap: 12 },
});
