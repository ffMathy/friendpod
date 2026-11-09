import { RADII_KM, type Prefs, type UnmatchedReason } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, ErrorText, Headline, Seat, StatusText, Text } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { isUserSettingReason } from '@/lib/reasons';
import { TipRow, TipSwitch } from './parts';

/** Reasons where the viewer stayed in the pool: they wait on, so next week they get priority. */
const POOL_REASONS: ReadonlySet<UnmatchedReason> = new Set<UnmatchedReason>([
  'NO_THEME_BUCKET',
  'RADIUS',
  'AGE',
  'GENDER',
  'GENDER_POOL',
  'LANGUAGE',
  'AVAILABILITY',
  'SENSITIVE_ELIGIBILITY',
  'SENSITIVE_DENSITY',
  'NO_FIT_THIS_WEEK',
]);

/** Reasons the tips cannot help with (another area, or already two active pods). */
const NO_TIPS: ReadonlySet<UnmatchedReason> = new Set<UnmatchedReason>(['MAX_ACTIVE_PODS', 'AREA_WAITLIST', 'OUTSIDE_AREAS']);

/** You and three open seats on Paper, set at different heights: calm, no colour (drop-none is not a poster moment). */
function NoPodArt() {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.art, { backgroundColor: p.inset }]}>
      <View style={styles.you}>
        <Seat kind="you" youLabel={t('common.you')} />
      </View>
      {OPEN_SEAT_OFFSETS.map((offset, i) => (
        <View key={i} style={{ marginTop: offset }}>
          <Seat kind="open" />
        </View>
      ))}
    </View>
  );
}

/** How far each open seat sits off the middle line, as drawn. */
const OPEN_SEAT_OFFSETS = [14, -18, 18] as const;

/**
 * "No pod for you this week" (drop-none; §3.2, §6.7): a calm white card with the art, the server's reason, whether the
 * viewer gets priority next week (a quiet status: nothing to do), and tips that often help as link rows, ending with the
 * open-to-anyone switch. The reason names a setting only when the server sends a setting code, which it does after 3
 * drops with the same cause; then the first tip opens that setting.
 */
export function NoPodCard({ reason, prefs }: { reason: UnmatchedReason | undefined; prefs: Prefs }) {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useCallable('updateProfile');
  // Shown at once; the user doc follows when the server has saved it.
  const [openToAnyone, setOpenToAnyone] = useState(prefs.openToAnyone);
  const nextKm = RADII_KM.find((km) => km > prefs.maxKm);
  const pool = reason === undefined || POOL_REASONS.has(reason);
  const tips = reason === undefined || !NO_TIPS.has(reason);
  const onlyInterests = reason === 'TOO_FEW_INTERESTS';

  const toggleOpen = (value: boolean) => {
    setOpenToAnyone(value);
    update.mutate({ prefs: { openToAnyone: value } }, { onError: () => setOpenToAnyone(!value) });
  };
  const openPreferences = () => router.push('/settings/preferences');

  // The tip rows in order: a named setting leads (the distance tip when the distance is the cause), then interests and
  // distance; each but the last has a Divider under it.
  const rows: { key: string; label: string; onPress: () => void }[] = [];
  const distance =
    !onlyInterests && nextKm !== undefined
      ? {
          key: 'tip-distance',
          label: t('home.tryKm', { km: nextKm }),
          onPress: openPreferences,
        }
      : null;
  if (isUserSettingReason(reason) && (reason !== 'RADIUS' || distance === null)) {
    rows.push({
      key: 'tip-preferences',
      label: t(`home.changeSetting.${reason}`),
      onPress: openPreferences,
    });
  }
  if (reason === 'RADIUS' && distance) rows.push(distance);
  rows.push({
    key: 'tip-interests',
    label: t('home.moreInterests'),
    onPress: () => router.push('/interests'),
  });
  if (reason !== 'RADIUS' && distance) rows.push(distance);
  const tipRows: ReactElement[] = rows.map((r, i) => (
    <TipRow key={r.key} testID={r.key} label={r.label} onPress={r.onPress} last={onlyInterests && i === rows.length - 1} />
  ));

  return (
    <Card gap={12} testID="no-pod">
      <NoPodArt />
      <View style={styles.text}>
        <Headline>{t('home.noPodTitle')}</Headline>
        <Text variant="bodySmall" color="textSecondary">
          {reason ? t(`unmatched.${reason}`) : t('home.noPodBody')}
        </Text>
        {pool ? <StatusText icon="check" label={t('home.priorityNext')} /> : null}
      </View>
      {tips ? (
        <View style={styles.help}>
          <Text accessibilityRole="header" variant="heading">
            {t('home.helpTitle')}
          </Text>
          {tipRows}
          {!onlyInterests ? (
            <TipSwitch
              testID="tip-open-to-anyone"
              label={t('home.openToAnyone')}
              description={t('home.openToAnyoneHint')}
              value={openToAnyone}
              disabled={update.isPending}
              onChange={toggleOpen}
            />
          ) : null}
          {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  art: {
    height: 104,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  you: { marginTop: -10 },
  text: { gap: 8 },
  help: { gap: 2 },
});
