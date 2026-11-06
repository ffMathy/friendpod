import { DAY_MS, DROP_TIME_ZONE, fromLocal, toLocal, type Locale } from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius, Sizes, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Grabber, Icon, IconButton, type IconName } from '@/components/ui';
import { OPTION_WINDOW_DAYS } from './optionForm';

/** Times on offer, every quarter of an hour from 08:00 to 22:00 (§3.5). */
const FIRST_MINUTE = 8 * 60;
const LAST_MINUTE = 22 * 60;
const STEP_MINUTES = 15;
const TIME_COLUMNS = 4;
const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const SLOTS = Array.from({ length: (LAST_MINUTE - FIRST_MINUTE) / STEP_MINUTES + 1 }, (_, i) => hhmm(FIRST_MINUTE + i * STEP_MINUTES));

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function startsAt(ymd: string, time: string): number | null {
  const d = parseYmd(ymd);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  return d && tm ? fromLocal({ ...d, hour: Number(tm[1]), minute: Number(tm[2]) }) : null;
}

/** Whether a time on a day is one the planner accepts: after now, within 14 days (`validateOptionForm`). */
function inWindow(ymd: string, time: string, now: number): boolean {
  const at = startsAt(ymd, time);
  return at !== null && at > now && at <= now + OPTION_WINDOW_DAYS * DAY_MS;
}

/** The times on offer for a day (all of them while no day is picked). */
export function timeChoices(ymd: string, now: number): readonly string[] {
  return ymd ? SLOTS.filter((time) => inWindow(ymd, time, now)) : SLOTS;
}

/** The days (Copenhagen time, as YYYY-MM-DD) that still have a time on offer. */
export function dayChoices(now: number): readonly string[] {
  const today = toLocal(now);
  const days: string[] = [];
  // Calendar arithmetic, not 24-hour steps, so a daylight-saving change never skips a day.
  for (let i = 0; i <= OPTION_WINDOW_DAYS; i++) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    if (timeChoices(ymd, now).length > 0) days.push(ymd);
  }
  return days;
}

/** "Mon 16 Nov" / "man. 16. nov.", the weekday and date in the app's time zone. */
export function formatDay(ymd: string, locale: Locale): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: 'short', day: 'numeric', month: 'short', timeZone: DROP_TIME_ZONE }).format(
    new Date(fromLocal({ ...d, hour: 12, minute: 0 })),
  );
}

export interface OptionWhenProps {
  /** YYYY-MM-DD, or '' before a day is picked. */
  readonly date: string;
  /** HH:MM, or '' before a time is picked. */
  readonly time: string;
  readonly onDate: (ymd: string) => void;
  readonly onTime: (time: string) => void;
  readonly locale: Locale;
}

/**
 * Day and Time of a meetup option (storyboard 3.3): two picker fields side by side, with a calendar and a clock
 * icon and the value in the viewer's language. Each opens a sheet with only the choices the planner accepts (§3.5:
 * within 14 days, 08:00–22:00, quarter hours), so nothing is typed. The values stay YYYY-MM-DD and HH:MM for
 * `validateOptionForm`, which the server mirrors.
 */
