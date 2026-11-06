import { DECLINE_REASONS, type PodCardDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { Fonts, usePalette } from '@/components/theme';
import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  ChipRow,
  ErrorText,
  Icon,
  Pill,
  SegmentBar,
  Toggle,
  type IconName,
} from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { boldList, fill, slot } from '@/features/drop/rich';
import { formatWeekdayTime } from '@/features/drop/format';
import { UnderlineLink } from '@/features/drop/UnderlineLink';
import { useWaitingNoteClosed } from '@/features/drop/waitingNote';
import { errorMessageKey } from '@/lib/errors';
import { currentLocale } from '@/i18n';

type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface ProposalCardProps {
  readonly podId: string;
  readonly card: PodCardDoc;
  /**
   * Accepts that confirm a pod in the viewer's launch area (the matching profile's `confirmationMin`: 3 in the alpha,
   * 4 at launch). Without it the card says "once the pod is confirmed" instead of a number.
   */
  readonly confirmationMin?: number;
}

/**
 * The weekly proposal (§3.2; storyboards 2.2, 2.4, 5.1): theme in the viewer's own wording, size and area, "about N km
 * or less", age span and shared interests for ordinary themes only, and the deadline. Never names, photos, gender or
 * who has accepted; after accepting, only how many said yes. A private-interest pod (5.1) shows less on purpose, in
 * violet, and keeps its lock and the photo note after the viewer accepts (2.4). While the viewer is invited, "Why this
 * pod?" sits under the card (2.2); for a private interest, so does how it is protected. After accepting (2.4) the card
 * explains the wait and ends with "Okay", which folds that note away for the session, and "Changed your mind? Leave
 * this pod" sits under it.
 */
