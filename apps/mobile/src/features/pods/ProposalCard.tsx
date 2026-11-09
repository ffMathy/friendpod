import { DECLINE_REASONS, type PodCardDoc } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { Badge, Button, Chip, ChipRow, ChoiceChip, ErrorText, HeroCard, SeatRow, StatusText, Text, TextLink } from '@/components/ui';
import { usePalette, usePodColors } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { cardColor, dsColor } from '@/features/drop/color';
import { FactLine, InsetNote, NoteText } from '@/features/drop/parts';
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
 * - Colour grows with commitment (blend decision 5): the pod's tint band with its name in the pod's deep tone and the
 *   pod badge; "New pod" and the needs-you "Answer by Sat 18:00" above the name; You and open seats (a proposal never
 *   shows who has accepted); the facts with icons in the pod's deep tone; "Names and photos appear …" on Paper.
 * - The theme in the viewer's own wording, size and area, "everyone within about N km", age span and shared interests
 *   (ordinary themes only), and the deadline. Never names, photos, gender or who has accepted.
 * - A pod about a private interest stays quiet (decision 1) and shows less on purpose: white with a 1.5 px Ink border,
 *   the "Private interest" chip with a lock, the name in Ink, the private badge, no seats, no age span, no shared
 *   interests, no distance; and a link to how private interests are protected.
 * - After "I'm in": "3 of 5 said yes" with one lit seat per yes and the "4 needed" bracket, until the pod is confirmed;
 *   the deadline becomes a quiet "Open until …", and "Changed your mind? Leave this pod" is the quiet link under it.
 */
