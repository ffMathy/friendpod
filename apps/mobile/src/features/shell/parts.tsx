/**
 * Building blocks of the Me tab, Settings and the info pages. These screens have no storyboard of their own, so they
 * follow direction E's calm screens: the in-page header of priv-settings ("Me" above the Bricolage title) and
 * priv-delete (the back chevron above it), white list cards, drop-why's disc bullets and onb-final's icon headings.
 * No pod colour here: these pages belong to no pod.
 */
import { DROP_TIME_ZONE, type Locale } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BorderWidth, Layout, usePalette } from '@/components/theme';
import { Card, Heading, Icon, PageHeader, Screen, Text, type IconName } from '@/components/ui';

/**
 * Top padding of a page that draws its own header: the storyboards put the title block 40 px (tab pages) or the back
 * chevron 32 px (pushed pages) below the top of the frame. Under a status bar the safe-area inset already gives most of
 * that room, so the page adds only what is missing.
 */
export function usePageTop(frameTop: number): number {
  const insets = useSafeAreaInsets();
  return Math.max(8, frameTop - insets.top);
}

/** `router.back` when there is a screen to go back to (a deep link may open a page on its own). */
export function useBack(): (() => void) | undefined {
  const router = useRouter();
  return router.canGoBack?.() ?? true ? () => router.back() : undefined;
}

/**
 * "31 Oct" / "31. okt." within the current year, "31 Oct 2025" / "31. okt. 2025" before it; in the drop time zone like
 * every other date in the app.
 */
export function formatDay(ms: number, locale: Locale, now: number = Date.now()): string {
  const tag = locale === 'da' ? 'da-DK' : 'en-GB';
  const year = (t: number) => new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: DROP_TIME_ZONE }).format(new Date(t));
  const sameYear = year(ms) === year(now);
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: DROP_TIME_ZONE }).format(new Date(ms));
}

