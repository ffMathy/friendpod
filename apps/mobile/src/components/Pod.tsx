/**
 * Pod-coloured building blocks (blend spec §6.7–6.11, §8, §11). Colour grows with commitment:
 *
 *   proposal  → `HeroCard` with a pod tint band (pod name in the pod's deep tone, the 48 px pod badge), seats open
 *   waiting   → the same band, one seat lit (base + deep ring) per yes (`SeatRow`)
 *   confirmed → `PosterField` in the pod's base colour with the reveal mark, `PosterFoot` under it
 *   after     → `PodBand`, the calm tint header of the pod page and chat
 *
 * Poster fields are for the three rituals only: the welcome and the Thursday drop (house field, Skov) and the
 * pod-confirmed reveal (pod base). Display type only on a field (>= 22 px bold); every smaller text goes on the foot.
 * A private pod (`color={null}`) gets no colour anywhere: white and Ink with a lock.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PodColor } from '@/lib/podColor';
import { Avatar } from './Avatar';
import { BackButton } from './Button';
import { Icon, type IconName } from './Icon';
import { PodMark } from './Logo';
import { Text } from './Text';
import { BorderWidth, Layout, Radius, Size, usePalette, usePodColors } from './theme';

// ---------------------------------------------------------------------------------------------------------------
// Poster field and foot
// ---------------------------------------------------------------------------------------------------------------

/** The colours of a poster field: the house field (Skov, white type) or a pod's reveal field (base; dark: deep). */
export function useFieldColors(color?: PodColor | null): { readonly background: string; readonly text: string } {
  const p = usePalette();
  const c = usePodColors(color);
  return color ? { background: c.field, text: c.onField } : { background: p.house, text: p.onHouse };
}

