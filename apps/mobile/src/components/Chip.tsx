/**
 * Chips, pills and quiet statuses (blend spec §6.3, §6.4).
 *
 * - `Chip`: an interest. `pod` (pod tint, 1 px base-@-40% border, ringed dot), `private` (quiet: white, 1.5 px Ink
 *   border, Ink lock and word; never a colour), `unsettled` (dashed: no concept yet, "Did you mean" open), `clash`
 *   (plain white chip: another interest in the colour reserved by this pod, or a word with no colour given).
 *   32 px for display, 36 px when removable (a 44 × 44 remove cross overhangs it).
 * - `ChipButton`: a suggestion to add ("+ løb"): 36 px visual in a 44 px target, white, 1.5 px Outline, plus icon.
 * - `Badge`: pills. `status` (Ink), `needsYou` (Solsikke + 1.5 px Ink ring + clock: only for your own deadlines),
 *   `onField` (white pill on a poster field), `unread` (Ink "3 new", never the pod's colour), plus `outline`,
 *   `private` and `danger`.
 * - `StatusText`: someone else's state, quietly: a 14 px icon and Ink 2 13/700 words ("Coming", "Hasn't confirmed").
 * - `PodDot`: the 10 px dot of a pod colour (base fill, deep ring).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { PodColor } from '@/lib/podColor';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { BorderWidth, Size, usePalette, usePodColors, type PaletteKey, type TypeVariant } from './theme';

// ---------------------------------------------------------------------------------------------------------------
// Dot
// ---------------------------------------------------------------------------------------------------------------

export interface PodDotProps {
  /** A pod colour: base fill with a 1.5 px deep ring (dark mode: tint ring). */
  readonly color?: PodColor | null;
  /** `pod` (default when a colour is given), `hollow` (clash: a 1.5 px Ink 2 ring), `dashed` (unsettled). */
  readonly variant?: 'pod' | 'hollow' | 'dashed';
  /** Default 10. */
  readonly size?: number;
}

