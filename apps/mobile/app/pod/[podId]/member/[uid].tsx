import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, CloseButton, ErrorText, Headline, Loading, Radio, Text } from '@/components/ui';
import { useBlocks, usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { ActionRow, BottomSheet } from '@/features/after/parts';
import { useChatStatus } from '@/features/chat/window';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberAvatar } from '@/features/pods/MemberAvatar';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/**
 * Drawn as a bottom sheet over a dimmed backdrop (after-member): the screen paints the backdrop itself, so it is
 * presented transparently (over the pod page), without the stack header.
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

/**
 * Member sheet (§3.7, F28, after-member): avatar (with their photo), first name, "about me"; Block and Report. Block
 * asks first, inside the sheet: in an active pod the blocked member is taken out by default, the blocker can leave
 * instead and, once the meetup is scheduled (the blocked person knows the plan), re-plan it. Someone already blocked
 * can be unblocked here.
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
  const isSelf = memberUid === uid;
  const blocked = (blocks.data ?? []).some((b) => b.id === memberUid);
  const state = pod.data?.state;
  // Inside an active pod the two cannot stay together (§3.7); in a `happened` pod that is so while the chat is open.
  const active = known && !!state && (ACTIVE_STATES.has(state) || (state === 'happened' && chat?.kind === 'open'));
  const canReplan = state === 'scheduled';
  const effective: BlockChoice = !active ? 'removeThem' : choice === 'replan' && !canReplan ? 'removeThem' : choice;
  const theme = card.data?.themeLabel;
  const subtitle = isSelf ? t('member.you') : theme ? t('member.inPod', { theme }) : t('member.inYourPod');

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
      <BottomSheet onClose={close} testID="member-sheet">
        <View style={styles.titleRow}>
          <MemberAvatar uid={memberUid} name={known ? name : t('member.formerMember')} size={64} photoV={entry && !blocked ? entry.photoV : null} />
          <View style={styles.titleText}>
            <Headline numberOfLines={2}>{known ? name : t('member.formerMember')}</Headline>
            {pod.data ? (
              <Text variant="small" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <CloseButton onPress={close} accessibilityLabel={t('common.close')} testID="member-close" />
        </View>

        {!pod.data ? (
          <Text variant="body" color="textSecondary">
            {t('pod.gone')}
          </Text>
        ) : null}

        {entry?.aboutMe && !confirming ? (
          <Card variant="inset" gap={2} padding={14}>
            <Text variant="captionBold" color="textMuted">
              {t('member.aboutMe')}
            </Text>
            <Text variant="body" color="text">
              {entry.aboutMe}
            </Text>
          </Card>
        ) : null}

        {pod.data && !isSelf && !confirming ? (
          <View style={styles.actions}>
            {blocked ? (
              <ActionRow
                testID="member-unblock"
                icon="block"
                title={t('member.unblockName', { name: who })}
                body={t('member.blockedAlready', { name: who })}
                disabled={unblock.isPending}
                onPress={() => unblock.mutate({ uid: memberUid })}
              />
            ) : (
              <ActionRow
                testID="member-block"
                icon="block"
                title={t('member.blockName', { name: who })}
                body={active ? t('member.blockActive', { name: who }) : t('member.blockBody')}
                onPress={() => setConfirming(true)}
              />
            )}
            <ActionRow
              testID="member-report"
              tone="danger"
              icon="flag"
              title={t('member.reportName', { name: who })}
              body={known ? t('member.reportBody', { name: who }) : t('member.reportBodyUnknown')}
              onPress={() => router.push({ pathname: '/sheets/report', params: { podId, uid: memberUid } })}
            />
            {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
          </View>
        ) : null}

        {pod.data && !isSelf && !confirming && active ? (
          <Text variant="caption" color="textMuted">
            {t('member.leaveNote')}
          </Text>
        ) : null}

        {pod.data && !isSelf && confirming ? (
          <View style={styles.confirm} testID="block-confirm">
            <View style={styles.confirmIntro}>
              <Text accessibilityRole="header" variant="cardTitle">
                {t('member.blockTitle', { name: who })}
              </Text>
              <Text variant="small" color="textMuted">
                {t('member.blockBody')}
              </Text>
            </View>
            {active ? (
              <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('member.whatHappens')}>
                <Text variant="heading">{t('member.whatHappens')}</Text>
                <Radio testID="block-remove" label={t('member.choiceRemove', { name: who })} selected={effective === 'removeThem'} onPress={() => setChoice('removeThem')} />
                <Radio testID="block-leave" label={t('member.leaveInstead')} selected={effective === 'leave'} onPress={() => setChoice('leave')} />
                {canReplan ? (
                  <Radio testID="block-replan" label={t('member.replan')} selected={effective === 'replan'} onPress={() => setChoice('replan')} />
                ) : null}
                <Text variant="caption" color="textMuted">
                  {choiceHint[effective]}
                </Text>
              </View>
            ) : null}
            <View style={styles.confirmButtons}>
              <Button
                testID="member-block-confirm"
                variant="danger"
                label={t('member.blockName', { name: who })}
                busy={block.isPending}
                onPress={confirmBlock}
              />
              <Button testID="member-block-cancel" variant="ghost" label={t('common.cancel')} disabled={block.isPending} onPress={() => setConfirming(false)} />
            </View>
            {block.error ? <ErrorText>{t(errorMessageKey(block.error))}</ErrorText> : null}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  titleText: { flex: 1, gap: 2 },
  actions: { gap: 10 },
  confirm: { gap: 16 },
  confirmIntro: { gap: 4 },
  choices: { gap: 8 },
  confirmButtons: { gap: 4 },
});
