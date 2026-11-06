import type { AttendanceStatus } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { Fonts, usePalette } from '@/components/theme';
import { AppText, Button, ErrorText, Icon } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { NextStepCard } from './NextStepCard';

export interface AttendanceCardProps {
  readonly podId: string;
  readonly when: string;
  readonly mine: AttendanceStatus | null;
  /**
   * The primary "Still coming?" card (D13; the dark next-step card of storyboard 3.4) rather than the calm line that
   * sits inside the Plan card once the viewer has answered.
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
  const comingLabel = mine === 'notComing' ? t('attendance.comingAfterAll') : ask ? t('attendance.yesComing') : t('attendance.coming');
  const error = confirm.error ? <ErrorText>{t(errorMessageKey(confirm.error))}</ErrorText> : null;

  if (ask) {
    return (
      <NextStepCard
        label={t('pod.next.label')}
        title={t('attendance.stillComing', { when })}
        actions={
          <>
            {mine !== 'coming' ? (
              <Button
                testID="attendance-coming"
                label={comingLabel}
                variant="onDark"
                size="md"
                flex={1.4}
                busy={confirm.isPending && confirm.variables.coming}
                onPress={() => confirm.mutate({ podId, coming: true })}
              />
            ) : null}
            {mine !== 'notComing' ? (
              <Button
                testID="attendance-cant"
                label={t('attendance.cantMakeIt')}
                variant="outlineOnDark"
                size="md"
                flex={1}
                busy={confirm.isPending && !confirm.variables.coming}
                onPress={cantMakeIt}
              />
            ) : null}
          </>
        }
      >
        <AppText variant="caption" tone="muted">
          {t('attendance.why')}
        </AppText>
        {error}
      </NextStepCard>
    );
  }

  // The calm line inside the Plan card: where the viewer stands, and the one change they can still make.
  const status = mine ?? 'pending';
  const icon = status === 'coming' ? 'check' : status === 'notComing' ? 'close' : 'clock';
  const iconColor = status === 'coming' ? p.primary : status === 'notComing' ? p.muted : p.amberText;
  return (
    <View style={styles.calm}>
      <View style={styles.statusRow}>
        <Icon name={icon} size={18} color={iconColor} strokeWidth={2.4} style={styles.statusIcon} />
        <AppText variant="bodySm" style={[Fonts.semibold, styles.flexShrink]}>
          {t(`attendance.mine.${status}`)}
        </AppText>
      </View>
      <View style={styles.buttons}>
        {mine !== 'coming' ? (
          <Button
            testID="attendance-coming"
            label={comingLabel}
            variant="accent"
            size="sm"
            inline
            busy={confirm.isPending && confirm.variables.coming}
            onPress={() => confirm.mutate({ podId, coming: true })}
          />
        ) : null}
        {mine !== 'notComing' ? (
          <Button
            testID="attendance-cant"
            label={t('attendance.cantMakeIt')}
            variant="secondary"
            size="sm"
            inline
            busy={confirm.isPending && !confirm.variables.coming}
            onPress={cantMakeIt}
          />
        ) : null}
      </View>
      {error}
    </View>
  );
}

const styles = StyleSheet.create({
  calm: { gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statusIcon: { marginTop: 1 },
  flexShrink: { flexShrink: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
