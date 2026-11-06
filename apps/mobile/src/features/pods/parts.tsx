/**
 * Building blocks of the pod screens (pod-confirmed, pod-scheduled, pod-plan, pod-chat storyboards): the page frame
 * with the tab bar, the page header with the theme, the pod menu, the dark "Next step" card, the folding "Meeting
 * safely" card, a small text link that can carry its own accessibility label, and the chat's grey system note.
 * Member avatars are in MemberAvatar.tsx.
 */
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Card, Eyebrow, IconButton, Icon, ListRow, ListSection, Text, TextLink } from '@/components/ui';
import { Layout, usePalette, type PaletteKey, type TypeVariant } from '@/components/theme';
import { PodSheet } from './PodSheet';
import { PodTabBar } from './PodTabBar';

/**
 * Top padding of a pod page that draws its own header (the storyboards leave 28–32 px above it). Under a status bar
 * the safe-area inset already gives most of that room, so the page adds only what is missing.
 */
export function usePodTopPadding(storyboardTop = 28): number {
  const insets = useSafeAreaInsets();
  return Math.max(8, storyboardTop - insets.top);
}

/** Back from a pod page: the previous screen, or the Pods tab when the page was opened from a notification. */
export function goBack(router: ReturnType<typeof useRouter>): void {
  if (router.canGoBack?.()) router.back();
  else router.replace('/pods');
}

export interface PodPageProps {
  readonly children: ReactNode;
  /** Pinned under the scrolling blocks ("Plan the meetup" and its deadline, "Done voting"). */
  readonly footer?: ReactNode;
  /** Space between blocks: 14 or 16 on the storyboards. */
  readonly gap?: number;
  /** Space above the first block: 28 or 32 on the storyboards (less what the status bar already gives). */
  readonly top?: number;
  /** The main tab bar with Pods selected (pod-confirmed, pod-scheduled); without it the page ends 28 px above the edge. */
  readonly tabBar?: boolean;
  readonly testID?: string;
}

/**
 * The frame of a pod page, as the storyboards draw it: a 20 px gutter, the blocks in a scroll view, an optional
 * pinned footer, and the tab bar (`main` padding 28–32 / 20 / 16 above the 80 px nav), or 28 px to the bottom edge.
 */
export function PodPage({ children, footer, gap = 16, top = 28, tabBar = false, testID }: PodPageProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const padTop = usePodTopPadding(top);
  const bottom = tabBar ? 16 : Math.max(insets.bottom, 28);
  return (
    <View testID={testID} style={[styles.flex, { backgroundColor: p.page, paddingTop: insets.top }]}>
      <ScrollView style={styles.flex} contentContainerStyle={[styles.pageContent, { paddingTop: padTop, gap, paddingBottom: footer ? 12 : bottom }]}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.pageFooter, { paddingBottom: bottom }]}>{footer}</View> : null}
      {tabBar ? <PodTabBar /> : null}
    </View>
  );
}

/** The pod page header (pod-scheduled): back chevron, the theme in 24/800, "5 people near Aarhus C", the pod menu. */
export function PodHeader({ title, subtitle, sensitive = false, menu }: { title: string; subtitle?: string; sensitive?: boolean; menu?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  return (
    <View style={styles.header}>
      <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} />
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          {sensitive ? <Icon name="lock" size={18} color={p.privateText} accessibilityLabel={t('pods.privateInterest')} /> : null}
          <Text accessibilityRole="header" variant="headline" numberOfLines={2} style={[styles.flexShrink, styles.headerTitle]}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="caption" color="textMuted" style={styles.tightCaption}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {menu}
    </View>
  );
}

/** The back chevron row above the confirmed card (pod-confirmed), with the pod menu at the right. */
export function PodTopBar({ menu }: { menu?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} />
      {menu}
    </View>
  );
}

/**
 * The pod menu (§3.8 "From the pod menu"): a 44 px "⋯" at the right of the header that opens a sheet with the safety
 * tips and "Leave pod". Leaving asks first; the others only see that a member left.
 */
