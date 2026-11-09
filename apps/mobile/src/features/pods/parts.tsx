/**
 * Building blocks of the pod screens in direction E (pod-confirmed, pod-scheduled, pod-plan, pod-chat storyboards):
 * the page frame with the tab bar (and room for a pod band or a poster field), the pod band with its badge and menu,
 * the pod menu, the white "Next step" card with its needs-you pill, the card buttons, the folding "Meeting safely"
 * card, a small text link that can carry its own accessibility label, and the chat's privacy note.
 * Member avatars are in MemberAvatar.tsx; the pod's colour comes from `podColorOf` (color.ts).
 */
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Badge, Button, IconButton, Icon, ListRow, ListSection, PodBand, PodMark, Text, TextLink, type IconName } from '@/components/ui';
import { BorderWidth, Layout, Radius, Size, usePalette, type PaletteKey, type TypeVariant } from '@/components/theme';
import type { PodColor } from '@/lib/podColor';
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
  /** Space between blocks: 12–16 on the storyboards. */
  readonly gap?: number;
  /**
   * Space above the first block: 28 or 32 under a plain header (less what the status bar already gives), 14 under a
   * pod band or a poster foot.
   */
  readonly top?: number;
  /** The pod band (pod page, chat): fixed at the top, full-bleed; it brings its own safe-area inset. */
  readonly band?: ReactNode;
  /** The reveal's poster field and foot: full-bleed at the top of the scroll; it brings its own safe-area inset. */
  readonly hero?: ReactNode;
  /** The main tab bar with Pods selected (pod-confirmed, pod-scheduled); without it the page ends 28 px above the edge. */
  readonly tabBar?: boolean;
  readonly testID?: string;
}

/**
 * The frame of a pod page, as the storyboards draw it: an optional pod band or poster field at the top, a 20 px
 * gutter, the blocks in a scroll view, an optional pinned footer, and the tab bar (or 28 px to the bottom edge).
 */
export function PodPage({ children, footer, gap = 16, top = 28, band, hero, tabBar = false, testID }: PodPageProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const padTop = usePodTopPadding(top);
  const framed = band !== undefined || hero !== undefined;
  const bottom = tabBar ? 16 : Math.max(insets.bottom, 28);
  return (
    <View testID={testID} style={[styles.flex, { backgroundColor: p.page, paddingTop: framed ? 0 : insets.top }]}>
      {band}
      <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingBottom: footer ? 12 : bottom }]}>
        {hero}
        <View style={[styles.pageContent, { paddingTop: framed ? top : padTop, gap }]}>{children}</View>
      </ScrollView>
      {footer ? <View style={[styles.pageFooter, { paddingBottom: bottom }]}>{footer}</View> : null}
      {tabBar ? <PodTabBar /> : null}
    </View>
  );
}

/**
 * The pod band of the pod page (pod-scheduled, spec §6.8): the pod tint, the name as a Title in the pod's deep tone,
 * "5 people near Aarhus C", the 48 px pod badge, then the pod menu. A private pod: white with an Ink border and a lock.
 */
export function PodPageBand({ title, subtitle, color, menu }: { title: string; subtitle?: string; color: PodColor | null; menu?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <PodBand
      testID="pod-band"
      title={title}
      {...(subtitle ? { subtitle } : {})}
      color={color}
      onBack={() => goBack(router)}
      backLabel={t('common.back')}
      trailing={
        <View style={styles.bandEnd}>
          <PodMark variant="badge" color={color ?? 'private'} size={Size.podBadge} />
          {menu}
        </View>
      }
    />
  );
}

/** The back chevron row above a page without a band (the private reveal), with the pod menu at the right. */
export function PodTopBar({ menu, color }: { menu?: ReactNode; color?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} {...(color ? { color } : {})} />
      {menu}
    </View>
  );
}

/**
 * The pod menu (§3.8 "From the pod menu"): a 44 px "⋯" at the right of the header that opens a sheet with the safety
 * tips and "Leave pod" (a Danger outline button). Leaving asks first; the others only see that a member left.
 */
export function PodMenu({ onLeave, color }: { onLeave?: () => void; color?: string }) {
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
      <IconButton icon="more" testID="pod-menu" accessibilityLabel={t('pod.menu')} onPress={() => setOpen(true)} style={styles.pullRight} {...(color ? { color } : {})} />
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
        </ListSection>
        {/* Destructive: the Danger outline button with its icon (decision 4), never red text alone. */}
        {onLeave ? <Button testID="leave-pod" variant="danger" size="md" fullWidth icon="leave" label={t('pod.leave')} onPress={confirmLeave} /> : null}
      </PodSheet>
    </>
  );
}

/** A white pod card (pod-scheduled): 1 px Line, radius 22, padding 14/16. */
export function PodCard({ children, gap = 10, testID, style }: { children: ReactNode; gap?: number; testID?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: p.surface, borderColor: p.border, gap }, style]}>
      {children}
    </View>
  );
}

/**
 * The "Next step" card (pod-scheduled): white, the needs-you pill "Next step" (it is the viewer's own action, decision
 * 2), the question as a Headline, and its actions side by side.
 */
export function NextStepCard({ title, children, testID }: { title: string; children?: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  return (
    <PodCard testID={testID}>
      <Badge tone="needsYou" label={t('pod.nextStep')} />
      <Text accessibilityRole="header" variant="headline">
        {title}
      </Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </PodCard>
  );
}

export interface CardButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /** `primary` Skov, `secondary` white with the 1.5 px Outline. */
  readonly variant?: 'primary' | 'secondary';
  /** Share of the row (the storyboards' pair is 1.4 : 1). */
  readonly grow?: number;
  /**
   * `even` (default): the row is shared by `grow` alone ("Open in Maps" / "Add to calendar"). `content`: shared by
   * `grow` the same way, but never narrower than the button's own label, so a longer Danish label ("Kan ikke komme")
   * or a larger text size keeps its room and the other button gives way.
   */
  readonly fit?: 'even' | 'content';
  /** 48 (in cards, default) or 44 (in tight rows). */
  readonly height?: 48 | 44;
  readonly icon?: IconName;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: 'button' | 'link';
  readonly testID?: string;
}

