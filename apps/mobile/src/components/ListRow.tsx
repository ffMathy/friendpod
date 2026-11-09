/**
 * List rows (blend spec §6.6). `inset` rows live in a `ListSection` card (priv-settings, pod members): min 52, a 1 px
 * Divider between rows, 16/600 label, 13 px Muted detail, a 20 px Muted chevron. `card` rows stand alone
 * (city-waitlist "Add a few more interests"): a white row with a 1 px Line border, radius 16. The whole row is the
 * link when it navigates.
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Overline, Text } from './Text';
import { BorderWidth, Radius, usePalette, type PaletteKey } from './theme';

export interface ListRowProps {
  readonly label: string;
  /** A muted line under the label ("1 interest, consent given"). */
  readonly detail?: string;
  /** Trailing text ("Coming", "Hasn't confirmed"). */
  readonly value?: string;
  readonly valueColor?: PaletteKey;
  /** A leading 22 px icon (Ink 2; Danger when `destructive`). */
  readonly icon?: IconName;
  /** A leading element instead of an icon (an Avatar). */
  readonly leading?: ReactNode;
  /** A trailing element (a Badge, a small Button). */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** Danger label and icon (prefer a `Button variant="danger"` for destructive actions). */
  readonly destructive?: boolean;
  /** Show the chevron (default: when pressable and there is no trailing value or element). */
  readonly chevron?: boolean;
  /** `card` (default when standalone) or `inset` (inside a ListSection). */
  readonly variant?: 'card' | 'inset';
  /** Bottom separator (ListSection sets it for all rows but the last). */
  readonly separator?: boolean;
  readonly accessibilityRole?: 'link' | 'button';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function ListRow({
  label,
  detail,
  value,
  valueColor = 'textMuted',
  icon,
  leading,
  trailing,
  onPress,
  destructive = false,
  chevron,
  variant = 'card',
  separator = false,
  accessibilityRole = 'link',
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const p = usePalette();
  const inset = variant === 'inset';
  const showChevron = chevron ?? (onPress !== undefined && value === undefined && trailing === undefined);
  const textColor: PaletteKey = destructive ? 'danger' : 'text';
  const content = (
    <>
      {leading}
      {icon ? <Icon name={icon} size={22} color={destructive ? p.danger : p.textSecondary} /> : null}
      <View style={styles.text}>
        <Text variant={inset ? 'rowTitle' : 'bodyStrong'} color={textColor}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="captionBold" color={valueColor}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={20} color={p.textMuted} /> : null}
    </>
  );
  const look = [
    styles.row,
    inset
      ? [styles.inset, separator ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null]
      : [styles.card, { backgroundColor: p.surface, borderColor: p.border, minHeight: detail ? 56 : 52 }],
  ];
  if (!onPress) {
    return (
      <View testID={testID} style={look} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [look, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** The older name: a standalone link row (`label`, optional `detail` under it, chevron). */
export function LinkRow(props: Omit<ListRowProps, 'accessibilityRole'>) {
  return <ListRow accessibilityRole="link" {...props} />;
}

/**
 * A list card: white, 1 px Line (private: 1.5 px Ink), radius 22, padding 6/16, rows separated by a 1 px Divider, with an
 * optional eyebrow title ("WHAT YOU'VE AGREED TO", "MEMBERS").
 */
export function ListSection({ title, children, tone, testID }: { title?: string; children: ReactNode; tone?: 'private'; testID?: string }) {
  const p = usePalette();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View
      testID={testID}
      style={[
        styles.section,
        { backgroundColor: p.surface, borderColor: tone === 'private' ? p.privateBorder : p.border, borderWidth: tone === 'private' ? BorderWidth.control : BorderWidth.hairline },
      ]}
    >
      {title ? (
        <View style={styles.sectionTitle}>
          <Overline color={tone === 'private' ? 'privateText' : 'textMuted'}>{title}</Overline>
        </View>
      ) : null}
      {rows.map((row, i) =>
        (row.type as unknown) === ListRow || (row.type as unknown) === LinkRow
          ? cloneElement(row as ReactElement<ListRowProps>, { variant: 'inset', separator: i < rows.length - 1 })
          : row,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inset: { minHeight: 52, paddingVertical: 6 },
  card: { borderWidth: BorderWidth.hairline, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  section: { borderRadius: Radius.card, paddingVertical: 6, paddingHorizontal: 16 },
  sectionTitle: { marginTop: 8, marginBottom: 2 },
});