export interface ShellPageProps {
  readonly title: string;
  /** The muted line above the title: where the page lives ("Me"). */
  readonly eyebrow?: string;
  /** Muted line under the title. */
  readonly subtitle?: string;
  /** Pinned at the bottom (a Save button). */
  readonly footer?: ReactNode;
  readonly gap?: number;
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * A pushed page (Settings, info pages): back chevron, eyebrow, the Bricolage 30/32 title, 20 px gutter, gap 16
 * (priv-delete).
 * One header rule for all of them: the back chevron whenever there is a page to go back to (32 px from the top, as on
 * priv-delete; without it the title block starts 40 px down, as on priv-settings), and the eyebrow names the tab the
 * page belongs to ("Me" for Settings and its pages, shown with Me selected in the tab bar). The info and legal pages
 * open from anywhere, signed in or out, so they have no eyebrow, like priv-delete; signed in, they keep the tab bar of
 * the tab they were opened from (app/info/_layout.tsx).
 */
export function ShellPage({ title, eyebrow, subtitle, footer, gap = Layout.gap, children, testID }: ShellPageProps) {
  const back = useBack();
  const top = usePageTop(back ? 32 : 40);
  return (
    <Screen testID={testID} safeTop gutter="compact" gap={gap} footer={footer ? <FadedFooter>{footer}</FadedFooter> : undefined} contentStyle={{ paddingTop: top }}>
      <PageHeader title={title} eyebrow={eyebrow} subtitle={subtitle} onBack={back} />
      {children}
    </Screen>
  );
}

/** Height of the fade above a pinned footer: the scroll content's bottom padding, so nothing fades once scrolled to the end. */
const FOOTER_FADE = 16;

/**
 * A pinned footer (Save) with the page fading into Paper above it, so content scrolled under the footer ends softly
 * instead of as a cut-off sliver of the next card. The fade sits over the bottom of the scroll view (Screen keeps 12 px
 * between the two) and lets touches through.
 */
function FadedFooter({ children }: { readonly children: ReactNode }) {
  const p = usePalette();
  const id = `shell-footer-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <View>
      <View pointerEvents="none" style={styles.fade}>
        <Svg width="100%" height={FOOTER_FADE} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={p.page} stopOpacity={0} />
              <Stop offset="1" stopColor={p.page} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={FOOTER_FADE} fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

/** A lede under the page title: body 16/24 in Ink 2 (priv-delete's paragraph under its title). */
export function PageLede({ children }: { readonly children: ReactNode }) {
  return (
    <Text variant="body" color="textSecondary">
      {children}
    </Text>
  );
}

/**
 * `neutral`: a Paper disc with an Ink 2 icon (drop-why's reason discs, without a pod colour: these pages belong to no
 * pod). `private`: white with a 1.5 px Ink ring and an Ink icon (private stays quiet).
 */
export type BulletTone = 'neutral' | 'private';

/** A 28 px disc with a 16 px icon (drop-why's reason bullets). Decorative. */
export function IconDot({ icon, tone = 'neutral', size = 28 }: { readonly icon: IconName; readonly tone?: BulletTone; readonly size?: number }) {
  const p = usePalette();
  const quiet = tone === 'private';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: quiet ? p.privateBg : p.inset },
        quiet ? { borderWidth: BorderWidth.control, borderColor: p.privateBorder } : null,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.57)} color={quiet ? p.privateText : p.textSecondary} strokeWidth={icon === 'check' ? 2.4 : undefined} />
    </View>
  );
}

/** One line of drop-why's list: the disc, then 15/22 text. */
export function IconBullet({ icon, tone, children }: { readonly icon: IconName; readonly tone?: BulletTone; readonly children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <IconDot icon={icon} tone={tone} />
      <Text variant="bodySmall" style={styles.bulletText}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A card's heading with a 20 px Ink icon before it (onb-final's "Know when your drop arrives" and "Our safety pledge"
 * cards). The icon is decorative; the heading is a header for screen readers.
 */
export function IconHeading({ icon, title }: { readonly icon: IconName; readonly title: string }) {
  const p = usePalette();
  return (
    <View style={styles.iconHeading}>
      <Icon name={icon} size={20} color={p.text} />
      <Heading style={styles.flex}>{title}</Heading>
    </View>
  );
}

/** A white card with a 15/700 heading (an optional icon before it) and drop-why's disc bullets. */
export function IconListCard({ title, icon, children, testID }: { readonly title: string; readonly icon?: IconName; readonly children: ReactNode; readonly testID?: string }) {
  return (
    <Card gap={14} testID={testID}>
      {icon ? <IconHeading icon={icon} title={title} /> : <Heading>{title}</Heading>}
      {children}
    </Card>
  );
}

/**
 * A list-card row that holds a control (the language switch): the label on the left, the control on the right. Unlike
 * a static ListRow it does not group its children, so the control stays reachable by screen readers.
 */
export function ControlRow({
  label,
  leading,
  children,
  separator = false,
}: {
  readonly label: string;
  /** A 22 px row icon before the label, as ListRow draws one, so the labels in a card line up. */
  readonly leading?: ReactNode;
  readonly children: ReactNode;
  readonly separator?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={[styles.controlRow, separator ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null]}>
      {leading}
      <Text variant="rowTitle" style={styles.flex}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/** A gear, drawn like the storyboard icons (24 grid, round stroke): the Settings row on Me. Decorative. */
const GEAR = 'M10.26 5.01L10.5 2.52L13.5 2.52L13.74 5.01L15.71 5.83L17.64 4.23L19.77 6.36L18.17 8.29L18.99 10.26L21.48 10.5L21.48 13.5L18.99 13.74L18.17 15.71L19.77 17.64L17.64 19.77L15.71 18.17L13.74 18.99L13.5 21.48L10.5 21.48L10.26 18.99L8.29 18.17L6.36 19.77L4.23 17.64L5.83 15.71L5.01 13.74L2.52 13.5L2.52 10.5L5.01 10.26L5.83 8.29L4.23 6.36L6.36 4.23L8.29 5.83Z';

export function GearIcon({ size = 22, color }: { readonly size?: number; readonly color?: ColorValue }) {
  const p = usePalette();
  // A neutral row icon: Ink 2, like the other rows' icons (Skov is only for things you tap).
  const stroke = color ?? p.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={GEAR} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} fill="none" stroke={stroke} strokeWidth={2} />
    </Svg>
  );
}

/** A globe, drawn like the storyboard icons (24 grid, round 2 px stroke): the Language row in Settings. Decorative. */
export function GlobeIcon({ size = 22, color }: { readonly size?: number; readonly color?: ColorValue }) {
  const p = usePalette();
  const stroke = color ?? p.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={12} cy={12} r={9} fill="none" stroke={stroke} strokeWidth={2} />
      <Path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3z" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Screen's footer has 12 px above its content and the compact gutter at the sides.
  fade: { position: 'absolute', top: -(12 + FOOTER_FADE), left: -Layout.gutterCompact, right: -Layout.gutterCompact, height: FOOTER_FADE },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  flex: { flex: 1 },
  dot: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bullet: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // drop-why sets these at 15/22; the 28 px disc centres on the first line.
  bulletText: { flex: 1, marginTop: 3 },
  iconHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
