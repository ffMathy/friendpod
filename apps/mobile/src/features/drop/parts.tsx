/**
 * Small pieces the drop screens share: the tab page title row, the link under a card (green, muted grey, or purple on
 * a pod about a private interest), the small link at the foot of This week, a tip row with a chevron or a switch, and
 * an icon line on the proposal card.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Icon, Text, type IconName } from '@/components/ui';
import { BorderWidth, Radius, Size, typeStyle, usePalette, type PaletteKey } from '@/components/theme';

/**
 * A tab page's title row (drop-home "This week · Week 46", the Pods tab): 30/800 on the left, a 14/600 muted note on
 * the right, on one baseline. The storyboard's h1 keeps the font's natural line height (about 38 px), so the row is
 * that tall and the title sits where it is drawn.
 */
export function TabTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.tabTitle}>
      <Text accessibilityRole="header" variant="title" style={styles.tabTitleText}>
        {title}
      </Text>
      {meta ? (
        <Text variant="smallStrong" color="textMuted">
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 15/700 underlined link in a 44 px row: centred under a card ("Why this pod?", "How private interests are
 * protected"), or at the start ("How matching works" at the foot of the why sheet).
 */
export function CardLink({
  label,
  onPress,
  tone = 'primary',
  align = 'center',
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'muted' | 'private';
  align?: 'center' | 'start';
  testID?: string;
}) {
  const p = usePalette();
  const color: PaletteKey = tone === 'muted' ? 'textMuted' : tone === 'private' ? 'privateText' : 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, align === 'start' ? styles.linkStart : null, { opacity: pressed ? 0.6 : 1 }]}
    >
      <RNText style={[typeStyle('heading'), styles.underline, styles.linkText, align === 'start' ? styles.textStart : null, { color: p[color] }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

/**
 * 14/600 underlined link at the foot of a page ("How matching works" on This week). It sits 16 px under the card above
 * it, as drawn; the 44 px touch target comes from hitSlop rather than from a taller box.
 */
export function SmallLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={SMALL_LINK_SLOP}
      style={({ pressed }) => [styles.smallLink, { opacity: pressed ? 0.6 : 1 }]}
    >
      <RNText style={[typeStyle('smallStrong'), styles.underline, styles.smallLinkText, { color: p.primary }]}>{label}</RNText>
    </Pressable>
  );
}

/** The small link's text is 18 px tall: 13 px above and below make the 44 px target. */
const SMALL_LINK_SLOP = { top: 13, bottom: 13, left: 8, right: 8 };

/** A tip ("Add a few more interests", "Try about 15 km"): r16, input border, 15/600, chevron; 48 px inside the border. */
export function TipRow({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tip, { borderColor: p.borderStrong, backgroundColor: pressed ? p.inset : p.surface }]}
    >
      <Text variant="bodyStrong" style={[styles.flex, styles.tipLabel]}>
        {label}
      </Text>
      <Icon name="chevronRight" size={20} color={p.textMuted} />
    </Pressable>
  );
}

/**
 * A tip with a switch ("Open to meeting anyone" / "A pod without a shared theme"): the tip row's r16 outline, at least
 * 56 px, 8/16 padding, a 15/600 label with a 13/500 muted line 2 px under it, both at the font's natural line height
 * as drawn, and the 44 × 26 switch. Announced as a switch with the line as its hint, like the design-system Switch.
 */
export function TipSwitch({
  label,
  description,
  value,
  onChange,
  disabled = false,
  testID,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.tipSwitch,
        { borderColor: p.borderStrong, backgroundColor: pressed ? p.inset : p.surface, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <View style={styles.tipSwitchText}>
        <Text variant="bodyStrong" style={styles.tipSwitchLabel}>
          {label}
        </Text>
        <Text variant="caption" weight="500" color="textMuted" style={styles.tipSwitchHint}>
          {description}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: value ? p.primary : p.borderStrong }]}>
        {/* White in both colour schemes, like the design-system switch's knob. */}
        <View style={[styles.thumb, { backgroundColor: p.switchThumb }, value ? styles.thumbOn : null]} />
      </View>
    </Pressable>
  );
}

/** One line of the proposal card: a 20 px icon (green, purple on a private pod) and 15 px text. */
export function FactLine({ icon, tone, children, top = false }: { icon: IconName; tone?: 'private'; children: ReactNode; top?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.fact, top ? styles.factTop : null]}>
      <Icon name={icon} size={20} color={tone === 'private' ? p.privateText : p.primary} />
      <Text variant="body" style={styles.factText}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  tabTitleText: { flexShrink: 1, lineHeight: 38 },
  link: { alignSelf: 'center', minHeight: Size.hitTarget, justifyContent: 'center' },
  linkStart: { alignSelf: 'flex-start' },
  // 15 px at the font's natural line height (1.26), as the storyboard's links set none: centred in the 44 px row, the
  // words then sit where they are drawn (the 20 px heading line box puts them half a pixel higher).
  linkText: { lineHeight: 19 },
  textStart: { textAlign: 'left' },
  underline: { textDecorationLine: 'underline', textAlign: 'center' },
  smallLink: { alignSelf: 'flex-start' },
  // 14 px at the font's natural line height (the storyboard sets none).
  smallLinkText: { lineHeight: 18, textAlign: 'left' },
  // The storyboard's 48 px minimum is inside its 1 px border; React Native counts the border in.
  // 15 px at the font's natural line height, centred in the 48 px row as drawn.
  tipLabel: { lineHeight: 19 },
  tip: {
    minHeight: 48 + 2 * BorderWidth.hairline,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.hairline,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // min-height 56 with box-sizing border-box in the storyboard: the 1 px border is inside the 56.
  tipSwitch: {
    minHeight: 56,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.hairline,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipSwitchText: { flex: 1, gap: 2 },
  // 15 and 13 px at the font's natural line height (1.26), as the storyboard's label sets none.
  tipSwitchLabel: { lineHeight: 19 },
  tipSwitchHint: { lineHeight: 16 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOn: { alignSelf: 'flex-end' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factTop: { alignItems: 'flex-start' },
  // 15 px at the font's natural line height (1.26), as the storyboard's list sets none.
  factText: { flex: 1, lineHeight: 19 },
});
