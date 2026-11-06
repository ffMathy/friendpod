import type { PodState } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, type AlertButton, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts, Spacing, usePalette } from '@/components/theme';
import { AppText, Body, Button, Card, ErrorText, Grabber, Icon, IconButton } from '@/components/ui';
import { useBlocks, usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { useChatStatus } from '@/features/chat/window';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberFace } from '@/features/safety/MemberFace';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/** What the blocker chooses besides the block itself (§3.7): by default the blocked member is removed. */
type BlockChoice = 'removeThem' | 'leave' | 'replan';

/**
 * Where a block takes someone out of the pod (§3.7, as `applyBlock` decides): these states, and `happened` while its
 * meetup chat is open. Elsewhere both simply stay, so there is nobody to remove and nothing to leave instead.
 */
const REMOVING_STATES: ReadonlySet<PodState> = new Set(['proposed', 'planning', 'scheduled']);

/**
 * Member sheet (§3.7, F28, storyboard 4.2): a bottom sheet with the first name, photo and "about me"; a single Block row
 * (two-way, immediate) whose confirmation offers leaving instead and, once the meetup is scheduled (the blocked person
 * knows the plan), re-planning it; unblock; report. The sheet sizes to its content (no `flex: 1`), so it suits a
 * fit-to-contents form sheet.
 */
