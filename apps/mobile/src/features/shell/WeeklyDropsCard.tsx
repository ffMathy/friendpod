import { nextDropWeek, parseWeekId, type SetParticipationMode, type UserDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Button, Card, ChipRow, ChoiceChip, ErrorText, Icon, SectionHeader, Text, type IconName } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { dropParticipation } from '@/features/drop/participation';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** The standing modes: every week, or only the drops the user opts in to. */
const MODES = ['auto', 'manual'] as const;

/**
 * "Weekly drops" on Me (§10.1 setParticipation). The line on top says what holds for the next drop, in Home's words.
 * The standing mode is a choice of two chips (every week / when I opt in); the one-off actions sit under it as
 * drop-home's outline pills with Home's labels: "Skip this week" (or the way back in) and "Pause matching". An
 * automated pause can't be lifted here (the server refuses), so then the chips are disabled and no action shows.
 */
export function WeeklyDropsCard({ user, now }: { readonly user: Pick<UserDoc, 'status' | 'participation'>; readonly now: number }) {
  const { t } = useTranslation();
  const p = usePalette();
  const participation = useCallable('setParticipation');
  const state = dropParticipation(user, nextDropWeek(now), now);
  const mode = user.participation.mode;
  const locked = state.kind === 'paused' && !state.liftable;
  const busy = (m: SetParticipationMode) => participation.isPending && participation.variables.mode === m;
  const set = (m: SetParticipationMode) => () => participation.mutate({ mode: m });
  const status: { icon: IconName; text: string } =
    state.kind === 'in'
      ? { icon: 'check', text: t('home.youreIn') }
      : state.kind === 'skipping'
        ? { icon: 'pause', text: t('home.skipping') }
        : state.kind === 'notIn'
          ? { icon: 'info', text: t('home.notIn') }
          : { icon: 'pause', text: state.until ? t('home.pausedUntil', { when: formatDateTime(state.until, currentLocale()) }) : t('home.paused') };
  const effective = participation.data?.effectiveWeekId;
  return (
    <Card gap={12} testID="weekly-drops">
      <SectionHeader title={t('me.participation')} />
      <View style={styles.status}>
        <Icon name={status.icon} size={18} color={state.kind === 'in' ? p.primary : p.textMuted} />
        <Text variant="small" color="textSecondary" style={styles.flex}>
          {status.text}
        </Text>
      </View>
      <ChipRow>
        {MODES.map((m) => (
          <ChoiceChip
            key={m}
            testID={`mode-${m}`}
            size="sm"
            label={t(`me.modes.${m}`)}
            selected={mode === m}
            disabled={locked}
            onPress={set(m)}
          />
        ))}
      </ChipRow>
      {locked ? null : (
        <View style={styles.actions}>
          {state.kind === 'in' ? (
            <Button testID="skip-week" label={t('home.skip')} variant="outline" size="sm" grow={1} busy={busy('skipNext')} onPress={set('skipNext')} />
          ) : (
            <Button
              testID="join-week"
              label={state.kind === 'paused' ? t('home.resume') : t('home.join')}
              variant="outline"
              size="sm"
              grow={1}
              busy={busy(mode)}
              onPress={set(mode)}
            />
          )}
          {state.kind === 'paused' ? null : (
            <Button testID="pause-matching" label={t('home.pause')} variant="outline" size="sm" grow={1} busy={busy('pause')} onPress={set('pause')} />
          )}
        </View>
      )}
      {effective !== undefined ? (
        <Text variant="caption" color="textMuted">
          {t('me.effectiveFrom', { week: parseWeekId(effective).week })}
        </Text>
      ) : null}
      {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