export interface PosterFieldProps {
  readonly children?: ReactNode;
  /** A pod's reveal field (its base colour). Default: the house field (Skov). Never for a private pod. */
  readonly color?: PodColor | null;
  /** Add the top safe-area inset to the padding (the field starts at y = 0). Default true. */
  readonly safeTop?: boolean;
  /** Bottom padding; the default (50) leaves room for a `PosterFoot` that overlaps the field by 28. */
  readonly paddingBottom?: number;
  readonly gap?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * A full-bleed, square-edged poster field (welcome, the Thursday drop, the reveal): one flat colour, one poster mark,
 * display type, white pills (`Badge tone="onField"`), the back icon. Text colour: `useFieldColors(color).text`.
 */
export function PosterField({ children, color, safeTop = true, paddingBottom = 50, gap = 18, style, testID }: PosterFieldProps) {
  const insets = useSafeAreaInsets();
  const f = useFieldColors(color);
  return (
    <View testID={testID} style={[styles.field, { backgroundColor: f.background, paddingTop: (safeTop ? insets.top : 0) + 40, paddingBottom, gap }, style]}>
      {children}
    </View>
  );
}

/** The white foot panel that overlaps the bottom of a poster field by 28 px: every small text of a ritual goes here. */
export function PosterFoot({ children, onPress, accessibilityLabel, testID, style }: { children?: ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const box = [styles.foot, { backgroundColor: p.surface, borderColor: p.border }, style];
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={box}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Pod band (header) and the tint band of the hero card
// ---------------------------------------------------------------------------------------------------------------

export interface PodBandProps {
  /** The pod name (the theme in the viewer's own words). */
  readonly title: string;
  /** "5 people near Aarhus C", "Chat open until Sunday 14:00". */
  readonly subtitle?: string;
  /** The pod's colour; `null` for a private pod (white, Ink border, a lock before the name). */
  readonly color: PodColor | null;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  /** At the right; default the 48 px pod badge (the chat band shows the avatar stack instead). */
  readonly trailing?: ReactNode;
  /** Add the top safe-area inset (default true: the band is the screen's top edge). */
  readonly safeTop?: boolean;
  readonly testID?: string;
}

/**
 * The pod band header (pod page, chat; spec §6.8): a full-bleed tint with a 1 px base-@-40% border on the sides and
 * bottom, bottom radius 28, the pod name as a Title in the pod's deep tone, the pod badge at the right. Put it outside
 * the padded content. Pod screens whose header shows no pod name use the plain header instead.
 */
export function PodBand({ title, subtitle, color, onBack, backLabel, trailing, safeTop = true, testID }: PodBandProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const c = usePodColors(color);
  const insets = useSafeAreaInsets();
  const isPrivate = color === null;
  return (
    <View
      testID={testID}
      style={[
        styles.band,
        {
          paddingTop: (safeTop ? insets.top : 0) + 28,
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          borderWidth: isPrivate ? BorderWidth.control : BorderWidth.hairline,
        },
      ]}
    >
      {onBack ? <BackButton onPress={onBack} accessibilityLabel={backLabel ?? t('common.back')} color={c.onSurface} /> : null}
      <View style={styles.bandText}>
        <View style={styles.bandTitle}>
          {isPrivate ? <Icon name="lock" size={20} strokeWidth={2.2} color={p.text} accessibilityLabel={t('common.private')} /> : null}
          <Text accessibilityRole="header" variant="title" style={[styles.shrink, { color: c.name }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="captionStrong" style={{ color: c.onSurfaceMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? <PodMark variant="badge" color={color ?? 'private'} size={Size.podBadge} />}
    </View>
  );
}

export interface PodTintBandProps {
  /** The pod's colour; `null` for a private pod (white top, Line bottom border, Ink name, private badge). */
  readonly color: PodColor | null;
  /** The pod name, set in Display L in the pod's deep tone (Ink when private). */
  readonly name: string;
  /** "A pod around", above the name. */
  readonly eyebrow?: string;
  /** The pill row: a status pill at the left, a needs-you pill (or a quiet status) at the right. */
  readonly pillLeft?: ReactNode;
  readonly pillRight?: ReactNode;
  readonly nameTestID?: string;
}

/** The top of the proposal and waiting hero card: the pod tint, a 1 px base-@-40% bottom border, name and badge. */
export function PodTintBand({ color, name, eyebrow, pillLeft, pillRight, nameTestID }: PodTintBandProps) {
  const p = usePalette();
  const c = usePodColors(color);
  const isPrivate = color === null;
  return (
    <View style={[styles.tintBand, { backgroundColor: isPrivate ? p.surface : c.surface, borderBottomColor: isPrivate ? p.border : c.surfaceBorder }]}>
      {pillLeft || pillRight ? (
        <View style={styles.pills}>
          <View style={styles.shrink}>{pillLeft}</View>
          <View style={styles.shrink}>{pillRight}</View>
        </View>
      ) : null}
      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          {eyebrow ? (
            <Text variant="small" style={{ color: c.onSurfaceMuted }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text testID={nameTestID} accessibilityRole="header" variant="displayL" style={{ color: c.name }}>
            {name}
          </Text>
        </View>
        <View style={styles.badgeNudge}>
          <PodMark variant="badge" color={color ?? 'private'} size={Size.podBadge} />
        </View>
      </View>
    </View>
  );
}

export interface HeroCardProps extends PodTintBandProps {
  readonly children?: ReactNode;
  /** Gap between the body's blocks (default 16). */
  readonly gap?: number;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}

/**
 * The proposal / waiting hero card (spec §6.7): white, 1 px Line border (private: 1.5 px Ink), radius 28, the pod tint
 * band on top, then the body (seat row, facts, a note, buttons) with padding 16 20 20.
 */
export function HeroCard({ children, gap = 16, testID, accessibilityLabel, ...band }: HeroCardProps) {
  const p = usePalette();
  const isPrivate = band.color === null;
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hero, { backgroundColor: p.surface, borderColor: isPrivate ? p.privateBorder : p.border, borderWidth: isPrivate ? BorderWidth.control : BorderWidth.hairline }]}
    >
      <PodTintBand {...band} />
      <View style={[styles.heroBody, { gap }]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------------------------------------------

/** One 44 px seat: `open` (dashed Field ring), `lit` (someone said yes: base + 2 px deep ring), `you`. Decorative. */
export function Seat({ kind, color, youLabel, size = Size.seat }: { kind: 'open' | 'lit' | 'you'; color?: PodColor | null; youLabel?: string; size?: number }) {
  const p = usePalette();
  const c = usePodColors(color);
  if (kind === 'you') return <Avatar you youLabel={youLabel} size={size} />;
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessible={false}>
      {kind === 'open' ? (
        <Circle cx={r} cy={r} r={r - 1.5} fill="none" stroke={p.field} strokeWidth={2} strokeDasharray="5.2 4" />
      ) : color ? (
        <Circle cx={r} cy={r} r={r - 1} fill={c.dot} stroke={c.dotRing} strokeWidth={2} />
      ) : (
        // Private pod: lit seats are Ink 2, no ring.
        <Circle cx={r} cy={r} r={r} fill={p.privateFill} />
      )}
    </Svg>
  );
}

export interface SeatRowProps {
  /** Seats in the pod, the viewer's included (the storyboards: 5). */
  readonly total: number;
  /** Seats lit by a yes, the viewer's not counted (proposal: always 0; it never reveals acceptance). */
  readonly lit: number;
  /** The viewer's seat first (default true). */
  readonly you?: boolean;
  readonly youLabel?: string;
  /** The pod's colour; `null` for a private pod. */
  readonly color: PodColor | null;
  /** Draw the threshold bracket under the first `needed` seats, labelled `neededLabel` ("4 needed"). */
  readonly needed?: number;
  readonly neededLabel?: string;
  readonly testID?: string;
}

/**
 * Seats that light up, one per yes (decision 5). Hidden from screen readers: the text next to it ("3 of 5 said yes")
 * carries the information.
 */
export function SeatRow({ total, lit, you = true, youLabel, color, needed, neededLabel, testID }: SeatRowProps) {
  const p = usePalette();
  const others = Math.max(0, total - (you ? 1 : 0));
  const litCount = Math.min(Math.max(0, lit), others);
  const gap = 10;
  const bracketWidth = needed ? needed * Size.seat + (needed - 1) * gap : 0;
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.seatBlock}>
      <View style={[styles.seats, { gap }]}>
        {you ? <Seat kind="you" youLabel={youLabel} /> : null}
        {Array.from({ length: others }, (_, i) => (
          <Seat key={i} kind={i < litCount ? 'lit' : 'open'} color={color} />
        ))}
      </View>
      {needed && needed > 0 ? (
        <View style={styles.bracketRow}>
          <Svg width={bracketWidth} height={8} viewBox={`0 0 ${bracketWidth} 8`}>
            <Path d={`M1 0V7H${bracketWidth - 1}V0`} fill="none" stroke={p.textSecondary} strokeWidth={2} />
          </Svg>
          {neededLabel ? (
            <Text variant="captionStrong" color="textSecondary">
              {neededLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Small pod pieces
// ---------------------------------------------------------------------------------------------------------------

/** A 36 px pod-tint disc with an icon in the pod's deep tone (the chat row, the "Why this pod" reasons). Decorative. */
export function TintDisc({ color, icon, size = 36 }: { color: PodColor | null; icon: IconName; size?: number }) {
  const c = usePodColors(color);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface, borderColor: c.surfaceBorder }]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={c.icon} />
    </View>
  );
}

export interface OptionCardProps {
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
  readonly accessibilityLabel: string;
  /** `radio` (default, one of many), `checkbox`, or `button`. */
  readonly role?: 'radio' | 'checkbox' | 'button';
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * A selectable option card (pod-propose places, pod-plan options): white, 1.5 px Outline, radius 16; selected: a
 * 2 px Skov border and a Skov check at the right. Never filled with a tint.
 */
export function OptionCard({ selected, onPress, children, accessibilityLabel, role = 'radio', disabled = false, testID, style }: OptionCardProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'button' ? { selected, disabled } : { checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: pressed ? p.page : p.surface,
          borderColor: selected ? p.primary : p.borderStrong,
          borderWidth: selected ? BorderWidth.strong : BorderWidth.control,
          // Keep the content still when the border thickens.
          padding: selected ? 13.5 : 14,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.optionBody}>{children}</View>
      {selected ? <Icon name="check" size={22} strokeWidth={2.6} color={p.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  field: { paddingHorizontal: Layout.gutterCompact, alignSelf: 'stretch' },
  foot: { marginTop: -Layout.footOverlap, marginHorizontal: Layout.gutterCompact, borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 14, paddingHorizontal: 16 },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    paddingHorizontal: 19,
    paddingBottom: 16,
  },
  bandText: { flex: 1, minWidth: 0, gap: 2 },
  bandTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tintBand: { borderBottomWidth: BorderWidth.hairline, paddingTop: 18, paddingHorizontal: Layout.heroPadding, paddingBottom: 20, gap: 14 },
  pills: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  nameCol: { flex: 1, minWidth: 0, gap: 4 },
  badgeNudge: { marginBottom: 2 },
  hero: { borderRadius: Radius.hero, overflow: 'hidden' },
  heroBody: { paddingTop: 16, paddingHorizontal: Layout.heroPadding, paddingBottom: 20 },
  seatBlock: { gap: 6 },
  seats: { flexDirection: 'row', flexWrap: 'wrap' },
  bracketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: BorderWidth.hairline },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, minHeight: 52 },
  optionBody: { flex: 1, gap: 4 },
});
