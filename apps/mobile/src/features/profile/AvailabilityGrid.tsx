import { AVAILABILITY } from '@friendpod/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Icon, Text } from '@/components/ui';

type Slot = keyof typeof AVAILABILITY;

const COLUMNS = ['weekdays', 'saturday', 'sunday'] as const;
const ROWS: readonly { readonly key: 'daytime' | 'evening'; readonly slots: readonly [Slot, Slot, Slot] }[] = [
  { key: 'daytime', slots: ['weekdayDay', 'saturdayDay', 'sundayDay'] },
  { key: 'evening', slots: ['weekdayEvening', 'saturdayEvening', 'sundayEvening'] },
];

const CELL = 44;

/**
 * "When are you usually free?" (onb-prefs): weekdays / Saturday / Sunday × daytime / evening, the 6-bit availability
 * mask (A9). Column heads 13/600 Muted, row labels 13/600 Ink 2; each cell is a 44 px checkbox named by its slot
 * ("Saturday, daytime"), radius 14: off = white with the 1.5 px Field border, on = Ink with a white check (spec §6.15:
 * a selected choice is Ink).
 */
export function AvailabilityGrid({ value, onChange }: { readonly value: number; readonly onChange: (mask: number) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <View style={styles.grid}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.rowLabel} />
        {COLUMNS.map((c) => (
          <Text key={c} variant="captionStrong" color="textMuted" align="center" numberOfLines={1} style={styles.cell}>
            {t(`prefs.grid.${c}`)}
          </Text>
        ))}
      </View>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text variant="captionStrong" color="textSecondary" style={styles.rowLabel} importantForAccessibility="no" accessibilityElementsHidden>
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
                style={({ pressed }) => [
                  styles.cell,
                  styles.box,
                  on ? { backgroundColor: p.ink } : { backgroundColor: p.surface, borderWidth: BorderWidth.control, borderColor: p.field },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {on ? <Icon name="check" size={18} strokeWidth={2.4} color={p.onInk} /> : null}
              </Pressable>
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
  rowLabel: { width: 72 },
  cell: { flex: 1 },
  box: { height: CELL, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
