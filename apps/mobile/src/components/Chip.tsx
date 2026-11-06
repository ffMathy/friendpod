/**
 * Chips, tags and badges: the user's interests (dark, removable, starred or private with a lock), suggestion
 * chips ("+ løb"), static mint tags (what we match on, shared interests) and status badges ("Next drop",
 * "18+ only", "Leading", "3 new").
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { BorderWidth, Radius, Size, usePalette, type PaletteKey, type TypeVariant } from './theme';

export interface ChipProps {
  readonly label: string;
  /** A private (sensitive) interest: purple, with a lock read as `privateLabel`. */
  readonly private?: boolean;
  /** Read by screen readers for the lock ("Private"). Needed when `private`. */
  readonly privateLabel?: string;
  /** Starred interest: a filled yellow star before the label. */
  readonly starred?: boolean;
  /** Adds the 28 px remove cross (hit target 44). */
  readonly onRemove?: () => void;
  /** "Remove brætspil". */
  readonly removeLabel?: string;
  /** Tapping the chip itself (for example, to change whether it is private). */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** One of the user's interests (onb-interests): 36 px, near-black (purple when private), 14/600. */
export function Chip({ label, private: isPrivate = false, privateLabel, starred = false, onRemove, removeLabel, onPress, accessibilityLabel, testID }: ChipProps) {
  const p = usePalette();
  const bg = isPrivate ? p.private : p.ink;
  const fg = isPrivate ? p.onPrivate : p.onInk;
  const body = (
    <>
      {isPrivate ? <Icon name="lock" size={14} color={fg} accessibilityLabel={privateLabel} /> : null}
      {starred ? <Icon name="starFilled" size={14} color={p.accent} fill={p.accent} /> : null}
      <Text variant="smallStrong" style={{ color: fg }}>
        {label}
      </Text>
    </>
  );
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: bg, paddingLeft: isPrivate ? 10 : 12, paddingRight: onRemove ? 6 : 12 }]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={4} style={styles.chipInner}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.chipInner} accessible accessibilityLabel={accessibilityLabel}>
          {body}
        </View>
      )}
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={removeLabel ?? label} onPress={onRemove} hitSlop={8} style={styles.remove}>
          <Icon name="close" size={14} strokeWidth={2.4} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A suggestion to add ("+ løb"), or any compact outline action: 36 px white pill, 14/600. */
export function ChipButton({ label, onPress, accessibilityLabel, icon, testID }: { label: string; onPress: () => void; accessibilityLabel?: string; icon?: IconName; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, styles.outline, { backgroundColor: pressed ? p.surfaceMuted : p.surface, borderColor: p.borderStrong }]}
    >
      {icon ? <Icon name={icon} size={14} color={p.text} /> : null}
      <Text variant="smallStrong">{label}</Text>
    </Pressable>
  );
}

/** A wrapping row of chips (gap 8; `tight` gives 6, as for tags). */
export function ChipRow({ children, tight = false }: { children: ReactNode; tight?: boolean }) {
  return <View style={[styles.row, { gap: tight ? 6 : 8 }]}>{children}</View>;
}

/** A static tag: 30 px, mint, 13/600 ("brætspil" in "What we'll match on"). */
export function Tag({ label, tone = 'mint' }: { label: string; tone?: 'mint' | 'private' | 'neutral' }) {
  const p = usePalette();
  const bg = tone === 'private' ? p.privateBg : tone === 'neutral' ? p.surfaceMuted : p.mint;
  const fg = tone === 'private' ? p.privateText : tone === 'neutral' ? p.textSecondary : p.onMint;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="captionStrong" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export type BadgeTone = 'accent' | 'mint' | 'outline' | 'private' | 'ink' | 'warning' | 'danger';

const BADGES: Record<BadgeTone, { bg: PaletteKey; fg: PaletteKey; border?: PaletteKey; type: TypeVariant }> = {
  /** "Next drop", "New pod", "Confirmed", "3 new". */
  accent: { bg: 'accent', fg: 'onAccent', type: 'badge' },
  /** "You're in", "Aarhus is live", "Leading". */
  mint: { bg: 'mint', fg: 'onMint', type: 'badge' },
  /** "18+ only". */
  outline: { bg: 'surface', fg: 'text', border: 'border', type: 'captionBold' },
  /** "Private interest(s)". */
  private: { bg: 'privateBg', fg: 'privateText', type: 'badge' },
  ink: { bg: 'ink', fg: 'onInk', type: 'badge' },
  warning: { bg: 'warningBg', fg: 'warningText', border: 'warningBorder', type: 'badge' },
  danger: { bg: 'dangerBg', fg: 'dangerText', border: 'dangerBorder', type: 'badge' },
};

export interface BadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
  /** A leading 14 px icon ("check" on "You're in", "lock" on private). */
  readonly icon?: IconName;
  /** `md` 28 px, 13 px text (default); `sm` 24 px, 12/800 ("Leading", "3 new"). */
  readonly size?: 'md' | 'sm';
}

export function Badge({ label, tone = 'accent', icon, size = 'md' }: BadgeProps) {
  const p = usePalette();
  const b = BADGES[tone];
  const sm = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { height: sm ? Size.badgeSmall : Size.badge, paddingHorizontal: sm ? 8 : 12, borderRadius: sm ? 12 : 14, backgroundColor: p[b.bg] },
        b.border ? { borderWidth: BorderWidth.hairline, borderColor: p[b.border] } : null,
      ]}
    >
      {icon ? <Icon name={icon} size={14} strokeWidth={icon === 'check' ? 2.6 : undefined} color={p[b.fg]} /> : null}
      <Text variant={sm ? 'microHeavy' : b.type} style={{ color: p[b.fg] }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: Size.chip, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: Size.chip },
  outline: { borderWidth: BorderWidth.hairline, paddingHorizontal: 12, gap: 6 },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { height: Size.tag, paddingHorizontal: 10, borderRadius: 15, justifyContent: 'center', alignSelf: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