export default function MemberSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId, uid: memberUid } = useLocalSearchParams<{ podId: string; uid: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const pod = usePod(podId, isConfirmedMember(card.data));
  const blocks = useBlocks(uid);
  const block = useCallable('blockUser');
  const unblock = useCallable('unblockUser');
  const chat = useChatStatus(pod.data?.state === 'happened' ? pod.data : null);

  if (!pod.data) {
    return (
      <View style={[styles.loading, { backgroundColor: p.surface }]}>
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.primary} />
      </View>
    );
  }
  const entry = pod.data.roster[memberUid];
  const isSelf = memberUid === uid;
  const name = entry?.firstName ?? '';
  const blocked = (blocks.data ?? []).some((b) => b.id === memberUid);
  // Both are still in this pod, so the block takes one of them out: the blocked member, or the blocker by choice.
  const removes = entry !== undefined && (REMOVING_STATES.has(pod.data.state) || chat?.kind === 'open');
  const canReplan = removes && pod.data.state === 'scheduled';
  // The theme in the viewer's own wording; a private (sensitive) theme is left out of this sheet.
  const theme = card.data && !card.data.themeSensitive ? card.data.themeLabel : null;
  // The pod page offers "Leave pod" until the pod is archived; the footnote points there (storyboard 4.2).
  const canLeave = !!card.data && card.data.state !== 'archived';

  const runBlock = (choice: BlockChoice) =>
    block.mutate(
      { podId, uid: memberUid, ...(choice === 'leave' ? { leave: true } : {}), ...(choice === 'replan' ? { replan: true } : {}) },
      {
        onSuccess: () => {
          // Their photo leaves this device's caches now, not only at the next app open (§9 Photos).
          void clearImageCaches().catch(() => undefined);
          router.back();
        },
      },
    );

  // A scheduled pod's second question (§3.7): the blocked person knows the plan. Android shows at most three alert
  // buttons, so re-planning is its own step rather than a fourth button; Cancel still drops the whole block.
  const askReplan = () =>
    Alert.alert(t('member.replanTitle'), t('member.replanExplainer'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('member.blockKeepPlan'), style: 'destructive', onPress: () => runBlock('removeThem') },
      { text: t('member.blockAndReplan'), style: 'destructive', onPress: () => runBlock('replan') },
    ]);

  const confirmBlock = () => {
    const buttons: AlertButton[] = [{ text: t('common.cancel'), style: 'cancel' }];
    if (removes) buttons.push({ text: t('member.blockAndLeave'), onPress: () => runBlock('leave') });
    buttons.push({ text: t('member.block'), style: 'destructive', onPress: canReplan ? askReplan : () => runBlock('removeThem') });
    Alert.alert(t('member.blockTitle', { name }), removes ? t('member.blockConfirmActive', { name }) : t('member.blockBody'), buttons);
  };

  const blockLabel = entry ? t('member.blockName', { name }) : t('member.block');
  const blockBody = !entry ? t('member.blockExplainer') : removes ? t('member.blockRowBodyActive', { name }) : t('member.blockBody');
  const reportLabel = entry ? t('member.reportName', { name }) : t('member.report');
  const reportBody = entry ? t('report.anonymousName', { name }) : t('report.intro');

  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: p.surface }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.sheet} bounces={false} keyboardShouldPersistTaps="handled">
        <Grabber />
        <View style={styles.header}>
          <MemberFace
            uid={memberUid}
            name={name}
            size={64}
            photoV={entry && !blocked ? entry.photoV : null}
            photoLabel={t('pod.photoOf', { name })}
            placeholder={!entry}
          />
          <View style={styles.headerText}>
            <AppText accessibilityRole="header" variant="titleSm">
              {entry?.firstName ?? t('member.formerMember')}
            </AppText>
            {entry ? (
              <AppText variant="bodySm" tone="muted">
                {theme ? t('member.inPod', { theme }) : t('member.inYourPod')}
              </AppText>
            ) : null}
          </View>
          <IconButton icon="close" label={t('common.close')} onPress={router.back} iconSize={22} style={styles.close} />
        </View>

        {entry?.aboutMe ? (
          <Card tone="inset" gap={Spacing.xs}>
            <AppText variant="overline" tone="muted">
              {t('aboutMe.label')}
            </AppText>
            <Body size="md">{entry.aboutMe}</Body>
          </Card>
        ) : null}

        {isSelf ? null : (
          <View style={styles.actions}>
            {blocked ? (
              <View style={[styles.actionCard, { backgroundColor: p.surface, borderColor: p.borderStrong }]}>
                <View style={styles.actionHead}>
                  <Icon name="block" size={22} color={p.ink} />
                  <AppText variant="body" style={[Fonts.bold, styles.actionText]}>
                    {t('member.blockedAlready', { name })}
                  </AppText>
                </View>
                <View style={styles.actionFoot}>
                  <Button
                    testID="member-unblock"
                    label={t('settings.blocked.unblock')}
                    variant="secondary"
                    size="sm"
                    inline
                    busy={unblock.isPending}
                    onPress={() => unblock.mutate({ uid: memberUid })}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                testID="member-block"
                accessibilityRole="button"
                accessibilityLabel={blockLabel}
                accessibilityHint={blockBody}
                accessibilityState={{ disabled: block.isPending, busy: block.isPending }}
                disabled={block.isPending}
                onPress={confirmBlock}
                style={({ pressed }) => [
                  styles.actionCard,
                  styles.actionHead,
                  { backgroundColor: pressed ? p.subtle : p.surface, borderColor: p.borderStrong },
                ]}
              >
                <Icon name="block" size={22} color={p.ink} />
                <View style={styles.actionText}>
                  <AppText variant="body" style={Fonts.bold}>
                    {blockLabel}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {blockBody}
                  </AppText>
                </View>
                {block.isPending ? <ActivityIndicator color={p.ink} /> : null}
              </Pressable>
            )}
            {block.error ? <ErrorText>{t(errorMessageKey(block.error))}</ErrorText> : null}
            {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}

            <Pressable
              testID="member-report"
              accessibilityRole="button"
              accessibilityLabel={reportLabel}
              accessibilityHint={reportBody}
              onPress={() => router.push({ pathname: '/sheets/report', params: { podId, uid: memberUid } })}
              style={({ pressed }) => [styles.actionCard, styles.actionHead, { backgroundColor: p.coralBg, borderColor: p.coralBorder }, pressed && styles.pressed]}
            >
              <Icon name="flag" size={22} color={p.coralText} />
              <View style={styles.actionText}>
                <AppText variant="body" tone="coral" style={Fonts.bold}>
                  {reportLabel}
                </AppText>
                <AppText variant="caption" color={p.coralTextSoft}>
                  {reportBody}
                </AppText>
              </View>
            </Pressable>
          </View>
        )}

        {!isSelf && canLeave ? (
          <AppText testID="member-leave-note" variant="caption" tone="muted">
            {t('member.leaveNote')}
          </AppText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  // Sizes to its content and scrolls only when the sheet is shorter than it (large text).
  scroll: { flexGrow: 0 },
  sheet: { paddingTop: 10, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: Spacing.xxs },
  close: { marginRight: -10 },
  actions: { gap: 10 },
  actionCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  actionHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.ms, paddingVertical: 10, paddingHorizontal: Spacing.md },
  actionText: { flex: 1, gap: Spacing.xxs },
  actionFoot: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.ms },
  pressed: { opacity: 0.75 },
});
