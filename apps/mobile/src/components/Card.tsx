/**
 * Surfaces: cards, notices, the illustrations, empty states, dividers and section headers.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TextLink } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { BorderWidth, Layout, Radius, usePalette, type PaletteKey } from './theme';

export type CardVariant =
  /** White, 1 px border, r20, padding 16. */
  | 'default'
  /** Mint tint, no border ("Our safety pledge", "Meet this pod again?"). */
  | 'mint'
  /** White with a 2 px green border, r22 (the leading plan option). */
  | 'highlighted'
  /** White, r28, padding 22 (the proposal card, "No pod for you this week"). */
  | 'panel'
  /** Dark, r26, padding 22 ("Next drop", "Next step", the waitlist counter). Text on it: onHero*. */
  | 'hero'
  /** Brand green, r28, padding 22 (the confirmed pod). Text on it: onBrand*. */
  | 'brand'
  /** Grey note inside a white card, r14, padding 10/12. */
  | 'inset';

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
  mint: { bg: 'mint', radius: Radius.card, padding: Layout.cardPadding, gap: 12 },
  highlighted: { bg: 'surface', border: 'primary', borderWidth: BorderWidth.strong, radius: Radius.cardLg, padding: Layout.cardPadding, gap: 12 },
  panel: { bg: 'surface', border: 'border', radius: Radius.panel, padding: Layout.heroPadding, gap: 18 },
  hero: { bg: 'hero', radius: Radius.hero, padding: Layout.heroPadding, gap: 14 },
  brand: { bg: 'brand', radius: Radius.panel, padding: Layout.heroPadding, gap: 14 },
  inset: { bg: 'inset', radius: Radius.md, padding: { v: 10, h: 12 }, gap: 6 },
};

