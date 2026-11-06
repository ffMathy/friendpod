import { AVAILABILITY } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import { Text } from '@/components/ui';

type Slot = keyof typeof AVAILABILITY;

const COLUMNS = ['weekdays', 'saturday', 'sunday'] as const;
const ROWS: readonly { readonly key: 'daytime' | 'evening'; readonly slots: readonly [Slot, Slot, Slot] }[] = [
  { key: 'daytime', slots: ['weekdayDay', 'saturdayDay', 'sundayDay'] },
  { key: 'evening', slots: ['weekdayEvening', 'saturdayEvening', 'sundayEvening'] },
];

const CELL = 36;

/**
 * "When are you usually free?" (onb-prefs): weekdays / Saturday / Sunday × daytime / evening, the 6-bit availability
 * mask (A9). Each cell is a checkbox named by its slot ("Saturday, daytime"); 36 px tall with hitSlop to 44.
 */
export function AvailabilityGrid({ value, onChange }: { readonly value: number; readonly onChange: (mask: number) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <View style={styles.grid}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.rowLabel} />
        {COLUMNS.map((c) => (
          <Text key={c} variant="captionStrong" color="textMuted" align="center" style={[styles.cell, styles.normal]}>
            {t(`prefs.grid.${c}`)}
          </Text>
        ))}
      </View>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text variant="captionStrong" color="textMuted" style={styles.rowLabel} importantForAccessibility="no" accessibilityElementsHidden>
            {t(`prefs.grid.${row.key}`)}
          </Text>
          {row.slots.map((slot) => {
            const bit = AVAILABILITY[slot];
            const on = (value & bit) !== 0;
            return (
              <Pressable
                key={slot}
                testID={`availability-${slot}`}
                accessibilityRole="checkbox"
                accessibilityLabel={t(`availability.${slot}`)}
                accessibilityState={{ checked: on }}
                onPress={() => onChange(on ? value & ~bit : value | bit)}
                hitSlop={{ top: (Size.hitTarget - CELL) / 2, bottom: (Size.hitTarget - CELL) / 2 }}
                style={({ pressed }) => [
                  styles.cell,
                  styles.box,
                  on ? { backgroundColor: p.primary, borderColor: p.primary } : { backgroundColor: p.surface, borderColor: p.borderStrong },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { width: 76 },
  // The column heads at the font's normal line height (13 px → ~16), as onb-prefs sets them.
  normal: { lineHeight: 16 },
  cell: { flex: 1 },
  box: { height: CELL, borderRadius: Radius.sm, borderWidth: BorderWidth.hairline },
});
