import type { LaunchAreaStatus } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette, type PaletteKey } from '@/components/theme';
import { Card, Small, Text } from '@/components/ui';

export interface AreaCardProps {
  /** What the user picked: the postcode's district ("Aarhus C"), the launch area, or "Near you". */
  readonly name: string;
  /** The launch area the cell falls in (bundled areas.json), or null outside every launch area. */
  readonly area: { readonly label: string; readonly status: LaunchAreaStatus } | null;
}

/**
 * "Your area" (onb-area): the district, whether Grouper runs there, a drawing of the ~5 km cell, and what is stored.
 * The status comes from the bundled launch-area config; the area doc itself is only readable after onboarding.
 */
export function AreaCard({ name, area }: AreaCardProps) {
  const { t } = useTranslation();
  const badge: StatusPillProps = !area
    ? { label: t('onboarding.area.notOpen'), bg: 'surface', fg: 'text', border: 'border' }
    : area.status === 'live'
      ? { label: t('onboarding.area.live', { city: area.label }), bg: 'mint', fg: 'onMint' }
      : { label: t('onboarding.area.opensSoon', { city: area.label }), bg: 'warningBg', fg: 'warningText', border: 'warningBorder' };
  return (
    <Card testID="area-card" padding={18} accessibilityLabel={t('onboarding.area.yourArea')}>
      <View style={styles.top}>
        <View style={styles.name}>
          <Text variant="caption" color="textMuted" style={styles.overline}>
            {t('onboarding.area.yourArea')}
          </Text>
          <Text variant="stat">{name}</Text>
        </View>
        <StatusPill {...badge} />
      </View>
      <AreaMap />
      <Small>{area ? t('onboarding.area.storedNote') : `${t('onboarding.area.outsideHint')} ${t('onboarding.area.storedNote')}`}</Small>
    </Card>
  );
}

/** onb-area's map is 110 px tall; 90 keeps the whole card above the pinned Continue on a 390×844 phone. */
const MAP_HEIGHT = 90;
/** The storyboard's drawing, 304 px wide, squeezed to MAP_HEIGHT: the ~5 km cell between two streets. */
const MAP_WIDTH = 304;
const pct = (n: number) => `${(n / MAP_WIDTH) * 100}%` as const;

/** The ~5 km cell as onb-area draws it: a sage square with a green edge on a grey map, crossed by two white streets. */
function AreaMap() {
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.map, { backgroundColor: p.surfaceMuted }]}>
      <View style={[styles.abs, styles.cell, { left: pct(120), width: pct(100), backgroundColor: p.sage, borderColor: p.primary }]} />
      <View style={[styles.abs, styles.street, { left: pct(20), width: pct(300), backgroundColor: p.surface }]} />
      <View style={[styles.abs, styles.avenue, { left: pct(190), backgroundColor: p.surface }]} />
    </View>
  );
}

interface StatusPillProps {
  readonly label: string;
  readonly bg: PaletteKey;
  readonly fg: PaletteKey;
  readonly border?: PaletteKey;
}

/** The area's status as onb-area draws "Aarhus is live": a 28 px pill, 12 px sides, 13/700 (Badge is 13/800). */
function StatusPill({ label, bg, fg, border }: StatusPillProps) {
  const p = usePalette();
  return (
    <View style={[styles.pill, { backgroundColor: p[bg] }, border ? { borderWidth: BorderWidth.hairline, borderColor: p[border] } : null]}>
      <Text variant="captionBold" color={fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: MAP_HEIGHT, borderRadius: Radius.md, overflow: 'hidden', alignSelf: 'stretch' },
  abs: { position: 'absolute' },
  // 18/74 of 110 in the storyboard, scaled to 90; the cross street runs just below the cell's middle, as drawn there.
  cell: { top: 15, height: 60, borderRadius: Radius.sm, borderWidth: BorderWidth.strong, opacity: 0.55 },
  street: { top: 49, height: 2 },
  avenue: { top: 0, width: 2, height: MAP_HEIGHT },
  pill: { height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', flexShrink: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 1, gap: 2 },
  // A one-line label over the name, at the font's normal line height as in onb-area.
  overline: { lineHeight: 16 },
});