export function ProposalCard({ podId, card, confirmationMin }: ProposalCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const respond = useCallable('respondToPod');
  const leave = useCallable('leavePod');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);
  const [noteClosed, closeNote] = useWaitingNoteClosed(podId);
  const near = card.reasons.find((r) => r.code === 'NEAR_YOU');
  const alsoShare = card.reasons.find((r) => r.code === 'ALSO_SHARE');
  const sensitive = card.themeSensitive;
  const invited = card.myStatus === 'invited';
  const accepted = card.myStatus === 'accepted';
  const theme = card.themeLabel ?? t('pods.openToAnyone');
  const deadline = formatWeekdayTime(card.acceptBy.toMillis(), currentLocale());
  const factColor = sensitive ? p.violet : p.primary;
  const error = respond.error ?? leave.error;

  const confirmLeave = () =>
    Alert.alert(t('pod.leaveTitle'), t('pod.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pod.leave'), style: 'destructive', onPress: () => leave.mutate({ podId }) },
    ]);

  const fact = (icon: IconName, text: ReactNode) => (
    <View style={styles.fact}>
      <Icon name={icon} size={20} color={factColor} style={styles.factIcon} />
      <AppText variant="bodyMd" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );

  return (
    <>
      <Card tone={sensitive ? 'violetOutline' : 'surface'} radius="xl" padding={22} gap={18}>
        <View style={styles.topRow}>
          {accepted && sensitive ? (
            // Still marked private after accepting (§3.2: lock icon if sensitive), in the 5.1 violet.
            <Pill tone="violet" icon="lock" size="lg" label={t('pods.youreIn')} />
          ) : accepted ? (
            <Pill tone="mint" icon="check" label={t('pods.youreIn')} />
          ) : sensitive ? (
            <Pill tone="violet" icon="lock" size="lg" label={t('pods.privateInterest')} />
          ) : (
            <Pill tone="amber" label={t('pods.newPod')} />
          )}
          <AppText variant="caption" tone="muted" align="right" style={[Fonts.semibold, styles.flexShrink]}>
            {accepted ? t('pods.openUntil', { when: deadline }) : t('pods.acceptBy', { when: deadline })}
          </AppText>
        </View>

        <View style={styles.themeBlock}>
          <AppText variant="bodySm" tone="muted">
            {card.themeLabel !== null ? t('pods.around') : t('pods.aroundAnyone')}
          </AppText>
          <AppText
            accessibilityRole="header"
            accessibilityLabel={sensitive ? t('interests.privateLabel', { name: theme }) : undefined}
            variant="theme"
          >
            {theme}
          </AppText>
        </View>

        {accepted ? (
          <>
            <View style={styles.progress}>
              <View style={styles.progressRow}>
                <AppText variant="headingSm" style={styles.flexShrink}>
                  {t('pods.saidYes', { accepted: card.acceptedCount, size: card.sizeTarget })}
                </AppText>
                {confirmationMin !== undefined ? (
                  <AppText variant="caption" tone="muted">
                    {t('pods.needed', { count: confirmationMin })}
                  </AppText>
                ) : null}
              </View>
              <SegmentBar total={card.sizeTarget} filled={Math.min(card.acceptedCount, card.sizeTarget)} />
            </View>
            {noteClosed ? null : (
              <AppText variant="bodySm" tone="soft">
                {t('pods.waitingBody')}
              </AppText>
            )}
            {sensitive ? (
              // Still true while waiting: names only once confirmed, and the photo stays hidden unless shown (5.1).
              <Banner tone="violet" icon={null}>
                <AppText variant="caption" color={p.violetText}>
                  {t('pods.sensitiveNotePhoto')}
                </AppText>
              </Banner>
            ) : null}
          </>
        ) : (
          <>
            {invited && !sensitive ? (
              // Seats: you plus the open places. Decorative: the size is in the line below.
              <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.seats}>
                <Avatar name="" you label={t('chat.you')} size={44} />
                {Array.from({ length: Math.max(0, card.sizeTarget - 1) }, (_, i) => (
                  <Avatar key={i} name="" size={44} placeholder />
                ))}
              </View>
            ) : null}
            <View style={styles.facts}>
              {fact(
                'people',
                !sensitive && card.ageSpan
                  ? t('pods.peopleAges', { size: card.sizeTarget, min: card.ageSpan.min, max: card.ageSpan.max })
                  : t('pods.people', { size: card.sizeTarget }),
              )}
              {fact(
                'pin',
                near && near.code === 'NEAR_YOU' ? t('pods.nearWithin', { area: card.areaLabel, km: near.km }) : t('pods.near', { area: card.areaLabel }),
              )}
              {!sensitive && alsoShare && alsoShare.code === 'ALSO_SHARE' && alsoShare.yourWordings.length > 0
                ? fact('tag', fill(t('pods.someShare', { list: slot(0) }), [boldList(alsoShare.yourWordings, t('pods.and'))]))
                : null}
            </View>
            {sensitive ? (
              <Banner tone="violet" icon={null}>
                <View style={styles.noteText}>
                  <AppText variant="caption" color={p.violetText}>
                    {t('pods.sensitiveNoteWho')}
                  </AppText>
                  <AppText variant="caption" color={p.violetText}>
                    {t('pods.sensitiveNotePhoto')}
                  </AppText>
                </View>
              </Banner>
            ) : (
              <Banner tone="subtle" icon={null}>
                {confirmationMin !== undefined ? t('pods.namesAppear', { count: confirmationMin }) : t('pods.namesAppearConfirmed')}
              </Banner>
            )}
          </>
        )}

        {error ? <ErrorText>{t(errorMessageKey(error))}</ErrorText> : null}

        {accepted && !noteClosed ? <Button label={t('pods.okay')} variant="primary" onPress={closeNote} /> : null}
        {invited && !declining ? (
          <View style={styles.buttons}>
            <View style={styles.grow}>
              <Button label={t('pods.notThisTime')} variant="secondary" onPress={() => setDeclining(true)} />
            </View>
            <View style={styles.growMore}>
              <Button
                label={t('pods.imIn')}
                variant={sensitive ? 'violet' : 'accent'}
                busy={respond.isPending}
                onPress={() => respond.mutate({ podId, accept: true })}
              />
            </View>
          </View>
        ) : null}
        {invited && declining ? (
          <View style={styles.decline}>
            <AppText variant="caption" tone="muted">
              {t('pods.declineReasonPrompt')}
            </AppText>
            <ChipRow>
              {DECLINE_REASONS.map((r) => (
                <Toggle key={r} size="sm" label={t(`pods.declineReasons.${r}`)} value={reason === r} onChange={(on) => setReason(on ? r : undefined)} />
              ))}
            </ChipRow>
            <View style={styles.buttons}>
              <View style={styles.grow}>
                <Button label={t('common.cancel')} variant="ghost" onPress={() => setDeclining(false)} />
              </View>
              <View style={styles.growMore}>
                <Button
                  label={t('pods.confirmDecline')}
                  busy={respond.isPending}
                  onPress={() => respond.mutate({ podId, accept: false, ...(reason ? { reason } : {}) })}
                />
              </View>
            </View>
          </View>
        ) : null}
      </Card>

      {accepted ? null : (
        <UnderlineLink
          label={t('pods.whyThisPodLink')}
          align="center"
          onPress={() => router.push({ pathname: '/sheets/why-this-pod', params: { podId } })}
        />
      )}
      {sensitive ? <UnderlineLink label={t('pods.howPrivateProtected')} align="center" onPress={() => router.push('/info/sensitive-interests')} /> : null}
      {accepted && card.state === 'proposed' ? (
        <UnderlineLink label={t('pods.leaveProposed')} tone="muted" role="button" align="center" onPress={confirmLeave} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  themeBlock: { gap: 6 },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facts: { gap: 12 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factIcon: { marginTop: 1 },
  noteText: { gap: 8 },
  progress: { gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  buttons: { flexDirection: 'row', gap: 10 },
  // As the storyboards' CSS flex-grow: each pill starts at its label's width and takes its share (1 : 1.4) of the
  // rest, so "Not this time" stays on one line and is the wider pill next to "I'm in" (2.2).
  grow: { flexGrow: 1, flexShrink: 1 },
  growMore: { flexGrow: 1.4, flexShrink: 1 },
  decline: { gap: 12 },
});
