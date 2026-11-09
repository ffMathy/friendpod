import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, CloseButton, ErrorText, Headline, Loading, Text, Title } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { useBlocks, usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { BottomSheet, OptionRow } from '@/features/after/parts';
import { useChatStatus } from '@/features/chat/window';
import { podColorOf } from '@/features/pods/color';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberAvatar } from '@/features/pods/MemberAvatar';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';
import type { PodColor } from '@/lib/podColor';

/**
 * Drawn as a bottom sheet over the scrim (after-member): the screen paints the scrim itself, so it is presented
 * transparently (over the pod page), without the stack header.
 */
const SHEET_OPTIONS = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

/** What the blocker chooses besides the block itself (§3.7): by default the blocked member is removed. */
type BlockChoice = 'removeThem' | 'leave' | 'replan';

/** Pod states in which the two cannot stay in the same pod (§3.7), besides `happened` with the chat still open. */
const ACTIVE_STATES = new Set(['proposed', 'planning', 'scheduled']);

/** Splits "In your {{theme}} pod" around the theme, so the theme can be drawn as the pod chip. */
const THEME_SLOT = '\u0000';

/**
 * Member sheet (§3.7, F28, after-member) in the pod's colour context: the 72 px avatar in the pod's deep tone (or
 * their photo), the first name as Title, "In your [brætspil] pod" with the pod chip (a private pod's chip stays
 * quiet: white, Ink border and lock), "about me"; then Block and Report as Danger outline buttons with what each does
 * under it. Block asks first, inside the sheet: in an active pod the blocked member is taken out by default, the
 * blocker can leave instead and, once the meetup is scheduled (the blocked person knows the plan), re-plan it.
 * Someone already blocked can be unblocked here.
 */
