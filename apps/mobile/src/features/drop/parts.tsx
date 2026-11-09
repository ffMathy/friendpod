/**
 * Small pieces the drop screens share (blend spec §6.4–6.6, §6.12): the tab page title row, an icon line of the
 * proposal card, the Paper note inside a card, the link row and the open-to-anyone switch row of "No pod for you this
 * week", the 14 px Edit link, and the disc that leads a pod row or a reason.
 */
import type { ReactNode } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon, Switch, Text, TintDisc, type IconName } from '@/components/ui';
import { BorderWidth, typeStyle, usePalette } from '@/components/theme';
import { dsColor, type CardColor } from './color';

/**
 * A tab page's title row (spec §6.12 A: drop-proposal "Your weekly drop · Week 46", drop-none, the Pods tab): the Title
 * (Bricolage 30/32) at the left and a 14/600 Muted note at the right, on one baseline.
 */
export function TabTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.tabTitle}>
      <Text accessibilityRole="header" variant="title" style={styles.shrink}>
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
 * A section title on a tab page ("Your pods · 1 of 2 active"): 15/22/700 Ink with the count in 500 Muted, on one 22 px
 * line as drawn (the design-system `SectionHeader` keeps 24 px for rows that carry a link).
 */
export function SectionTitle({ title, count }: { title: string; count?: string }) {
  return (
    <Text accessibilityRole="header" variant="heading">
      {title}
      {count ? (
        <Text variant="heading" weight="500" color="textMuted">
          {` · ${count}`}
        </Text>
      ) : null}
    </Text>
  );
}

/** One fact of the proposal card: an 18 px icon (the pod's deep tone; Ink 2 in a private pod) and 15/22 Ink text. */
export function FactLine({ icon, color, children }: { icon: IconName; color: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={color} style={styles.factIcon} />
      <Text variant="bodySmall" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

/** The 16 px dashed ring of "Names and photos appear when …": a seat not yet filled. Decorative. */
function OpenRing() {
  const p = usePalette();
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessible={false} style={styles.factIcon}>
      <Circle cx={8} cy={8} r={6.75} fill="none" stroke={p.field} strokeWidth={1.5} strokeDasharray="2.6 2" />
    </Svg>
  );
}

/**
 * A note inside a white card (spec §6.5): Paper, radius 14, padding 10/12, a 16 px mark (the dashed ring for "names
 * appear", the shield in a private pod) and 13/1.5 Ink 2 text. Several children are paragraphs 8 px apart.
 */
export function InsetNote({ mark, children, testID }: { mark: 'open' | 'shield'; children: ReactNode; testID?: string }) {
  const p = usePalette();
  return (
    <View testID={testID} style={[styles.inset, { backgroundColor: p.inset }]}>
      {mark === 'open' ? <OpenRing /> : <Icon name="shield" size={16} color={p.textSecondary} style={styles.factIcon} />}
      <View style={styles.insetText}>{children}</View>
    </View>
  );
}

/** A paragraph of an `InsetNote`: 13/1.5 Ink 2. */
export function NoteText({ children }: { children: ReactNode }) {
  return (
    <Text variant="caption" color="textSecondary" style={styles.noteText}>
      {children}
    </Text>
  );
}

const TIP_MIN = 52;

/** A link row inside a card (drop-none tips): at least 52 px, 16/600 Ink, a 20 px Muted chevron, a Divider under it. */
export function TipRow({ label, onPress, last = false, testID }: { label: string; onPress: () => void; last?: boolean; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tip,
        last
          ? null
          : {
              // 52 px above the divider, as drawn (the divider adds its own pixel).
              minHeight: TIP_MIN + BorderWidth.hairline,
              borderBottomWidth: BorderWidth.hairline,
              borderBottomColor: p.separator,
            },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text variant="rowTitle" style={[styles.flex, styles.tipLabel]}>
        {label}
      </Text>
      <Icon name="chevronRight" size={20} color={p.textMuted} />
    </Pressable>
  );
}

/**
 * "Open to meeting anyone" as the last row of the tips: the design-system switch (52 × 32), no border, in a row at
 * least 64 px tall as drawn.
 */
export function TipSwitch(props: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.switchRow}>
      <Switch variant="plain" {...props} />
    </View>
  );
}

/** A 14/700 link in a heading row ("Edit"): as tall as its text, the 44 px target from hitSlop. */
export function RowLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={ROW_LINK_SLOP}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <RNText style={[typeStyle('smallBold'), styles.underline, { color: p.link }]}>{label}</RNText>
    </Pressable>
  );
}

/** The link text is 18 px tall: 13 px above and below make the 44 px target, 8 px at the sides as drawn. */
const ROW_LINK_SLOP = { top: 13, bottom: 13, left: 8, right: 8 };

/**
 * The 36 px disc that leads a pod row without avatars yet, or a reason in "Why this pod": the pod tint with the icon in
 * the pod's deep tone; white with an Ink ring when private; Paper with an Ink 2 icon when the colour is not known.
 */
export function PodDisc({ color, icon, size = 36 }: { color: CardColor; icon: IconName; size?: number }) {
  const p = usePalette();
  if (color !== 'plain') return <TintDisc color={dsColor(color)} icon={icon} size={size} />;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: p.inset,
          borderColor: p.border,
        },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={p.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  tabTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factIcon: { marginTop: 2 },
  inset: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  insetText: { flex: 1, gap: 8 },
  // 13 px at 1.5, as drawn.
  noteText: { lineHeight: 19.5 },
  tip: { minHeight: TIP_MIN, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipLabel: { lineHeight: 22 },
  switchRow: { minHeight: 64, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BorderWidth.hairline,
  },
});