/** The 10 px pod dot before a chip's word, a pod name in a row or an interest row. Decorative. */
export function PodDot({ color, variant, size = Size.dot }: PodDotProps) {
  const p = usePalette();
  const c = usePodColors(color);
  const kind = variant ?? (color ? 'pod' : 'hollow');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (kind === 'dashed') {
    // A dashed ring: RN borders cannot dash a circle this small reliably, so draw it.
    return (
      <Svg width={size} height={size} viewBox="0 0 10 10" accessible={false} style={styles.noShrink}>
        <Circle cx={5} cy={5} r={4.25} fill="none" stroke={p.field} strokeWidth={1.5} strokeDasharray="2 1.6" />
      </Svg>
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.noShrink,
        box,
        { borderWidth: BorderWidth.control },
        kind === 'pod' ? { backgroundColor: c.dot, borderColor: c.dotRing } : { backgroundColor: 'transparent', borderColor: p.textSecondary },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------------------------------------------

export type ChipKind = 'pod' | 'private' | 'unsettled' | 'clash';

export interface ChipProps {
  readonly label: string;
  /**
   * Default: `private` when `private` is set, `pod` when a `color` is given, otherwise `clash` (the plain chip).
   * Interests take their colour from their word (`podColorFor`, `interestColor`); private ones have none.
   */
  readonly kind?: ChipKind;
  /** The pod colour of a `pod` chip. */
  readonly color?: PodColor | null;
  /** Shorthand for `kind="private"`. */
  readonly private?: boolean;
  /** Read by screen readers for the lock ("Private"). Needed for a private chip. */
  readonly privateLabel?: string;
  /** The main interest: an Ink star after the word. */
  readonly starred?: boolean;
  /** Read for the star ("Main interest"); without it the star is decorative. */
  readonly starredLabel?: string;
  /** Adds the remove cross (44 × 44 target, overhanging the 36 px chip). */
  readonly onRemove?: () => void;
  /** "Remove brætspil". */
  readonly removeLabel?: string;
  /** Tapping the chip itself (for example, to change whether it is private). */
  readonly onPress?: () => void;
  /** `sm` 32 px (display) or `md` 36 px (default when removable). */
  readonly size?: 'sm' | 'md';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** One interest as a chip. Pod chips never stand on tint alone: a 1 px border and a ringed dot go with the tint. */
export function Chip({
  label,
  kind,
  color,
  private: isPrivate = false,
  privateLabel,
  starred = false,
  starredLabel,
  onRemove,
  removeLabel,
  onPress,
  size,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const p = usePalette();
  const c = usePodColors(color);
  const k: ChipKind = kind ?? (isPrivate ? 'private' : color ? 'pod' : 'clash');
  const large = (size ?? (onRemove ? 'md' : 'sm')) === 'md';
  const height = large ? Size.chip : Size.tag;
  const look =
    k === 'pod'
      ? { backgroundColor: c.surface, borderColor: c.surfaceBorder, borderWidth: BorderWidth.hairline, fg: c.onSurface }
      : k === 'private'
        ? { backgroundColor: p.privateBg, borderColor: p.privateBorder, borderWidth: BorderWidth.control, fg: p.privateText }
        : k === 'unsettled'
          ? { backgroundColor: p.surface, borderColor: p.field, borderWidth: BorderWidth.control, fg: p.text, dashed: true }
          : { backgroundColor: p.surface, borderColor: p.borderStrong, borderWidth: BorderWidth.control, fg: p.text };
  const body = (
    <>
      {k === 'private' ? (
        <Icon name="lock" size={14} strokeWidth={2.2} color={look.fg} accessibilityLabel={privateLabel} />
      ) : (
        <PodDot color={k === 'pod' ? color : null} variant={k === 'pod' ? 'pod' : k === 'unsettled' ? 'dashed' : 'hollow'} />
      )}
      <Text variant={large ? 'chipLarge' : 'chip'} style={{ color: look.fg }}>
        {label}
      </Text>
      {starred ? <Icon name="starFilled" size={13} color={look.fg} accessibilityLabel={starredLabel} /> : null}
    </>
  );
  return (
    <View
      testID={testID}
      style={[
        styles.chip,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
          borderWidth: look.borderWidth,
          borderStyle: 'dashed' in look ? 'dashed' : 'solid',
          paddingLeft: large ? 12 : 10,
          paddingRight: onRemove ? 0 : 12,
        },
      ]}
    >
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={{ top: 6, bottom: 6, left: 4 }} style={styles.chipInner}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.chipInner} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
          {body}
        </View>
      )}
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={removeLabel ?? label} onPress={onRemove} style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}>
          <Icon name="close" size={14} strokeWidth={2.4} color={look.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A suggestion to add ("+ løb"): a 36 px white chip, 1.5 px Outline, plus icon, in a 44 px tall target. */
export function ChipButton({ label, onPress, accessibilityLabel, icon = 'plus', testID }: { label: string; onPress: () => void; accessibilityLabel?: string; icon?: IconName | null; testID?: string }) {
  const p = usePalette();
  // Older call sites put the "+" in the label; the icon draws it now.
  const text = icon === 'plus' ? label.replace(/^\+\s*/, '') : label;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={styles.suggestionHit}>
      {({ pressed }) => (
        <View style={[styles.chip, styles.suggestion, { backgroundColor: pressed ? p.page : p.surface, borderColor: p.borderStrong }]}>
          {icon ? <Icon name={icon} size={14} strokeWidth={2.4} color={p.text} /> : null}
          <Text variant="chip">{text}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A wrapping row of chips (gap 8; `tight` gives 6, in tight cards). */
export function ChipRow({ children, tight = false }: { children: ReactNode; tight?: boolean }) {
  return <View style={[styles.row, { gap: tight ? 6 : 8 }]}>{children}</View>;
}

/**
 * A static 32 px chip ("What we'll match on", "More than one of you also likes"). Kept name: the same as
 * `<Chip size="sm" />`. `tone`: `private` (quiet lock chip), `neutral` (plain), or a pod chip when `color` is given.
 */
export function Tag({ label, tone, color, privateLabel }: { label: string; tone?: 'neutral' | 'private'; color?: PodColor | null; privateLabel?: string }) {
  return <Chip label={label} size="sm" kind={tone === 'private' ? 'private' : color ? 'pod' : 'clash'} color={color} privateLabel={privateLabel} />;
}

// ---------------------------------------------------------------------------------------------------------------
// Pills and badges
// ---------------------------------------------------------------------------------------------------------------

export type BadgeTone =
  /** Ink pill, white 13/700: New pod, You're in, Confirmed, Leading, Aarhus is live. */
  | 'status'
  /** Solsikke + 1.5 px Ink ring + clock: your own deadline (Answer by Sat 18:00, Pick a time by …, Next step). */
  | 'needsYou'
  /**
   * White pill with Ink text on a poster field: Week 46, 18+ only, Confirmed on the reveal. White/Ink in both schemes
   * (the house field stays Skov in dark; pod fields go deep), never a dark-card pill (blend-spec 12.1).
   */
  | 'onField'
  /** Ink "3 new" (12/800, 24 px). Never the pod's colour. */
  | 'unread'
  /** White with a 1 px Line border, Ink text (a neutral label on Paper, e.g. "Off"). */
  | 'outline'
  /** Quiet private pill: white, 1.5 px Ink border, lock ("Private interest"). */
  | 'private'
  /** Danger outline pill (rare: a destructive state). */
  | 'danger';

const BADGES: Record<BadgeTone, { bg: PaletteKey; fg: PaletteKey; border?: PaletteKey; borderWidth?: number; type: TypeVariant; height: number; icon?: IconName }> = {
  status: { bg: 'ink', fg: 'onInk', type: 'captionBold', height: Size.badge },
  needsYou: { bg: 'needsYou', fg: 'onNeedsYou', border: 'needsYouBorder', borderWidth: BorderWidth.control, type: 'captionBold', height: Size.badgeNeedsYou, icon: 'clock' },
  onField: { bg: 'fieldPill', fg: 'onFieldPill', type: 'captionBold', height: Size.badge },
  unread: { bg: 'ink', fg: 'onInk', type: 'badge', height: Size.badgeSmall },
  outline: { bg: 'surface', fg: 'text', border: 'border', borderWidth: BorderWidth.hairline, type: 'captionBold', height: Size.badge },
  private: { bg: 'privateBg', fg: 'privateText', border: 'privateBorder', borderWidth: BorderWidth.control, type: 'captionBold', height: Size.badge, icon: 'lock' },
  danger: { bg: 'surface', fg: 'danger', border: 'danger', borderWidth: BorderWidth.control, type: 'captionBold', height: Size.badge },
};

export interface BadgeProps {
  readonly label: string;
  /** Default `status`. */
  readonly tone?: BadgeTone;
  /** A leading 14 px icon (`check` on "You're in"). `needsYou` defaults to `clock`, `private` to `lock`; `null` hides it. */
  readonly icon?: IconName | null;
  /** `sm`: 24 px, 12/800 ("Leading", "3 new"). */
  readonly size?: 'md' | 'sm';
  readonly testID?: string;
}

export function Badge({ label, tone = 'status', icon, size = 'md', testID }: BadgeProps) {
  const p = usePalette();
  const b = BADGES[tone];
  const sm = size === 'sm' || tone === 'unread';
  const height = sm ? Size.badgeSmall : b.height;
  const glyph = icon === null ? undefined : (icon ?? b.icon);
  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { height, borderRadius: height / 2, paddingLeft: sm ? 8 : glyph ? 9 : 11, paddingRight: sm ? 8 : 11, backgroundColor: p[b.bg] },
        b.border ? { borderWidth: b.borderWidth ?? BorderWidth.hairline, borderColor: p[b.border] } : null,
      ]}
    >
      {glyph ? <Icon name={glyph} size={sm ? 12 : 14} strokeWidth={glyph === 'check' ? 2.6 : 2.2} color={p[b.fg]} /> : null}
      <Text variant={sm ? 'badge' : b.type} style={{ color: p[b.fg] }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The Ink unread badge ("3 new"). Put the accessible wording on the row ("Chat, 3 new messages"). */
export function UnreadBadge({ label, testID }: { label: string; testID?: string }) {
  return <Badge tone="unread" label={label} testID={testID} />;
}

/** The Ink unread dot (8 px, 2 px surface ring) for a tab icon or an avatar. Decorative. */
export function UnreadDot() {
  const p = usePalette();
  return <View accessible={false} style={[styles.unreadDot, { backgroundColor: p.ink, borderColor: p.surface }]} />;
}

export interface StatusTextProps {
  readonly label: string;
  /** `check` (Coming, You're in this week), `clock` (Hasn't confirmed, Open until …) or any icon. */
  readonly icon?: IconName | null;
  /** Default Ink 2 (`textSecondary`). */
  readonly color?: PaletteKey;
  readonly testID?: string;
}

/**
 * A quiet status: 14 px icon + Ink 2 13/700 words, no pill, no colour. Use it for other people's states ("Hasn't
 * confirmed" next to a dashed avatar: nobody is flagged in alarm colour in front of the group) and calm facts.
 */
export function StatusText({ label, icon = 'check', color = 'textSecondary', testID }: StatusTextProps) {
  const p = usePalette();
  return (
    <View style={styles.status} testID={testID}>
      {icon ? <Icon name={icon} size={14} strokeWidth={icon === 'check' ? 2.4 : 2.2} color={p[color]} /> : null}
      <Text variant="captionBold" color={color}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noShrink: { flexShrink: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch' },
  remove: { width: Size.hitTarget, height: Size.hitTarget, marginVertical: -4, marginLeft: -5, alignItems: 'center', justifyContent: 'center' },
  suggestionHit: { minHeight: Size.hitTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  suggestion: { height: Size.chip, borderRadius: Size.chip / 2, borderWidth: BorderWidth.control, paddingLeft: 10, paddingRight: 14, gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  unreadDot: { width: 8 + 4, height: 8 + 4, borderRadius: 6, borderWidth: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