export function ProposalCard({ podId, card, confirmationMin, onDone }: ProposalCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const color = cardColor(podId, card);
  const c = usePodColors(dsColor(color));
  const respond = useCallable('respondToPod');
  const leave = useCallable('leavePod');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);
  const locale = currentLocale();
  const isPrivate = card.themeSensitive;
  const invited = card.myStatus === 'invited';
  const accepted = card.myStatus === 'accepted';
  const deadline = dayTime(card.acceptBy.toMillis(), locale);
  const near = card.reasons.find((r) => r.code === 'NEAR_YOU');
  const alsoShare = card.reasons.find((r) => r.code === 'ALSO_SHARE');
  const ageSpan = isPrivate ? undefined : card.ageSpan;
  const error = respond.error ?? leave.error;
  // Fact icons: the pod's deep tone; Ink 2 in a private pod or when the colour is not known.
  const factIcon = color === 'plain' ? p.textSecondary : c.icon;

  const pills = (
    <>
      {isPrivate ? <Chip kind="private" label={t('pods.privateInterest')} /> : null}
      {/* A badge aligns itself to the top; the wrapper centres it on the 30 px needs-you pill, as drawn. */}
      {accepted ? (
        <View>
          <Badge tone="status" icon="check" label={t('pods.youreIn')} />
        </View>
      ) : invited ? (
        isPrivate ? null : (
          <View>
            <Badge tone="status" label={t('pods.newPod')} />
          </View>
        )
      ) : (
        <View>
          <Badge tone="outline" label={t('pods.saidNo')} />
        </View>
      )}
      {invited ? <Badge tone="needsYou" label={t('pods.answerBy', deadline)} /> : null}
      {accepted ? <StatusText icon="clock" label={t('pods.openUntil', deadline)} /> : null}
    </>
  );

  const confirmLeave = () =>
    Alert.alert(t('pods.leaveTitle'), t('pods.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pods.leaveConfirm'),
        style: 'destructive',
        onPress: () => leave.mutate({ podId }),
      },
    ]);

  const saidYes = t('pods.saidYes', {
    accepted: card.acceptedCount,
    size: card.sizeTarget,
  });
  const needed = confirmationMin ? t('pods.needed', { count: confirmationMin }) : undefined;

  return (
    <>
      <HeroCard
        testID={`proposal-${podId}`}
        color={color === 'private' ? null : color}
        name={card.themeLabel ?? t('pods.openToAnyone')}
        eyebrow={card.themeLabel ? t('pods.around') : t('pods.noThemeLead')}
        pills={pills}
      >
        {invited || accepted || error ? (
          <>
            {invited ? (
              <>
                {isPrivate ? null : <SeatRow total={card.sizeTarget} lit={0} youLabel={t('common.you')} color={dsColor(color)} />}

                <View style={styles.facts}>
                  <FactLine icon="people" color={factIcon}>
                    {ageSpan
                      ? t('pods.peopleAges', {
                          count: card.sizeTarget,
                          min: ageSpan.min,
                          max: ageSpan.max,
                        })
                      : t('pods.people', { count: card.sizeTarget })}
                  </FactLine>
                  <FactLine icon="pin" color={factIcon}>
                    {!isPrivate && near?.code === 'NEAR_YOU'
                      ? t('pods.nearWithin', {
                          area: card.areaLabel,
                          km: near.km,
                        })
                      : t('pods.near', { area: card.areaLabel })}
                  </FactLine>
                  {!isPrivate && alsoShare?.code === 'ALSO_SHARE' ? (
                    <FactLine icon="tag" color={factIcon}>
                      {richText(t('pods.alsoShare', { list: slot(0) }), [boldList(t, alsoShare.yourWordings)])}
                    </FactLine>
                  ) : null}
                </View>

                {isPrivate ? (
                  <InsetNote mark="shield">
                    <NoteText>{t('pods.privateNote')}</NoteText>
                    <NoteText>{t('pods.privateReveal')}</NoteText>
                  </InsetNote>
                ) : (
                  <InsetNote mark="open">
                    <NoteText>
                      {card.state !== 'proposed'
                        ? t('pods.revealOnJoin')
                        : confirmationMin
                          ? t('pods.revealAt', { count: confirmationMin })
                          : t('pods.revealOnConfirm')}
                    </NoteText>
                  </InsetNote>
                )}
              </>
            ) : null}

            {accepted ? (
              <>
                <View style={styles.progress}>
                  {/* The seats are hidden from screen readers: this line says the same, with the threshold. */}
                  <Text variant="headline" accessibilityLabel={needed ? `${saidYes}. ${needed}.` : saidYes}>
                    {saidYes}
                  </Text>
                  <SeatRow
                    total={card.sizeTarget}
                    lit={card.acceptedCount - 1}
                    youLabel={t('common.you')}
                    color={dsColor(color)}
                    {...(confirmationMin && needed ? { needed: confirmationMin, neededLabel: needed } : {})}
                  />
                </View>
                <Text variant="small" color="textSecondary" style={styles.waiting}>
                  {t('pods.waitingBody')}
                </Text>
              </>
            ) : null}

            {error ? <ErrorText>{t(errorMessageKey(error))}</ErrorText> : null}

            {invited && !declining ? (
              <View style={styles.actions}>
                <Button label={t('pods.decline')} variant="secondary" grow={1} style={styles.pairButton} onPress={() => setDeclining(true)} />
                <Button
                  label={t('pods.accept')}
                  variant="primary"
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
                    <ChoiceChip
                      key={r}
                      size="sm"
                      label={t(`pods.declineReasons.${r}`)}
                      selected={reason === r}
                      onPress={() => setReason(reason === r ? undefined : r)}
                    />
                  ))}
                </ChipRow>
                <View style={styles.actions}>
                  <Button label={t('common.cancel')} variant="secondary" grow={1} style={styles.pairButton} onPress={() => setDeclining(false)} />
                  <Button
                    label={t('pods.confirmDecline')}
                    variant="primary"
                    grow={1.4}
                    style={styles.pairButton}
                    busy={respond.isPending}
                    onPress={() =>
                      respond.mutate({
                        podId,
                        accept: false,
                        ...(reason ? { reason } : {}),
                      })
                    }
                  />
                </View>
              </View>
            ) : null}

            {accepted && onDone ? <Button label={t('pods.okay')} variant="primary" onPress={onDone} /> : null}
          </>
        ) : null}
      </HeroCard>

      {invited && !isPrivate ? (
        <TextLink align="center" label={t('pods.whyLink')} onPress={() => router.push({ pathname: '/sheets/why-this-pod', params: { podId } })} />
      ) : null}
      {invited && isPrivate ? <TextLink align="center" label={t('pods.privateHow')} onPress={() => router.push('/info/sensitive-interests')} /> : null}
      {accepted ? <TextLink align="center" muted label={t('pods.leaveLink')} onPress={confirmLeave} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  facts: { gap: 10 },
  progress: { gap: 12 },
  // 14 px at 1.5, as drawn.
  waiting: { lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10 },
  // The storyboard's pair grows 1 : 1.4 from a zero basis (no side padding), so long labels still fit.
  pairButton: { paddingHorizontal: 0, flexBasis: 0 },
  decline: { gap: 12 },
});
