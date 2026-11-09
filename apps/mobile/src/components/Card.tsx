/**
 * Surfaces (blend spec §5, §6.5, §6.6): cards, notes, the illustrations, empty states, dividers and section headers.
 * Paper ground, white cards with a 1 px Line border, no shadows. The only coloured backgrounds in the app are a poster
 * field, a pod tint, the Skov tint of the active tab and the small Solsikke needs-you pill or marker: no yellow, pink,
 * mint, amber or purple boxes.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TextLink } from './Button';
import { Icon, type IconName } from './Icon';
import { PodMark } from './Logo';
import { Text } from './Text';
import { BorderWidth, Layout, Radius, usePalette, type PaletteKey } from './theme';

export type CardVariant =
  /** White, 1 px Line, radius 22, padding 16. */
  | 'default'
  /** White with a 2 px Skov border (the leading plan option, a selected card). */
  | 'highlighted'
  /** White, 1 px Line, radius 28, padding 20 (a calm panel: "No pod for you this week"). */
  | 'panel'
  /** A note inside a white card: Paper, radius 14, padding 10/12, no border. */
  | 'inset'
  /** Private stays quiet: white with a 1.5 px Ink border, radius 22 (the private interests card). */
  | 'private';

interface CardLook {
  readonly bg: PaletteKey;
  readonly border?: PaletteKey;
  readonly borderWidth?: number;
  readonly radius: number;
  readonly padding: number | { readonly v: number; readonly h: number };
  readonly gap: number;
}

const LOOKS: Record<CardVariant, CardLook> = {
  default: { bg: 'surface', border: 'border', radius: Radius.card, padding: Layout.cardPadding, gap: 12 },
  highlighted: { bg: 'surface', border: 'primary', borderWidth: BorderWidth.strong, radius: Radius.card, padding: Layout.cardPadding, gap: 12 },
  panel: { bg: 'surface', border: 'border', radius: Radius.panel, padding: Layout.heroPadding, gap: 16 },
  inset: { bg: 'inset', radius: Radius.md, padding: { v: 10, h: 12 }, gap: 6 },
  private: { bg: 'privateBg', border: 'privateBorder', borderWidth: BorderWidth.control, radius: Radius.card, padding: { v: 14, h: 16 }, gap: 10 },
};

export interface CardProps {
  readonly children?: ReactNode;
  readonly variant?: CardVariant;
  /** `private`: the 1.5 px Ink border of content about a private interest (any variant with a border). */
  readonly tone?: 'private';
  readonly gap?: number;
  readonly padding?: number;
  readonly radius?: number;
  /** Makes the whole card pressable (role link by default). */
  readonly onPress?: () => void;
  readonly accessibilityRole?: 'link' | 'button' | 'summary';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function Card({ children, variant = 'default', tone, gap, padding, radius, onPress, accessibilityRole, accessibilityLabel, testID, style }: CardProps) {
  const p = usePalette();
  const look = LOOKS[variant];
  const isPrivate = tone === 'private' && look.border !== undefined;
  const borderKey = isPrivate ? 'privateBorder' : look.border;
  const pad = padding ?? look.padding;
  const box: ViewStyle = {
    backgroundColor: p[look.bg],
    borderRadius: radius ?? look.radius,
    gap: gap ?? look.gap,
    ...(typeof pad === 'number' ? { padding: pad } : { paddingVertical: pad.v, paddingHorizontal: pad.h }),
    ...(borderKey ? { borderWidth: isPrivate ? BorderWidth.control : (look.borderWidth ?? BorderWidth.hairline), borderColor: p[borderKey] } : {}),
  };
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole={accessibilityRole ?? 'link'}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} style={[box, style]}>
      {children}
    </View>
  );
}

export type NoteTone =
  /** A question only you can answer ("Did you mean …?", "You haven't met yet …"): white, a Solsikke marker with an Ink ring. */
  | 'needsYou'
  /** White card, Line border, Ink 2 info icon and text ("Your phone checks each interest …"). */
  | 'info'
  /** Paper, no border, Ink 2 text: a note inside a white card ("Names and photos appear when 4 people have said yes."). */
  | 'inset'
  /** White with a 1.5 px Danger border and a Danger icon, Ink text: "In danger right now? Call 112.", and errors. */
  | 'safety'
  /** Private stays quiet: white with a 1.5 px Ink border and an Ink lock (the private-interest explainers). */
  | 'private';

