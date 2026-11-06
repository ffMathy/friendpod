import type { AttendanceStatus } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button, ErrorText, Text } from '@/components/ui';
import { Radius, Size, usePalette } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { NextStepCard } from './parts';

export interface AttendanceCardProps {
  readonly podId: string;
  /** "tomorrow at 14:00", for the question on the next-step card. */
  readonly when: string;
  readonly mine: AttendanceStatus | null;
  /**
   * `true`: the dark "Next step" card, "Still coming tomorrow at 14:00?" (D13, pod-scheduled).
   * `false`: the calm line at the foot of the Plan card, once answered or before the first ask.
   */
  readonly ask: boolean;
}

/**
 * "Still coming?" and "Can't make it" (D5, D14): both call confirmAttendance. A yes vote for the winning option
 * already counts as coming; not answering is never a no-show, but an unconfirmed member is not counted as coming.
 */
export function AttendanceCard({ podId, when, mine, ask }: AttendanceCardProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const confirm = useCallable('confirmAttendance');
  const cantMakeIt = () =>
    Alert.alert(t('attendance.cantMakeItTitle'), t('attendance.cantMakeItBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('attendance.cantMakeIt'), style: 'destructive', onPress: () => confirm.mutate({ podId, coming: false }) },
    ]);
  const error = confirm.error ? <ErrorText>{t(errorMessageKey(confirm.error))}</ErrorText> : null;
  const comingBusy = confirm.isPending && confirm.variables.coming;
  const cantBusy = confirm.isPending && !confirm.variables.coming;

  if (ask) {
    return (
      <>
        <NextStepCard title={t('attendance.stillComing', { when })} testID="attendance-ask">
          <YesButton testID="attendance-coming" label={t('attendance.yesComing')} busy={comingBusy} disabled={confirm.isPending} onPress={() => confirm.mutate({ podId, coming: true })} />
          <Button testID="attendance-cant" label={t('attendance.cantMakeIt')} variant="outlineOnDark" size="md" grow={1} busy={cantBusy} onPress={cantMakeIt} style={styles.pairPadding} />
        </NextStepCard>
        {error}
      </>
    );
  }

  return (
    <View style={[styles.line, { borderTopColor: p.separator }]}>
      <Text variant="smallStrong" color={mine === 'coming' ? 'primary' : 'textSecondary'}>
        {t(`attendance.mine.${mine ?? 'pending'}`)}
      </Text>
      <View style={styles.buttons}>
        {mine !== 'coming' ? (
          <Button
            testID="attendance-coming"
            label={mine === 'notComing' ? t('attendance.comingAfterAll') : t('attendance.coming')}
            size="xs"
            busy={comingBusy}
            onPress={() => confirm.mutate({ podId, coming: true })}
          />
        ) : null}
        {mine !== 'notComing' ? (
          <Button testID="attendance-cant" label={t('attendance.cantMakeIt')} variant="outline" size="xs" busy={cantBusy} onPress={cantMakeIt} />
        ) : null}
      </View>
      {error}
    </View>
  );
}

/**
 * The white 48 px "Yes, I'm coming" on the dark card, in 15/800 (the outline "Can't make it" beside it is 15/700).
 * The pair shares the row 1.4 : 1 from their label widths plus 6 px a side, as the storyboard's buttons do.
 */
function YesButton({ label, busy, disabled, onPress, testID }: { label: string; busy: boolean; disabled: boolean; onPress: () => void; testID: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.yes, { backgroundColor: p.onHero, opacity: pressed ? 0.85 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator color={p.hero} />
      ) : (
        <Text variant="heading" weight="800" color="hero" numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  yes: { flexGrow: 1.4, flexShrink: 1, flexBasis: 'auto', minHeight: Size.buttonMedium, paddingHorizontal: 6, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  pairPadding: { paddingHorizontal: 6 },
  line: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
