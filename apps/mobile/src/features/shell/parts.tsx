/**
 * Building blocks of the Me tab, Settings and the info pages. These screens have no storyboard of their own, so they
 * borrow the storyboards' patterns: the in-page header of priv-settings ("Me" above a 30/800 title) and priv-delete
 * (the back chevron above it), drop-why's icon list and "What we never use" box, priv-delete's bullet card.
 */
import { DROP_TIME_ZONE, type Locale } from '@grouper/core';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { BorderWidth, Layout, Radius, Size, usePalette, type PaletteKey } from '@/components/theme';
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
 * A pushed page (Settings, info pages): back chevron, eyebrow, 30/800 title, 20 px gutter, gap 16 (priv-delete).
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
    <Screen testID={testID} safeTop gutter="compact" gap={gap} footer={footer} contentStyle={{ paddingTop: top }}>
      <PageHeader title={title} eyebrow={eyebrow} subtitle={subtitle} onBack={back} />
      {children}
    </Screen>
  );
}

/** A lede under the page title (priv-delete: 15/1.5, #3E4943). */
export function PageLede({ children }: { readonly children: ReactNode }) {
  return (
    <Text variant="body" color="textSecondary">
      {children}
    </Text>
  );
}

export type BulletTone = 'mint' | 'warning' | 'private' | 'neutral' | 'danger';

const BULLET_TONES: Record<BulletTone, { readonly bg: PaletteKey; readonly fg: PaletteKey }> = {
  mint: { bg: 'mint', fg: 'onMint' },
  warning: { bg: 'warningBg', fg: 'warningText' },
  private: { bg: 'privateBg', fg: 'privateText' },
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
  danger: { bg: 'dangerBg', fg: 'dangerText' },
};

/** A 28 px tinted circle with a 16 px icon (drop-why's reason bullets). Decorative. */
export function IconDot({ icon, tone = 'mint', size = 28 }: { readonly icon: IconName; readonly tone?: BulletTone; readonly size?: number }) {
  const p = usePalette();
  const t = BULLET_TONES[tone];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: p[t.bg] }]}
    >
      <Icon name={icon} size={Math.round(size * 0.57)} color={p[t.fg]} strokeWidth={icon === 'check' ? 2.4 : undefined} />
    </View>
  );
}

/** One line of drop-why's list: the tinted icon, then 15/1.45 text. */
export function IconBullet({ icon, tone, children }: { readonly icon: IconName; readonly tone?: BulletTone; readonly children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <IconDot icon={icon} tone={tone} />
      <Text variant="body" style={styles.bulletText}>
        {children}
      </Text>
    </View>
  );
}

/** A white card with a 15/700 heading and plain bullets in 14/1.5 (priv-delete "What happens"). */
export function BulletCard({ title, items, children, testID }: { readonly title: string; readonly items: readonly string[]; readonly children?: ReactNode; readonly testID?: string }) {
  const p = usePalette();
  return (
    <Card gap={10} testID={testID}>
      <Heading>{title}</Heading>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listItem}>
            <View style={[styles.bulletMark, { backgroundColor: p.textBody }]} />
            <Text variant="small" color="textBody" style={styles.flex}>
              {item}
            </Text>
          </View>
        ))}
      </View>
      {children}
    </Card>
  );
}

/** A white card with a 15/700 heading and drop-why's icon bullets. */
export function IconListCard({ title, children, testID }: { readonly title: string; readonly children: ReactNode; readonly testID?: string }) {
  return (
    <Card gap={14} testID={testID}>
      <Heading>{title}</Heading>
      {children}
    </Card>
  );
}

/**
 * drop-why's grey "What we never use" box (14/700 title, 13/1.5 text, r16, padding 14/16). On the page colour it takes
 * the muted surface so it still reads as a box.
 */
export function NoteBox({ title, children, testID }: { readonly title: string; readonly children: ReactNode; readonly testID?: string }) {
  const p = usePalette();
  return (
    <View testID={testID} style={[styles.note, { backgroundColor: p.surfaceMuted }]}>
      <Text variant="smallBold">{title}</Text>
      <Text variant="caption" color="textSecondary">
        {children}
      </Text>
    </View>
  );
}

/**
 * A list-card row that holds a control (the language switch): the label on the left, the control on the right. Unlike
 * a static ListRow it does not group its children, so the control stays reachable by screen readers.
 */
export function ControlRow({ label, children, separator = false }: { readonly label: string; readonly children: ReactNode; readonly separator?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.controlRow, separator ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null]}>
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
  const stroke = color ?? p.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={GEAR} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} fill="none" stroke={stroke} strokeWidth={1.8} />
    </Svg>
  );
}

/**
 * A quiet destructive action in the red family (priv-settings' "Delete account" text, #8A2E17): the small 40 px
 * ghost pill of `Button size="xs"`, with the label and icon in danger text and a pale red press state. A 44 px touch
 * target comes from hitSlop.
 */
export function DangerTextButton({
  label,
  icon,
  onPress,
  busy = false,
  testID,
}: {
  readonly label: string;
  readonly icon?: IconName;
  readonly onPress: () => void;
  readonly busy?: boolean;
  readonly testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      hitSlop={(Size.hitTarget - Size.buttonSmall) / 2}
      style={({ pressed }) => [styles.dangerButton, { backgroundColor: pressed ? p.dangerBg : 'transparent' }]}
    >
      {busy ? (
        <ActivityIndicator color={p.dangerText} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={16} color={p.dangerText} /> : null}
          <Text variant="smallBold" color="dangerText">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dangerButton: { minHeight: Size.buttonSmall, paddingHorizontal: 14, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  flex: { flex: 1 },
  dot: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bullet: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  // drop-why sets these at 15/1.45; the 28 px dot centres on the first line.
  bulletText: { flex: 1, lineHeight: 22, marginTop: 3 },
  list: { gap: 8 },
  listItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingLeft: 6 },
  bulletMark: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
});
