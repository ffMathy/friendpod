import type { LaunchAreaStatus } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Badge, Card, Text, type BadgeTone, type IconName } from '@/components/ui';

export interface AreaCardProps {
  /** What the user picked: the postcode's district ("Aarhus C"), the launch area, or "Near you". */
  readonly name: string;
  /** The launch area the cell falls in (bundled areas.json), or null outside every launch area. */
  readonly area: { readonly label: string; readonly status: LaunchAreaStatus } | null;
}

/**
 * "Your area" (onb-area): the district, whether Grouper runs there, a drawing of the ~5 km cell, and what is stored.
 * A white card (radius 22, padding 16). The status comes from the bundled launch-area config (the area doc itself is
 * only readable after onboarding): "Aarhus is live" is the Ink status pill with a check; "opens soon" and "not open
 * here yet" are quiet outline pills (nothing for the user to do, so never the needs-you yellow).
 */
export function AreaCard({ name, area }: AreaCardProps) {
  const { t } = useTranslation();
  const badge: { label: string; tone: BadgeTone; icon: IconName | null } = !area
    ? { label: t('onboarding.area.notOpen'), tone: 'outline', icon: null }
    : area.status === 'live'
      ? { label: t('onboarding.area.live', { city: area.label }), tone: 'status', icon: 'check' }
      : { label: t('onboarding.area.opensSoon', { city: area.label }), tone: 'outline', icon: 'clock' };
  return (
    <Card testID="area-card" accessibilityLabel={t('onboarding.area.yourArea')}>
      <View style={styles.top}>
        <View style={styles.name}>
          <Text variant="captionStrong" color="textMuted">
            {t('onboarding.area.yourArea')}
          </Text>
          <Text variant="cardTitle">{name}</Text>
        </View>
        <View style={styles.badge}>
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>
      </View>
      <AreaMap />
      <Text variant="caption" color="textSecondary">
        {area ? t('onboarding.area.storedNote') : `${t('onboarding.area.outsideHint')} ${t('onboarding.area.storedNote')}`}
      </Text>
    </Card>
  );
}

/** onb-area's map: 104 px tall, as wide as the card's content (308 px on a 390 px phone). */
const MAP_HEIGHT = 104;
const MAP_WIDTH = 308;
const x = (n: number) => `${(n / MAP_WIDTH) * 100}%` as const;

/**
 * The ~5 km cell as onb-area draws it: a Divider-grey map crossed by white streets (4 and 3 px), and the cell as a
 * 104 × 72 outline in Ink 2 (radius 12, 2 px), no fill. Decorative.
 */
function AreaMap() {
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.map, { backgroundColor: p.separator }]}>
      <View style={[styles.abs, styles.streetWide, { backgroundColor: p.surface }]} />
      <View style={[styles.abs, styles.streetNarrow, { backgroundColor: p.surface }]} />
      <View style={[styles.abs, styles.avenueWide, { left: x(190), backgroundColor: p.surface }]} />
      <View style={[styles.abs, styles.avenueNarrow, { left: x(62), backgroundColor: p.surface }]} />
      <View style={[styles.abs, styles.cell, { left: x(118), width: x(104), borderColor: p.textSecondary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 1, gap: 2 },
  badge: { flexShrink: 0 },
  map: { height: MAP_HEIGHT, borderRadius: Radius.md, overflow: 'hidden', alignSelf: 'stretch' },
  abs: { position: 'absolute' },
  streetWide: { left: 0, right: 0, top: 60, height: 4 },
  streetNarrow: { left: 0, right: 0, top: 22, height: 3 },
  avenueWide: { top: 0, bottom: 0, width: 4 },
  avenueNarrow: { top: 0, bottom: 0, width: 3 },
  cell: { top: 16, height: 72, borderRadius: 12, borderWidth: BorderWidth.strong },
});