/** Kept name. */
export type BannerTone = NoteTone;

const NOTES: Record<NoteTone, { bg: PaletteKey; border?: PaletteKey; borderWidth?: number; text: PaletteKey; icon: PaletteKey; defaultIcon?: IconName; radius: number; padV: number; padH: number }> = {
  needsYou: { bg: 'surface', border: 'border', text: 'text', icon: 'onNeedsYou', defaultIcon: 'help', radius: Radius.lg, padV: 11, padH: 12 },
  info: { bg: 'surface', border: 'border', text: 'textSecondary', icon: 'textSecondary', defaultIcon: 'info', radius: Radius.lg, padV: 10, padH: 12 },
  inset: { bg: 'inset', text: 'textSecondary', icon: 'textSecondary', radius: Radius.md, padV: 10, padH: 12 },
  safety: { bg: 'surface', border: 'danger', borderWidth: BorderWidth.control, text: 'text', icon: 'danger', defaultIcon: 'phone', radius: Radius.lg, padV: 12, padH: 14 },
  private: { bg: 'privateBg', border: 'privateBorder', borderWidth: BorderWidth.control, text: 'textSecondary', icon: 'privateText', defaultIcon: 'lock', radius: Radius.lg, padV: 12, padH: 14 },
};

export interface NoteProps {
  readonly tone?: NoteTone;
  /** Leading icon; `null` hides the tone's default icon. For `needsYou` it is drawn inside the Solsikke marker. */
  readonly icon?: IconName | null;
  readonly title?: string;
  /** Plain text is set in 13/20 (14/20 for needsYou and safety); pass nodes for richer content. */
  readonly children?: ReactNode;
  /** Buttons under the text. */
  readonly actions?: ReactNode;
  /** Announce as an alert (warnings that appear in response to an action). */
  readonly alert?: boolean;
  /** Inside a white card: Paper fill, no border (needsYou and info). */
  readonly onCard?: boolean;
  readonly testID?: string;
}

/** The needs-you marker: a 20 px Solsikke disc with a 1.5 px Ink ring and a 13 px icon. Decorative. */
export function NeedsYouMarker({ icon = 'help' }: { icon?: IconName }) {
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.marker, { backgroundColor: p.needsYou, borderColor: p.needsYouBorder }]}>
      <Icon name={icon} size={13} strokeWidth={2.4} color={p.onNeedsYou} />
    </View>
  );
}

