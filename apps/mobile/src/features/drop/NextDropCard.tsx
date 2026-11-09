import { dropSchedule, nextDropWeek, parseWeekId, type UserDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, ErrorText, Icon, PodMark, PosterField, PosterFoot, Text, useFieldColors, type IconName } from '@/components/ui';
import { fitDisplay, Layout, usePalette, type DisplayStep } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useTabTopPadding } from './layout';
import { dropParticipation } from './participation';
import { capitalize, clock, countdown, weekday } from './time';
import { useFieldStatusBar } from './useFieldStatusBar';

type Participant = Pick<UserDoc, 'status' | 'participation'>;

/** The poster mark on the drop field (spec §8: 128 px, the saved seat dashed). */
const MARK = 128;

/**
 * Before the drop (drop-home): the ritual's poster field (spec §8). The house field (Skov) runs full-bleed from the
 * top edge: "This week" and the white "Week 46" pill, "Next drop" over "Thursday 18:00" in display type, and the poster
 * mark with the seat saved for you. Every smaller text sits on the white foot that overlaps the field: the countdown
 * and whether the viewer is in, with a chevron. Everything under the title row is one link (`onPress`): drawn as the
 * way to the proposal, but before the drop there is none yet, so Home points it at what the drop is (How matching works).
 */
export function NextDropField({ title, week, user, now, onPress }: { title: string; week: string; user: Participant; now: number; onPress: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const top = useTabTopPadding();
  const { width } = useWindowDimensions();
  const field = useFieldColors();
  useFieldStatusBar();
  const locale = currentLocale();
  const dropWeek = nextDropWeek(now);
  const releaseAt = dropSchedule(dropWeek).releaseAt;
  const state = dropParticipation(user, dropWeek, now);
  const when = t('home.dropAt', {
    day: capitalize(weekday(releaseAt, locale)),
    time: clock(releaseAt, locale),
  });
  // Display XL 48 as drawn, smaller only when the words would not fit beside the mark (narrow phones, large text).
  const fit = fitDisplay(when, width - 2 * Layout.gutterCompact - MARK - 8);
  const step: DisplayStep = fit === 'displayXL' || fit === 'displayXL52' ? 'displayXL48' : fit;

  const status: { icon: IconName; text: string } =
    state.kind === 'in'
      ? { icon: 'check', text: t('home.youreIn') }
      : state.kind === 'skipping'
        ? { icon: 'pause', text: t('home.skipping') }
        : state.kind === 'notIn'
          ? { icon: 'info', text: t('home.notIn') }
          : {
              icon: 'pause',
              text: state.until
                ? t('home.pausedUntil', {
                    when: formatDateTime(state.until, locale),
                  })
                : t('home.paused'),
            };

  const inWords = countdown(t, now, releaseAt);

  return (
    <View testID="next-drop">
      {/* The title row stays outside the link: "This week" is the page's header. */}
      <PosterField paddingBottom={0} style={{ paddingTop: insets.top + top }}>
        <View style={styles.header}>
          <Text accessibilityRole="header" variant="title" style={[styles.shrink, { color: field.text }]}>
            {title}
          </Text>
          {/* The pill aligns itself to the top; the wrapper centres it on the title's line, as drawn. */}
          <View>
            <Badge tone="onField" label={week} />
          </View>
        </View>
      </PosterField>
      {/* Field and foot are one link (spec §8). Before the drop there is no pod yet, so it explains the drop. */}
      <Pressable
        testID="next-drop-link"
        accessibilityRole="link"
        accessibilityLabel={`${t('home.nextDrop')} ${when}. ${inWords}. ${status.text}`}
        accessibilityHint={t('home.dropLinkHint')}
        onPress={onPress}
      >
        {({ pressed }) => (
          <>
            <PosterField safeTop={false} style={styles.nextField}>
              <View style={styles.next}>
                <View style={styles.when}>
                  <Text variant="headline" style={{ color: field.text }}>
                    {t('home.nextDrop')}
                  </Text>
                  <Text variant={step} style={{ color: field.text }}>
                    {when}
                  </Text>
                </View>
                <View style={styles.mark}>
                  <PodMark variant="poster" ground="skov" size={MARK} />
                </View>
              </View>
            </PosterField>
            <PosterFoot style={[styles.footRow, pressed ? { backgroundColor: p.inset } : null]}>
              <View style={styles.foot}>
                <Text variant="heading">{inWords}</Text>
                <View style={styles.status}>
                  <Icon name={status.icon} size={16} strokeWidth={status.icon === 'check' ? 2.4 : undefined} color={p.textSecondary} />
                  <Text variant="small" color="textSecondary" style={styles.flex}>
                    {status.text}
                  </Text>
                </View>
              </View>
              <Icon name="chevronRight" size={20} color={p.textMuted} />
            </PosterFoot>
          </>
        )}
      </Pressable>
    </View>
  );
}

/**
 * "Skip this week" and "Pause matching", or the way back in (§3.2, §10.1 setParticipation): white secondary pills,
 * applied at once. An automated pause the user may not lift shows nothing here.
 */
export function ParticipationActions({ user, now }: { user: Participant; now: number }) {
  const { t } = useTranslation();
  const participation = useCallable('setParticipation');
  const dropWeek = nextDropWeek(now);
  const state = dropParticipation(user, dropWeek, now);
  const mode = user.participation.mode;
  const busy = (m: string) => participation.isPending && participation.variables.mode === m;
  // An opt-in after Thursday 12:00 counts from next week's drop.
  const effective = participation.data?.effectiveWeekId;
  const later = effective !== undefined && effective !== dropWeek && participation.variables?.mode === mode ? parseWeekId(effective).week : null;
  if (state.kind === 'paused' && !state.liftable) return null;
  return (
    <View style={styles.actionsBlock}>
      <View style={styles.actions}>
        {state.kind === 'in' ? (
          <Button
            testID="skip-week"
            label={t('home.skip')}
            variant="secondary"
            size="sm"
            grow={1}
            style={styles.half}
            busy={busy('skipNext')}
            onPress={() => participation.mutate({ mode: 'skipNext' })}
          />
        ) : (
          <Button
            testID="join-week"
            label={state.kind === 'paused' ? t('home.resume') : t('home.join')}
            variant="secondary"
            size="sm"
            grow={1}
            style={styles.half}
            busy={busy(mode)}
            onPress={() => participation.mutate({ mode })}
          />
        )}
        {state.kind === 'paused' ? null : (
          <Button
            testID="pause-matching"
            label={t('home.pause')}
            variant="secondary"
            size="sm"
            grow={1}
            style={styles.half}
            busy={busy('pause')}
            onPress={() => participation.mutate({ mode: 'pause' })}
          />
        )}
      </View>
      {later !== null ? (
        <Text variant="caption" color="textMuted">
          {t('home.fromWeek', { week: later })}
        </Text>
      ) : null}
      {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  when: { flexShrink: 1, gap: 4 },
  // 18 px under the title row, as drawn (the field's own top padding is for a field that starts at the top edge).
  nextField: { paddingTop: 18 },
  mark: { marginBottom: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foot: { flex: 1, gap: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionsBlock: { gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  // Equal halves (flex-basis 0, as drawn), whatever the labels' lengths.
  half: { flexBasis: 0, paddingHorizontal: 12 },
});