export interface CardProps {
  readonly children?: ReactNode;
  readonly variant?: CardVariant;
  /** Purple border for content about a private interest (default and panel cards). */
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
  const borderKey = tone === 'private' && look.border ? 'privateBorder' : look.border;
  const pad = padding ?? look.padding;
  const box: ViewStyle = {
    backgroundColor: p[look.bg],
    borderRadius: radius ?? look.radius,
    gap: gap ?? look.gap,
    ...(typeof pad === 'number' ? { padding: pad } : { paddingVertical: pad.v, paddingHorizontal: pad.h }),
    ...(borderKey ? { borderWidth: look.borderWidth ?? BorderWidth.hairline, borderColor: p[borderKey] } : {}),
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

export type BannerTone = 'info' | 'warning' | 'danger' | 'private' | 'neutral' | 'mint';

const BANNERS: Record<BannerTone, { bg: PaletteKey; border?: PaletteKey; text: PaletteKey; icon: PaletteKey; defaultIcon?: IconName }> = {
  /** White note with the green info icon ("Your phone checks each interest…"). */
  info: { bg: 'surface', border: 'border', text: 'textSecondary', icon: 'primary', defaultIcon: 'info' },
  /** Amber ("Did you mean…", "You haven't met yet"). */
  warning: { bg: 'warningBg', border: 'warningBorder', text: 'warningInk', icon: 'warningText' },
  /** Red ("In danger right now? Call 112."). */
  danger: { bg: 'dangerBg', border: 'dangerBorder', text: 'dangerInk', icon: 'dangerText', defaultIcon: 'shield' },
  /** Purple (the private-pod explainer). */
  private: { bg: 'privateBg', text: 'privateInk', icon: 'privateText' },
  /** Grey ("Names and photos appear when 4 people have said yes", "What we never use"). */
  neutral: { bg: 'inset', text: 'textSecondary', icon: 'textMuted' },
  mint: { bg: 'mint', text: 'mintBody', icon: 'onMint' },
};

export interface BannerProps {
  readonly tone?: BannerTone;
  /** Leading icon; `null` hides the tone's default icon. */
  readonly icon?: IconName | null;
  readonly title?: string;
  /** Plain text is set in 13/400/1.5 (14 for danger and warning); pass nodes for richer content. */
  readonly children?: ReactNode;
  /** Buttons under the text. */
  readonly actions?: ReactNode;
  /** Announce as an alert (warnings that appear in response to an action). */
  readonly alert?: boolean;
  readonly testID?: string;
}

export function Banner({ tone = 'info', icon, title, children, actions, alert = false, testID }: BannerProps) {
  const p = usePalette();
  const b = BANNERS[tone];
  const glyph = icon === null ? undefined : (icon ?? b.defaultIcon);
  const textVariant = tone === 'danger' || tone === 'warning' ? 'small' : 'caption';
  return (
    <View
      testID={testID}
      accessibilityRole={alert ? 'alert' : undefined}
      style={[
        styles.banner,
        { backgroundColor: p[b.bg] },
        b.border ? { borderWidth: BorderWidth.hairline, borderColor: p[b.border] } : null,
      ]}
    >
      <View style={styles.bannerRow}>
        {glyph ? <Icon name={glyph} size={20} color={p[b.icon]} style={styles.bannerIcon} /> : null}
        <View style={styles.bannerText}>
          {title ? (
            <Text variant="smallBold" color={tone === 'info' || tone === 'neutral' ? 'text' : b.text}>
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
      {actions ? <View style={styles.bannerActions}>{actions}</View> : null}
    </View>
  );
}

type Circle = { x: number; y: number; d: number; color?: PaletteKey; dashed?: boolean };

const ILLUSTRATIONS: Record<'welcome' | 'noPod' | 'area', { width: number; height: number; bg: PaletteKey; radius: number; circles: Circle[] }> = {
  /** Main.dc.html: five people-dots on mint. */
  welcome: {
    width: 342,
    height: 220,
    bg: 'mint',
    radius: Radius.panel,
    circles: [
      { x: 56, y: 42, d: 72, color: 'primary' },
      { x: 150, y: 24, d: 92, color: 'accent' },
      { x: 260, y: 70, d: 64, color: 'sage' },
      { x: 96, y: 128, d: 84, color: 'accentSoft' },
      { x: 204, y: 132, d: 70, color: 'leaf' },
    ],
  },
  /** drop-none.dc.html: you, and three empty seats. */
  noPod: {
    width: 304,
    height: 120,
    bg: 'surfaceMuted',
    radius: Radius.card,
    circles: [
      { x: 70, y: 30, d: 56, color: 'ink' },
      { x: 150, y: 40, d: 40, dashed: true },
      { x: 206, y: 26, d: 40, dashed: true },
      { x: 262, y: 52, d: 40, dashed: true },
    ],
  },
  /** onb-area.dc.html: a map cell (drawn below). */
  area: { width: 304, height: 110, bg: 'surfaceMuted', radius: Radius.md, circles: [] },
};

/** The storyboards' coloured-circle art. Decorative; scales across the available width. */
export function Illustration({ variant = 'welcome', height }: { variant?: keyof typeof ILLUSTRATIONS; height?: number }) {
  const p = usePalette();
  const art = ILLUSTRATIONS[variant];
  const pct = (n: number) => `${(n / art.width) * 100}%` as const;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.art, { height: height ?? art.height, borderRadius: art.radius, backgroundColor: p[art.bg] }]}
    >
      {art.circles.map((c, i) => (
        <View
          key={i}
          style={[
            styles.abs,
            { left: pct(c.x), top: c.y, width: c.d, height: c.d, borderRadius: c.d / 2 },
            c.dashed ? { borderWidth: 2, borderStyle: 'dashed', borderColor: p.textFaint } : { backgroundColor: p[c.color ?? 'primary'] },
          ]}
        />
      ))}
      {variant === 'area' ? (
        <>
          <View style={[styles.abs, { left: pct(120), top: 18, width: 100, height: 74, borderRadius: 10, borderWidth: 2, borderColor: p.primary }, { backgroundColor: p.sage, opacity: 0.55 }]} />
          <View style={[styles.abs, { left: pct(20), top: 60, width: pct(300), height: 2, backgroundColor: p.surface }]} />
          <View style={[styles.abs, { left: pct(190), top: 0, width: 2, height: 110, backgroundColor: p.surface }]} />
        </>
      ) : null}
    </View>
  );
}

/** "No pod for you this week": an illustration, a 24/800 title, body text and actions, on a panel card. */
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
  /** `heading` 15/700 (default) or `overline` 13/700 uppercase, used inside list cards. */
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
  banner: { borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  bannerRow: { flexDirection: 'row', gap: 10 },
  bannerIcon: { marginTop: 1 },
  bannerText: { flex: 1, gap: 4 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  art: { overflow: 'hidden', alignSelf: 'stretch' },
  abs: { position: 'absolute' },
  line: { height: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 },
});