/** Notes (spec §6.5). Exported as `Note` and, for existing call sites, `Banner`. */
export function Note({ tone = 'info', icon, title, children, actions, alert = false, onCard = false, testID }: NoteProps) {
  const p = usePalette();
  const b = NOTES[tone];
  const glyph = icon === null ? undefined : (icon ?? b.defaultIcon);
  const plainOnCard = onCard && (tone === 'needsYou' || tone === 'info');
  const textVariant = tone === 'needsYou' || tone === 'safety' ? 'small' : 'caption';
  return (
    <View
      testID={testID}
      accessibilityRole={alert ? 'alert' : undefined}
      style={[
        styles.note,
        { backgroundColor: plainOnCard ? p.inset : p[b.bg], borderRadius: plainOnCard ? Radius.md : b.radius, paddingVertical: b.padV, paddingHorizontal: b.padH },
        b.border && !plainOnCard ? { borderWidth: b.borderWidth ?? BorderWidth.hairline, borderColor: p[b.border] } : null,
      ]}
    >
      <View style={styles.noteRow}>
        {glyph ? (
          tone === 'needsYou' ? (
            <NeedsYouMarker icon={glyph} />
          ) : (
            <Icon name={glyph} size={tone === 'inset' ? 16 : 20} color={p[b.icon]} style={styles.noteIcon} />
          )
        ) : null}
        <View style={styles.noteText}>
          {title ? (
            <Text variant="smallBold" color="text">
              {title}
            </Text>
          ) : null}
          {typeof children === 'string' ? (
            <Text variant={textVariant} color={b.text}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      </View>
      {actions ? <View style={styles.noteActions}>{actions}</View> : null}
    </View>
  );
}

/** Kept name for `Note`. */
export const Banner = Note;
export type BannerProps = NoteProps;

const ILLUSTRATIONS: Record<'welcome' | 'noPod' | 'area', { height: number; bg: PaletteKey; radius: number }> = {
  /** The poster mark on the house field. */
  welcome: { height: 220, bg: 'house', radius: Radius.panel },
  /** drop-none: you, and three open seats, on Paper. */
  noPod: { height: 120, bg: 'inset', radius: Radius.card },
  /** onb-area: a map cell. */
  area: { height: 110, bg: 'inset', radius: Radius.md },
};

/** Calm art for empty states and the area step. Decorative; scales across the available width. */
export function Illustration({ variant = 'welcome', height }: { variant?: keyof typeof ILLUSTRATIONS; height?: number }) {
  const p = usePalette();
  const art = ILLUSTRATIONS[variant];
  const h = height ?? art.height;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.art, { height: h, borderRadius: art.radius, backgroundColor: p[art.bg] }]}
    >
      {variant === 'welcome' ? <PodMark variant="poster" ground="skov" size={Math.min(220, Math.round(((h - 24) * 120) / 112))} /> : null}
      {variant === 'noPod' ? (
        <View style={styles.seats}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.ink }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: p.field }} />
          ))}
        </View>
      ) : null}
      {variant === 'area' ? <View style={[styles.cell, { borderColor: p.primary, backgroundColor: p.tabActiveBg }]} /> : null}
    </View>
  );
}

/** "No pod for you this week": an illustration, a Headline title, body text and actions, on a panel card. */
export function EmptyState({ title, body, illustration = 'noPod', children }: { title: string; body?: string; illustration?: 'noPod' | 'welcome' | null; children?: ReactNode }) {
  return (
    <Card variant="panel" gap={16}>
      {illustration ? <Illustration variant={illustration} height={illustration === 'welcome' ? 160 : undefined} /> : null}
      <Text accessibilityRole="header" variant="headline">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textSecondary">
          {body}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** A 1 px line; with `label` it is the "or" separator between two ways to do something. */
export function Divider({ label, color = 'border' }: { label?: string; color?: PaletteKey }) {
  const p = usePalette();
  if (!label) return <View style={[styles.line, styles.stretch, { backgroundColor: p[color] }]} />;
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.line, styles.flex, { backgroundColor: p[color] }]} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.line, styles.flex, { backgroundColor: p[color] }]} />
    </View>
  );
}

export interface SectionHeaderProps {
  readonly title: string;
  /** Muted suffix after a middle dot ("· 5 added", "· 1 of 2 active"). */
  readonly count?: string;
  /** A link at the right ("Edit"). */
  readonly action?: { readonly label: string; readonly onPress: () => void };
  /** `heading` 15/700 (default) or `overline` (the eyebrow: 12/800 caps, Muted), used inside list cards. */
  readonly variant?: 'heading' | 'overline';
}

export function SectionHeader({ title, count, action, variant = 'heading' }: SectionHeaderProps) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" variant={variant} color={variant === 'overline' ? 'textMuted' : 'text'} style={styles.flexShrink}>
        {title}
        {count ? (
          <Text variant={variant} weight="500" color="textMuted">
            {` · ${count}`}
          </Text>
        ) : null}
      </Text>
      {action ? <TextLink compact label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  stretch: { alignSelf: 'stretch' },
  note: { gap: 10 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteIcon: { marginTop: 0 },
  noteText: { flex: 1, gap: 4 },
  noteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  art: { overflow: 'hidden', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  marker: { width: 20, height: 20, borderRadius: 10, borderWidth: BorderWidth.control, alignItems: 'center', justifyContent: 'center' },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cell: { width: 100, height: 74, borderRadius: 10, borderWidth: 2 },
  line: { height: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 },
});