/**
 * A button that shares a card row with another ("Yes, I'm coming" / "Can't make it", "Open in Maps" / "Add to
 * calendar"): 15/700 (14/700 at 44 px) with 8 px a side, so the Danish labels fit half a card.
 */
export function CardButton({ label, onPress, variant = 'secondary', grow = 1, fit = 'even', height = 48, icon, busy = false, disabled = false, accessibilityLabel, accessibilityRole = 'button', testID }: CardButtonProps) {
  const p = usePalette();
  const primary = variant === 'primary';
  const fg = primary ? p.onPrimary : p.text;
  // `fit="content"`: the label's width is measured once (per label) while the button still sizes from its content;
  // from then on the row is shared by `grow` with that width, plus icon, padding and border, as the floor.
  const [measured, setMeasured] = useState<{ readonly label: string; readonly width: number } | null>(null);
  const floor =
    fit === 'content' && measured?.label === label
      ? measured.width + (icon ? 16 + CARD_BUTTON_GAP : 0) + 2 * CARD_BUTTON_PAD + (primary ? 0 : 2 * BorderWidth.control)
      : null;
  const measuring = fit === 'content' && floor === null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardButton,
        { flexGrow: grow, flexBasis: measuring ? 'auto' : 0, minWidth: floor ?? 0, height, borderRadius: height / 2 },
        primary
          ? { backgroundColor: pressed ? p.primaryPressed : p.primary }
          : { backgroundColor: pressed ? p.page : p.surface, borderWidth: BorderWidth.control, borderColor: p.borderStrong },
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={16} color={fg} /> : null}
          <Text
            variant={height === 44 ? 'smallBold' : 'buttonSmall'}
            style={{ color: fg }}
            numberOfLines={1}
            onLayout={measuring ? (e) => setMeasured({ label, width: Math.ceil(e.nativeEvent.layout.width) }) : undefined}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * "Meeting safely" (pod-confirmed): a white card whose 48 px summary row (shield, the words, a chevron) is the
 * button; open, the tips and a link to the full safety page.
 */
export function SafetyCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.safety, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('pod.safety.title')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.summary, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="shield" size={20} color={p.text} />
        <Text variant="heading" style={styles.flex}>
          {t('pod.safety.title')}
        </Text>
        <Icon name="chevronRight" size={20} color={p.text} style={open ? styles.chevronUp : styles.chevronDown} />
      </Pressable>
      {open ? (
        <View style={styles.safetyBody}>
          <Text variant="caption" color="textSecondary">
            {t('pod.safety.body')}
          </Text>
          <TextLink size="sm" compact label={t('pod.safety.more')} onPress={() => router.push('/info/safety')} />
        </View>
      ) : null}
    </View>
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
  /** A 16 px icon before the label ("Meeting safely"); 14 px when `compact`. */
  readonly icon?: IconName;
  /** As tall as its text, the 44 px target made up with `hitSlop` (a link in a heading row). */
  readonly compact?: boolean;
  readonly testID?: string;
}

/** A standalone link ("Open map", "Meeting safely"): Skov deep 15/700, underlined, in a 44 px tall target. */
export function SmallLink({ label, onPress, accessibilityLabel, accessibilityRole = 'link', color = 'link', variant = 'buttonSmall', underline = true, icon, compact = false, testID }: SmallLinkProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={compact ? { top: 14, bottom: 14, left: 6, right: 6 } : { left: 6, right: 6 }}
      style={({ pressed }) => [styles.link, compact ? styles.linkCompact : null, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon ? <Icon name={icon} size={compact ? 14 : 16} color={p[color]} /> : null}
      <Text variant={variant} color={color} style={underline ? styles.underline : null} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The chat's privacy note ("Only your pod can read this"): white, 1 px Line, a lock, 12/1.45 Ink 2. */
export function SystemNote({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={[styles.note, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Icon name="lock" size={16} color={p.textSecondary} style={styles.noteIcon} />
      <Text variant="micro" color="textSecondary" style={styles.noteText}>
        {children}
      </Text>
    </View>
  );
}

/** A card button's padding a side and the gap between its icon and label. */
const CARD_BUTTON_PAD = 8;
const CARD_BUTTON_GAP = 6;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  pageContent: { flexGrow: 1, paddingHorizontal: Layout.gutterCompact },
  pageFooter: { paddingHorizontal: Layout.gutterCompact, paddingTop: 12, gap: 12, alignItems: 'stretch' },
  bandEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pullRight: { marginRight: -10 },
  card: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 14, paddingHorizontal: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  cardButton: { flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: CARD_BUTTON_GAP, paddingHorizontal: CARD_BUTTON_PAD },
  safety: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 4, paddingHorizontal: 16 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
  safetyBody: { paddingBottom: 12, marginTop: 2, gap: 6 },
  link: { alignSelf: 'flex-start', minHeight: Size.hitTarget, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkCompact: { minHeight: 0, alignSelf: 'center', gap: 4 },
  underline: { textDecorationLine: 'underline' },
  note: {
    alignSelf: 'center',
    maxWidth: 330,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: BorderWidth.hairline,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  noteIcon: { marginTop: 1, flexShrink: 0 },
  // 12/1.45 unrounded (17.4 px a line), as the storyboard's note.
  noteText: { flexShrink: 1, lineHeight: 17.4 },
});
