import type { AttendanceStatus } from '@friendpod/core';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { ErrorText, Note, StatusText } from '@/components/ui';
import { BorderWidth, usePalette } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { CardButton, NextStepCard } from './parts';

export interface AttendanceCardProps {
  readonly podId: string;
  /** "tomorrow at 14:00", for the question on the next-step card. */
  readonly when: string;
  readonly mine: AttendanceStatus | null;
  /**
   * `true`: the "Next step" card, "Still coming tomorrow at 14:00?" (D13, pod-scheduled).
   * `false`: the line at the foot of the Plan card, once answered or before the first ask: calm once the viewer has
   * answered, a needs-you note while their own answer is still missing (decision 2).
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
    // The pair shares the row 1.4 : 1, as on the storyboard.
    return (
      <>
        <NextStepCard title={t('attendance.stillComing', { when })} testID="attendance-ask">
          <CardButton
            testID="attendance-coming"
            variant="primary"
            grow={1.4}
            fit="content"
            label={t('attendance.yesComing')}
            busy={comingBusy}
            disabled={confirm.isPending}
            onPress={() => confirm.mutate({ podId, coming: true })}
          />
          <CardButton testID="attendance-cant" fit="content" label={t('attendance.cantMakeIt')} busy={cantBusy} disabled={confirm.isPending} onPress={cantMakeIt} />
        </NextStepCard>
        {error}
      </>
    );
  }

  const pending = mine !== 'coming' && mine !== 'notComing';
  const buttons = (
    // In the note the pair takes the note's full width (its actions row wraps, so it is stretched explicitly).
    <View style={[styles.buttons, pending ? styles.fill : null]}>
      {mine !== 'coming' ? (
        <CardButton
          testID="attendance-coming"
          variant="primary"
          height={44}
          label={mine === 'notComing' ? t('attendance.comingAfterAll') : t('attendance.coming')}
          busy={comingBusy}
          disabled={confirm.isPending}
          onPress={() => confirm.mutate({ podId, coming: true })}
        />
      ) : null}
      {mine !== 'notComing' ? (
        <CardButton testID="attendance-cant" height={44} label={t('attendance.cantMakeIt')} busy={cantBusy} disabled={confirm.isPending} onPress={cantMakeIt} />
      ) : null}
    </View>
  );

  // The viewer's own answer is still missing ("You haven't said if you're coming yet."): it is theirs to give, so it is
  // a needs-you note (the Solsikke marker with its Ink ring, on Paper inside the white card), its two answers under it.
  if (pending) {
    return (
      <View style={styles.ask} testID="attendance-needs-you">
        <Note tone="needsYou" icon="clock" onCard actions={buttons}>
          {t(`attendance.mine.${mine ?? 'pending'}`)}
        </Note>
        {error}
      </View>
    );
  }

  return (
    <View style={[styles.line, { borderTopColor: p.separator }]}>
      <StatusText icon={mine === 'coming' ? 'check' : 'close'} label={t(`attendance.mine.${mine}`)} />
      {buttons}
      {error}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { borderTopWidth: BorderWidth.hairline, marginTop: 8, paddingTop: 12, gap: 10 },
  ask: { marginTop: 8, gap: 10 },
  buttons: { flexDirection: 'row', gap: 8 },
  fill: { flexGrow: 1, flexBasis: '100%' },
});
