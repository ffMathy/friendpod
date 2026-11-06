import { dropSchedule, nextDropWeek, type SetParticipationMode, type UserDoc } from '@grouper/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Radius, Type, tightLine, usePalette } from '@/components/theme';
import { AppText, Button, Card, ErrorText, Icon, Pill, type IconName } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { capitalize, countdown, formatWeekdayTime } from './format';
import { dropParticipation, type DropParticipation } from './participation';

export interface NextDropCardProps {
  readonly user: UserDoc;
  readonly now: number;
  /** The user already has the most active pods a drop allows, so the drop leaves them out (MAX_ACTIVE_PODS). */
  readonly full?: boolean;
}

function statusLine(t: TFunction, s: DropParticipation, full: boolean): { text: string; icon: IconName } | null {
  switch (s.kind) {
    case 'unavailable':
      return null;
    case 'paused':
      return { text: t('home.participation.paused'), icon: 'pause' };
    case 'skipping':
      return { text: t('home.participation.skipping'), icon: 'pause' };
    case 'notJoined':
      return { text: t('home.participation.notJoined'), icon: 'info' };
    case 'in':
      return full ? { text: t('unmatched.MAX_ACTIVE_PODS'), icon: 'info' } : { text: t('home.participation.in'), icon: 'check' };
  }
}

/**
 * The dark "Next drop" hero (storyboard 2.1): "Thursday 18:00, in 2 days and 6 hours", whether the user is in it, and
 * one-tap Skip this week / Pause matching through `setParticipation`, the same call as Me → Weekly drops. It leads This
 * week whether or not the user already has a pod.
 */
export function NextDropCard({ user, now, full = false }: NextDropCardProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const participation = useCallable('setParticipation');
  const locale = currentLocale();
  const releaseAt = dropSchedule(nextDropWeek(now)).releaseAt;
  const status = dropParticipation(user, now);
  const line = statusLine(t, status, full);
  const set = (mode: SetParticipationMode) => participation.mutate({ mode });

  const actions: { label: string; mode: SetParticipationMode; testID: string }[] = [];
  if (status.kind === 'in') actions.push({ label: t('home.skipWeek'), mode: 'skipNext', testID: 'home-skip' });
  if (status.kind === 'skipping' && status.canUndo) actions.push({ label: t('home.undoSkip'), mode: 'auto', testID: 'home-undo-skip' });
  if (status.kind === 'notJoined' && status.canJoin) actions.push({ label: t('home.joinWeek'), mode: 'manual', testID: 'home-join' });
  if (status.kind === 'in' || status.kind === 'skipping' || status.kind === 'notJoined') {
    actions.push({ label: t('home.pause'), mode: 'pause', testID: 'home-pause' });
  }
  if (status.kind === 'paused' && status.canResume) actions.push({ label: t('home.resume'), mode: user.participation.mode, testID: 'home-resume' });

  return (
    <View style={styles.block}>
      <Card tone="night" padding={22} gap={16} style={styles.hero}>
        <Pill tone="amber" label={t('home.nextDropPill')} />
        <View style={styles.when}>
          <AppText accessibilityRole="header" variant="title" style={styles.time}>
            {capitalize(formatWeekdayTime(releaseAt, locale, 'long'))}
          </AppText>
          <AppText variant="bodyMd" tone="muted">
            {countdown(t, releaseAt, now)}
          </AppText>
        </View>
        {line ? (
          <View style={styles.status}>
            <Icon name={line.icon} size={18} color={p.nightSoft} />
            <AppText variant="bodySm" tone="soft" style={styles.flex}>
              {line.text}
            </AppText>
          </View>
        ) : null}
      </Card>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button
              key={a.mode}
              testID={a.testID}
              label={a.label}
              variant="secondary"
              size="sm"
              flex={1}
              disabled={participation.isPending}
              onPress={() => set(a.mode)}
            />
          ))}
        </View>
      ) : null}
      {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  hero: { borderRadius: Radius.hero },
  when: { gap: 4 },
  // Storyboard 2.1's 32/37 time: its own glyph room, since Type.title's is sized for 30/35.
  time: { ...Type.title, ...tightLine(32, 37) },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
});