export function PodMenu({ onLeave }: { onLeave?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const confirmLeave = () =>
    Alert.alert(t('pod.leaveTitle'), t('pod.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pod.leave'),
        style: 'destructive',
        onPress: () => {
          close();
          onLeave?.();
        },
      },
    ]);
  return (
    <>
      <IconButton icon="more" testID="pod-menu" accessibilityLabel={t('pod.menu')} onPress={() => setOpen(true)} style={styles.pullRight} />
      <PodSheet visible={open} title={t('pod.menu')} onClose={close} testID="pod-menu-sheet">
        <ListSection>
          <ListRow
            icon="shield"
            label={t('pod.safety.title')}
            onPress={() => {
              close();
              router.push('/info/safety');
            }}
          />
          {onLeave ? <ListRow testID="leave-pod" label={t('pod.leave')} destructive chevron={false} accessibilityRole="button" onPress={confirmLeave} /> : null}
        </ListSection>
      </PodSheet>
    </>
  );
}

/** The dark "Next step" card (pod-scheduled): yellow eyebrow, a 22/800 question and its actions. */
export function NextStepCard({ title, children, testID }: { title: string; children?: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  return (
    <Card variant="hero" padding={20} gap={14} testID={testID}>
      <Eyebrow compact style={styles.eyebrow}>
        {t('pod.nextStep')}
      </Eyebrow>
      <Text accessibilityRole="header" variant="headlineCompact" color="onHero" style={styles.nextTitle}>
        {title}
      </Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Card>
  );
}

/**
 * "Meeting safely" (pod-confirmed): folded by default, the whole row is the button (no disclosure chevron, as on the
 * storyboard's summary); open, the tips and a link to the full safety page.
 */
export function SafetyCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <Card padding={0} gap={0}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.summary, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="shield" size={18} color={p.primary} />
        <Text variant="smallBold" style={styles.flex}>
          {t('pod.safety.title')}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.safetyBody}>
          <Text variant="caption" color="textSecondary">
            {t('pod.safety.body')}
          </Text>
          <TextLink size="sm" compact label={t('pod.safety.more')} onPress={() => router.push('/info/safety')} />
        </View>
      ) : null}
    </Card>
  );
}

export interface SmallLinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** The name screen readers hear, when the visible word needs context ("Open [place] in Maps"). */
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: 'link' | 'button';
  readonly color?: PaletteKey;
  readonly variant?: TypeVariant;
  readonly underline?: boolean;
  /** A 14 px icon before the label ("Meeting safely"). */
  readonly icon?: 'shield';
  readonly testID?: string;
}

/** A 13/700 inline link ("Open map", "Meeting safely") with a 44 px touch target from hitSlop. */
export function SmallLink({ label, onPress, accessibilityLabel, accessibilityRole = 'link', color = 'primary', variant = 'captionBold', underline = true, icon, testID }: SmallLinkProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={14}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon ? <Icon name={icon} size={14} color={p[color]} /> : null}
      <Text variant={variant} color={color} style={[styles.linkText, underline ? styles.underline : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Grey round-cornered note (chat "Only your pod can read this"): 12/1.45 muted, centred. */
export function SystemNote({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={[styles.note, { backgroundColor: p.surfaceMuted }]}>
      <Text variant="micro" color="textMuted" align="center" style={styles.noteText}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pageContent: { flexGrow: 1, paddingHorizontal: Layout.gutterCompact },
  pageFooter: { paddingHorizontal: Layout.gutterCompact, paddingTop: 12, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // 24/800 and 13 px at their natural line height, as the storyboard's header column.
  headerTitle: { lineHeight: 30 },
  tightCaption: { lineHeight: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pullRight: { marginRight: -10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { lineHeight: 15 },
  // 22/1.2 unrounded (26.4 px a line), as the storyboard's h2.
  nextTitle: { lineHeight: 26.4 },
  actions: { flexDirection: 'row', gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingVertical: 14, paddingHorizontal: 16 },
  safetyBody: { paddingHorizontal: 16, paddingBottom: 14, marginTop: -4, gap: 10 },
  link: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { lineHeight: 16 },
  underline: { textDecorationLine: 'underline' },
  // The storyboard's max-width 300 is the text's; RN counts the 12 px padding in, so 300 + 24.
  // 12/1.45 unrounded (17.4 px a line), so three lines are as tall as the storyboard's.
  noteText: { lineHeight: 17.4 },
  note: { alignSelf: 'center', maxWidth: 324, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 4 },
});
