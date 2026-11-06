/**
 * Small pieces shared by Me, Settings and the info pages (storyboards 5.3 and 5.4): rows with a green icon, a row with
 * an action under it, bullet lists and tinted icon badges. Everything else comes from @/components/ui.
 */
import { Children, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Radius, Spacing, usePalette, type Palette, type TypeVariant } from '@/components/theme';
import { AppText, Icon, Row, type IconName, type TextTone } from '@/components/ui';

/** Row icon (22) plus the row gap (12): where a row's text starts, for content under it. */
const TEXT_INSET = 34;

export interface SettingsRowProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Leading 22-pt icon, green as in storyboard 5.3 (coral with tone 'danger'). */
  readonly icon?: IconName;
  readonly onPress?: () => void;
  /** 'link' opens another page and gets a chevron; 'button' does something here (default). */
  readonly role?: 'link' | 'button';
  /** Shows a spinner instead of the chevron and blocks presses. */
  readonly busy?: boolean;
  readonly tone?: 'default' | 'danger';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** A row of a settings group: green icon, 16/600 title, muted subtitle; links carry a chevron. */
export function SettingsRow({ title, subtitle, icon, onPress, role = 'button', busy = false, tone = 'default', accessibilityLabel, testID }: SettingsRowProps) {
  const p = usePalette();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      leading={icon ? <Icon name={icon} size={22} color={tone === 'danger' ? p.coralText : p.primary} /> : undefined}
      trailing={busy ? <ActivityIndicator color={p.primary} /> : undefined}
      chevron={role === 'link' && !busy}
      onPress={onPress}
      accessibilityRole={onPress ? role : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={busy}
      tone={tone}
      testID={testID}
    />
  );
}

/**
 * One item of a ListGroup: a row without an icon plus what belongs to it underneath (an action button). Keeps the
 * button out of the row's own touch area so screen readers reach both. Null children draw nothing.
 */
export function RowWithDetail({ row, children }: { row: ReactNode; children?: ReactNode }) {
  return (
    <View>
      {row}
      {Children.toArray(children).length > 0 ? <View style={styles.detail}>{children}</View> : null}
    </View>
  );
}

export interface BulletListProps {
  readonly items: readonly string[];
  /** Instead of a dot, this icon before each item (green). */
  readonly icon?: IconName;
  readonly variant?: TypeVariant;
  readonly tone?: TextTone;
  readonly testID?: string;
}

/** A list of sentences with dots or icons (storyboard 5.4, "What happens"). The markers are decorative. */
export function BulletList({ items, icon, variant = 'bodySm', tone = 'ink', testID }: BulletListProps) {
  const p = usePalette();
  return (
    <View testID={testID} style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <View style={[styles.marker, icon ? styles.markerIcon : styles.markerDot]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {icon ? <Icon name={icon} size={18} color={p.primary} /> : <View style={[styles.dot, { backgroundColor: p.inkSoft }]} />}
          </View>
          <AppText variant={variant} tone={tone} style={styles.flex}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export type BadgeTone = 'mint' | 'amber' | 'violet' | 'coral' | 'neutral';

function badgeLook(p: Palette, tone: BadgeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'mint':
      return { bg: p.mint, fg: p.primary };
    case 'amber':
      return { bg: p.amberBg, fg: p.amberText };
    case 'violet':
      return { bg: p.violetBg, fg: p.violet };
    case 'coral':
      return { bg: p.coralBg, fg: p.coralText };
    case 'neutral':
      return { bg: p.subtle, fg: p.inkSoft };
  }
}

/** A decorative icon on a tinted circle (notices, the notifications page). */
export function IconBadge({ icon, tone = 'mint', size = 36 }: { icon: IconName; tone?: BadgeTone; size?: number }) {
  const p = usePalette();
  const look = badgeLook(p, tone);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: look.bg }]}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} color={look.fg} />
    </View>
  );
}

/** A ground-coloured note inside a card (the "decided automatically" lines of a statement of reasons). */
export function InsetNote({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={[styles.inset, { backgroundColor: p.inset }]}>{children}</View>;
}

/** For content that sits under a row with an icon and draws itself only sometimes (pass it as that content's style). */
export const rowDetail = StyleSheet.create({
  inset: { paddingLeft: TEXT_INSET, paddingBottom: Spacing.ms },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detail: { gap: Spacing.sm, paddingBottom: Spacing.ms, alignItems: 'flex-start' },
  list: { gap: Spacing.sm },
  item: { flexDirection: 'row', gap: 10 },
  marker: { alignItems: 'center' },
  markerDot: { width: 12, paddingTop: 8 },
  markerIcon: { width: 18, paddingTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  inset: { borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.ms, gap: Spacing.xs },
});
