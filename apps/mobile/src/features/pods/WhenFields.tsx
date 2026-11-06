import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChoiceChip, Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import { currentLocale } from '@/i18n';
import { OPTION_TIME_SLOTS, optionDays, slotOpen, slotStartsAt } from './optionForm';
import { PodSheet } from './PodSheet';
import { capitalize, dayDate, shortDayDate, slotClock } from './time';

export interface WhenFieldsProps {
  /** "YYYY-MM-DD" or "" before a day is picked. */
  readonly date: string;
  /** "HH:MM" or "" before a time is picked. */
  readonly time: string;
  readonly onDate: (date: string) => void;
  readonly onTime: (time: string) => void;
  /** When the form opened: the days on offer run from here to 14 days ahead. */
  readonly now: number;
}

/**
 * Day and Time of "Suggest a time" (pod-propose): two 52 px fields side by side with a calendar and a clock icon,
 * showing "Sun 15 Nov" and "15:00" ("søn. 15. nov.", "15.00"). Each opens a sheet of choices, so only what the
 * planner accepts can be picked: the days with an open time within 14 days, and every half hour from 08:00 to 22:00
 * (times already past, or past the window, are greyed out for the chosen day). The form still checks both on send.
 */
export function WhenFields({ date, time, onDate, onTime, now }: WhenFieldsProps) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [sheet, setSheet] = useState<'day' | 'time' | null>(null);
  const days = useMemo(() => optionDays(now), [now]);
  const close = () => setSheet(null);
  const noon = (ymd: string) => slotStartsAt(ymd, '12:00');
  const current = Date.now();

  return (
    <View style={styles.row}>
      <PickerField
        testID="option-date"
        label={t('plan.date')}
        value={date ? shortDayDate(noon(date), locale) : null}
        spokenValue={date ? capitalize(dayDate(noon(date), locale)) : null}
        placeholder={t('plan.dateHint')}
        icon="calendar"
        onPress={() => setSheet('day')}
      />
      <PickerField
        testID="option-time"
        label={t('plan.time')}
        value={time ? slotClock(time, locale) : null}
        placeholder={t('plan.timeHint')}
        icon="clock"
        onPress={() => setSheet('time')}
      />

      <PodSheet visible={sheet === 'day'} title={t('plan.pickDay')} onClose={close} testID="option-day-sheet">
        <View accessibilityRole="radiogroup" accessibilityLabel={t('plan.date')} style={styles.chips}>
          {days.map((ymd) => (
            <ChoiceChip
              key={ymd}
              testID={`option-day-${ymd}`}
              label={shortDayDate(noon(ymd), locale)}
              accessibilityLabel={capitalize(dayDate(noon(ymd), locale))}
              selected={ymd === date}
              selectedColor="primary"
              onPress={() => {
                onDate(ymd);
                close();
              }}
            />
          ))}
        </View>
      </PodSheet>

      <PodSheet visible={sheet === 'time'} title={t('plan.pickTime')} onClose={close} testID="option-time-sheet">
        <Text variant="caption" color="textMuted">
          {t('plan.timeWindow')}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('plan.time')} style={styles.chips}>
          {OPTION_TIME_SLOTS.map((slot) => (
            <ChoiceChip
              key={slot}
              testID={`option-time-${slot}`}
              label={slotClock(slot, locale)}
              selected={slot === time}
              selectedColor="primary"
              disabled={date !== '' && !slotOpen(date, slot, current)}
              onPress={() => {
                onTime(slot);
                close();
              }}
            />
          ))}
        </View>
      </PodSheet>
    </View>
  );
}

interface PickerFieldProps {
  readonly label: string;
  readonly value: string | null;
  /** What screen readers hear for the value, when the visible one is abbreviated ("Sunday 15 Nov"). */
  readonly spokenValue?: string | null;
  readonly placeholder: string;
  readonly icon: 'calendar' | 'clock';
  readonly onPress: () => void;
  readonly testID: string;
}

/** A 14/700 label over a 52 px r14 box with the value in 16 px and the icon at the right (the storyboard's inputs). */
function PickerField({ label, value, spokenValue, placeholder, icon, onPress, testID }: PickerFieldProps) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text variant="smallBold" style={styles.label} accessible={false} importantForAccessibility="no">
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${spokenValue ?? value ?? placeholder}`}
        onPress={onPress}
        style={({ pressed }) => [styles.box, { backgroundColor: pressed ? p.surfaceMuted : p.surface, borderColor: p.borderStrong }]}
      >
        <Text variant="lede" color={value ? 'text' : 'textFaint'} numberOfLines={1} style={styles.value}>
          {value ?? placeholder}
        </Text>
        <Icon name={icon} size={18} color={p.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, minWidth: 0, gap: 6 },
  label: { lineHeight: 18 },
  box: {
    height: Size.inputCompact,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.hairline,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: { flex: 1, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
