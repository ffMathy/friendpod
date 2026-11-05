import type { AttendanceStatus } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Body, Button, Card, ErrorText } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';

export interface AttendanceCardProps {
  readonly podId: string;
  readonly when: string;
  readonly mine: AttendanceStatus | null;
  /** The primary "Still coming?" card (D13) rather than the calm line in the Plan section. */
  readonly ask: boolean;
}

/**
 * "Still coming?" and "Can't make it" (D5, D14): both call confirmAttendance. A yes vote for the winning option
 * already counts as coming; not answering is never a no-show, but an unconfirmed member is not counted as coming.
 */
export function AttendanceCard({ podId, when, mine, ask }: AttendanceCardProps) {
  const { t } = useTranslation();
  const confirm = useCallable('confirmAttendance');
  const cantMakeIt = () =>
    Alert.alert(t('attendance.cantMakeItTitle'), t('attendance.cantMakeItBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('attendance.cantMakeIt'), style: 'destructive', onPress: () => confirm.mutate({ podId, coming: false }) },
    ]);

  return (
    <Card>
      <Body bold>{ask ? t('attendance.stillComing', { when }) : t(`attendance.mine.${mine ?? 'pending'}`)}</Body>
      {ask ? <Body muted>{t('attendance.why')}</Body> : null}
      {mine !== 'coming' ? (
        <Button
          testID="attendance-coming"
          label={mine === 'notComing' ? t('attendance.comingAfterAll') : t('attendance.coming')}
          busy={confirm.isPending && confirm.variables.coming}
          onPress={() => confirm.mutate({ podId, coming: true })}
        />
      ) : null}
      {mine !== 'notComing' ? (
        <Button
          testID="attendance-cant"
          label={t('attendance.cantMakeIt')}
          variant="secondary"
          busy={confirm.isPending && !confirm.variables.coming}
          onPress={cantMakeIt}
        />
      ) : null}
      {confirm.error ? <ErrorText>{t(errorMessageKey(confirm.error))}</ErrorText> : null}
    </Card>
  );
}