export function OptionWhen({ date, time, onDate, onTime, locale }: OptionWhenProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'day' | 'time' | null>(null);
  // Choices are worked out when a sheet opens, so a screen left open does not offer times that have passed.
  const [now, setNow] = useState(() => Date.now());
  const show = (sheet: 'day' | 'time') => {
    setNow(Date.now());
    setOpen(sheet);
  };
  const close = () => setOpen(null);

  const pickDay = (ymd: string) => {
    onDate(ymd);
    // A time the new day does not offer (already past today) is cleared rather than kept invalid.
    if (time && !timeChoices(ymd, Date.now()).includes(time)) onTime('');
    close();
  };
  const pickTime = (slot: string) => {
    onTime(slot);
    close();
  };

  return (
    <View style={styles.row}>
      <PickerField
        testID="option-date"
        label={t('plan.day')}
        value={date ? formatDay(date, locale) : ''}
        placeholder={t('plan.dayPick')}
        icon="calendar"
        active={open === 'day'}
        onPress={() => show('day')}
      />
      <PickerField
        testID="option-time"
        label={t('plan.time')}
        value={time}
        placeholder={t('plan.timePick')}
        icon="clock"
        active={open === 'time'}
        onPress={() => show('time')}
      />
      <ChoiceSheet visible={open !== null} title={open === 'time' ? t('plan.time') : t('plan.day')} onClose={close}>
        {open === 'day' ? <DayList days={dayChoices(now)} value={date} locale={locale} onPick={pickDay} /> : null}
        {open === 'time' ? <TimeGrid times={timeChoices(date, now)} value={time} onPick={pickTime} /> : null}
      </ChoiceSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------

interface PickerFieldProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly icon: IconName;
  /** Its sheet is open: the 2-pt green border a focused field has. */
  readonly active: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}

/** A field that opens a picker: the Field look (label, white 14-radius box) with a trailing icon. */
function PickerField({ label, value, placeholder, icon, active, onPress, testID }: PickerFieldProps) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[Type.section, { color: p.ink }]}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          {
            backgroundColor: pressed ? p.subtle : p.surface,
            borderColor: active ? p.primary : p.borderStrong,
            borderWidth: active ? 2 : 1,
            paddingLeft: Spacing.ms - (active ? 1 : 0),
            paddingRight: Spacing.ms - (active ? 1 : 0),
          },
        ]}
      >
        <Text numberOfLines={1} style={[Type.body, styles.flexShrink, { color: value ? p.ink : p.muted }]}>
          {value || placeholder}
        </Text>
        <Icon name={icon} size={20} color={p.muted} />
      </Pressable>
    </View>
  );
}

/** A bottom sheet over a dimmed screen, closed by its × button, the backdrop or the back button. */
function ChoiceSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable accessible={false} style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <Grabber />
          <View style={styles.sheetHeader}>
            <AppText accessibilityRole="header" variant="titleSm" style={styles.flexShrink}>
              {title}
            </AppText>
            <IconButton icon="close" label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DayList({ days, value, locale, onPick }: { days: readonly string[]; value: string; locale: Locale; onPick: (ymd: string) => void }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={[styles.list, { borderColor: p.border }]}>
      {days.map((ymd, i) => {
        const selected = ymd === value;
        return (
          <Pressable
            key={ymd}
            testID={`day-${ymd}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onPick(ymd)}
            style={({ pressed }) => [
              styles.dayRow,
              { backgroundColor: selected ? p.mint : pressed ? p.subtle : p.surface },
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
            ]}
          >
            <Text style={[Type.bodyMd, selected ? Fonts.bold : Fonts.semibold, styles.flexShrink, { color: p.ink }]}>{formatDay(ymd, locale)}</Text>
            {selected ? <Icon name="check" size={18} color={p.primary} strokeWidth={2.6} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function TimeGrid({ times, value, onPick }: { times: readonly string[]; value: string; onPick: (time: string) => void }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const chip = Math.floor((width - 2 * Spacing.gutter - (TIME_COLUMNS - 1) * Spacing.sm) / TIME_COLUMNS);
  return (
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {times.map((slot) => {
        const selected = slot === value;
        return (
          <Pressable
            key={slot}
            testID={`time-${slot}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onPick(slot)}
            style={({ pressed }) => [
              styles.timeChip,
              {
                width: chip,
                backgroundColor: selected ? p.primary : pressed ? p.subtle : p.surface,
                borderColor: selected ? p.primary : p.borderStrong,
              },
            ]}
          >
            <Text style={[Type.buttonSm, { color: selected ? p.onPrimary : p.ink }]}>{slot}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  flexShrink: { flexShrink: 1 },
  box: { minHeight: Sizes.inputMd, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  modal: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: Radius.heroLg, borderTopRightRadius: Radius.heroLg, paddingTop: 10, gap: Spacing.xs },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: Spacing.gutter, paddingRight: Spacing.gutter - 10 },
  sheetBody: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xs },
  list: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  dayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  timeChip: { minHeight: Sizes.touch, borderRadius: Sizes.touch / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
