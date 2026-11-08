import { dropSchedule, nextDropWeek, parseWeekId, type UserDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, Card, ErrorText, Icon, Text, type IconName } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { dropParticipation } from './participation';
import { capitalize, clock, countdown, weekday } from './time';

/**
 * Before the drop (drop-home): the dark "Next drop" card with the release time and a countdown, whether the viewer is
 * in, and "Skip this week" / "Pause matching" (or the way back in). Both apply at once (§3.2, §10.1 setParticipation).
 */
export function NextDropCard({ user, now }: { user: Pick<UserDoc, 'status' | 'participation'>; now: number }) {
  const { t } = useTranslation();
  const p = usePalette();
  const locale = currentLocale();
  const participation = useCallable('setParticipation');
  const dropWeek = nextDropWeek(now);
  const releaseAt = dropSchedule(dropWeek).releaseAt;
  const state = dropParticipation(user, dropWeek, now);
  const mode = user.participation.mode;
  const busy = (m: string) => participation.isPending && participation.variables.mode === m;
  // An opt-in after Thursday 12:00 counts from next week's drop.
  const effective = participation.data?.effectiveWeekId;
  const later = effective !== undefined && effective !== dropWeek && participation.variables?.mode === mode ? parseWeekId(effective).week : null;

  const status: { icon: IconName; text: string } =
    state.kind === 'in'
      ? { icon: 'check', text: t('home.youreIn') }
      : state.kind === 'skipping'
        ? { icon: 'pause', text: t('home.skipping') }
        : state.kind === 'notIn'
          ? { icon: 'info', text: t('home.notIn') }
          : { icon: 'pause', text: state.until ? t('home.pausedUntil', { when: formatDateTime(state.until, locale) }) : t('home.paused') };

  return (
    <>
      <Card radius={24} gap={16} testID="next-drop">
        <Badge tone="status" label={t('home.nextDrop')} />
        <View style={styles.when}>
          <Text variant="countdown" color="text" style={styles.countdown}>
            {t('home.dropAt', { day: capitalize(weekday(releaseAt, locale)), time: clock(releaseAt, locale) })}
          </Text>
          <Text variant="body" color="textMuted" style={styles.natural15}>
            {countdown(t, now, releaseAt)}
          </Text>
        </View>
        <View style={styles.status}>
          <Icon name={status.icon} size={18} color={p.textSecondary} />
          <Text variant="small" color="textSecondary" style={[styles.flex, styles.natural14]}>
            {status.text}
          </Text>
        </View>
      </Card>

      {state.kind === 'paused' && !state.liftable ? null : (
        <View style={styles.actions}>
          {state.kind === 'in' ? (
            <Button
              testID="skip-week"
              label={t('home.skip')}
              variant="outline"
              size="sm"
              grow={1}
              busy={busy('skipNext')}
              onPress={() => participation.mutate({ mode: 'skipNext' })}
            />
          ) : (
            <Button
              testID="join-week"
              label={state.kind === 'paused' ? t('home.resume') : t('home.join')}
              variant="outline"
              size="sm"
              grow={1}
              busy={busy(mode)}
              onPress={() => participation.mutate({ mode })}
            />
          )}
          {state.kind === 'paused' ? null : (
            <Button
              testID="pause-matching"
              label={t('home.pause')}
              variant="outline"
              size="sm"
              grow={1}
              busy={busy('pause')}
              onPress={() => participation.mutate({ mode: 'pause' })}
            />
          )}
        </View>
      )}
      {later !== null ? (
        <Text variant="caption" color="textMuted">
          {t('home.fromWeek', { week: later })}
        </Text>
      ) : null}
      {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  when: { gap: 4 },
  // The card's lines sit at the font's natural line height (1.26), as on the storyboard, which sets none.
  countdown: { lineHeight: 40 },
  natural15: { lineHeight: 19 },
  natural14: { lineHeight: 18 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