export default function MemberSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId, uid: memberUid } = useLocalSearchParams<{ podId: string; uid: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const chat = useChatStatus(pod.data);
  const blocks = useBlocks(uid);
  const block = useCallable('blockUser');
  const unblock = useCallable('unblockUser');
  const [confirming, setConfirming] = useState(false);
  const [choice, setChoice] = useState<BlockChoice>('removeThem');

  const close = () => {
    if (router.canGoBack?.() ?? true) router.back();
    else router.replace({ pathname: '/pod/[podId]', params: { podId } });
  };

  const gone = !card.isLoading && !member;
  if (!pod.data && !gone) {
    return (
      <>
        <Stack.Screen options={SHEET_OPTIONS} />
        <Loading label={t('common.loading')} />
      </>
    );
  }

  const entry = pod.data?.roster[memberUid];
  const known = !!entry?.firstName;
  const name = entry?.firstName ?? '';
  const who = known ? name : t('member.thisPerson');
  const shownName = known ? name : t('member.formerMember');
  const isSelf = memberUid === uid;
  const blocked = (blocks.data ?? []).some((b) => b.id === memberUid);
  const state = pod.data?.state;
  // Inside an active pod the two cannot stay together (§3.7); in a `happened` pod that is so while the chat is open.
  const active = known && !!state && (ACTIVE_STATES.has(state) || (state === 'happened' && chat?.kind === 'open'));
  const canReplan = state === 'scheduled';
  const effective: BlockChoice = !active ? 'removeThem' : choice === 'replan' && !canReplan ? 'removeThem' : choice;
  const sensitive = card.data?.themeSensitive ?? true;
  // The pod's colour from its concept id (never the word); a private pod has none.
  const color = podColorOf(podId, pod.data, sensitive);
  const theme = card.data?.themeLabel;
  const actions = !!pod.data && !isSelf;

  const confirmBlock = () =>
    block.mutate(
      { podId, uid: memberUid, ...(effective === 'leave' ? { leave: true } : {}), ...(effective === 'replan' ? { replan: true } : {}) },
      {
        onSuccess: () => {
          // Their photo leaves this device's caches now, not only at the next app open (§9 Photos).
          void clearImageCaches().catch(() => undefined);
          close();
        },
      },
    );

  const choiceHint: Record<BlockChoice, string> = {
    removeThem: t('member.choiceRemoveHint'),
    leave: t('member.leaveHint', { name: who }),
    replan: t('member.replanExplainer'),
  };

  return (
    <>
      <Stack.Screen options={SHEET_OPTIONS} />
      <BottomSheet onClose={close} gap={20} gutter="compact" testID="member-sheet">
        <View style={styles.titleRow}>
          <MemberAvatar uid={memberUid} name={shownName} size={72} color={known ? color : null} photoV={entry && !blocked ? entry.photoV : null} />
          <View style={styles.titleText}>
            <Title numberOfLines={2}>{shownName}</Title>
            {pod.data ? (
              isSelf ? (
                <Text variant="small" color="textSecondary">
                  {t('member.you')}
                </Text>
              ) : theme ? (
                <InPodLine theme={theme} color={color} sensitive={sensitive} />
              ) : (
                <Text variant="small" color="textSecondary">
                  {t('member.inYourPod')}
                </Text>
              )
            ) : null}
          </View>
          <View style={styles.close}>
            <CloseButton onPress={close} accessibilityLabel={t('common.close')} testID="member-close" />
          </View>
        </View>

        {!pod.data ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('pod.gone')}
          </Text>
        ) : null}

        {entry?.aboutMe && !confirming ? (
          <Card variant="inset" gap={4}>
            <Text variant="eyebrow" color="textSecondary">
              {t('member.aboutMe')}
            </Text>
            <Text variant="bodySmall" color="text">
              {entry.aboutMe}
            </Text>
          </Card>
        ) : null}

        {actions && !confirming ? (
          <View style={styles.actions}>
            {blocked ? (
              <Action text={t('member.blockedAlready', { name: who })}>
                <Button
                  testID="member-unblock"
                  variant="secondary"
                  icon="block"
                  label={t('member.unblockName', { name: who })}
                  disabled={unblock.isPending}
                  busy={unblock.isPending}
                  onPress={() => unblock.mutate({ uid: memberUid })}
                />
              </Action>
            ) : (
              <Action text={active ? t('member.blockActive', { name: who }) : t('member.blockBody')}>
                <Button
                  testID="member-block"
                  variant="danger"
                  icon="block"
                  label={t('member.blockName', { name: who })}
                  onPress={() => setConfirming(true)}
                />
              </Action>
            )}
            <Action text={known ? t('member.reportBody', { name: who }) : t('member.reportBodyUnknown')}>
              <Button
                testID="member-report"
                variant="danger"
                icon="flag"
                label={t('member.reportName', { name: who })}
                onPress={() => router.push({ pathname: '/sheets/report', params: { podId, uid: memberUid } })}
              />
            </Action>
            {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
          </View>
        ) : null}

        {actions && !confirming && active ? <LeaveNote text={t('member.leaveNote')} /> : null}

        {actions && confirming ? (
          <View style={styles.confirm} testID="block-confirm">
            <View style={styles.confirmIntro}>
              <Headline>{t('member.blockTitle', { name: who })}</Headline>
              <Text variant="bodySmall" color="textSecondary">
                {t('member.blockBody')}
              </Text>
            </View>
            {active ? (
              <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('member.whatHappens')}>
                <Text variant="heading" style={styles.legend}>
                  {t('member.whatHappens')}
                </Text>
                <OptionRow testID="block-remove" label={t('member.choiceRemove', { name: who })} selected={effective === 'removeThem'} onPress={() => setChoice('removeThem')} />
                <OptionRow testID="block-leave" label={t('member.leaveInstead')} selected={effective === 'leave'} onPress={() => setChoice('leave')} />
                {canReplan ? (
                  <OptionRow testID="block-replan" label={t('member.replan')} selected={effective === 'replan'} onPress={() => setChoice('replan')} />
                ) : null}
                <Text variant="caption" color="textSecondary" style={styles.hint}>
                  {choiceHint[effective]}
                </Text>
              </View>
            ) : null}
            <View style={styles.confirmButtons}>
              <Button
                testID="member-block-confirm"
                variant="danger"
                icon="block"
                label={t('member.blockName', { name: who })}
                busy={block.isPending}
                onPress={confirmBlock}
              />
              <Button testID="member-block-cancel" variant="secondary" label={t('common.cancel')} disabled={block.isPending} onPress={() => setConfirming(false)} />
            </View>
            {block.error ? <ErrorText>{t(errorMessageKey(block.error))}</ErrorText> : null}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

/**
 * "In your [brætspil] pod": the sentence wraps around the pod chip (the pod's tint, 40 % base border and ringed dot;
 * a private pod's quiet lock chip instead). Read as one sentence.
 */
function InPodLine({ theme, color, sensitive }: { theme: string; color: PodColor | null; sensitive: boolean }) {
  const { t } = useTranslation();
  const [before = '', after = ''] = t('member.inPod', { theme: THEME_SLOT }).split(THEME_SLOT);
  return (
    <View style={styles.inPod} accessible accessibilityLabel={t('member.inPod', { theme })}>
      {before.trim() ? (
        <Text variant="small" color="textSecondary">
          {before.trim()}
        </Text>
      ) : null}
      {sensitive ? <Chip kind="private" label={theme} privateLabel={t('common.private')} /> : <Chip kind={color ? 'pod' : 'clash'} color={color} label={theme} />}
      {after.trim() ? (
        <Text variant="small" color="textSecondary">
          {after.trim()}
        </Text>
      ) : null}
    </View>
  );
}

/** A Danger outline (or, for Unblock, a secondary) button with what it does under it in 13/1.5 Ink 2. */
function Action({ children, text }: { children: ReactNode; text: string }) {
  return (
    <View style={styles.action}>
      {children}
      <Text variant="caption" color="textSecondary" style={styles.actionText}>
        {text}
      </Text>
    </View>
  );
}

/** "Want to leave instead?": quiet text under a Divider line. */
function LeaveNote({ text }: { text: string }) {
  const p = usePalette();
  return (
    <Text variant="caption" color="textSecondary" style={[styles.leave, { borderTopColor: p.separator }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  titleText: { flex: 1, minWidth: 0, gap: 6 },
  close: { alignSelf: 'flex-start' },
  inPod: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  actions: { gap: 18 },
  action: { gap: 8 },
  actionText: { paddingHorizontal: 4, lineHeight: 19.5 },
  leave: { borderTopWidth: 1, paddingTop: 14, lineHeight: 19.5 },
  confirm: { gap: 18 },
  confirmIntro: { gap: 6 },
  choices: { gap: 8 },
  legend: { lineHeight: 20, marginBottom: 2 },
  hint: { lineHeight: 19.5, paddingHorizontal: 4 },
  confirmButtons: { gap: 10 },
});
