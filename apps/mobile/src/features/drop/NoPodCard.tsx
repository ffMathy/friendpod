import { RADII_KM, type Prefs, type UnmatchedReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { EmptyState, ErrorText, Text } from '@/components/ui';
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

/**
 * "No pod for you this week" (drop-none; §3.2, §6.7): the server's reason, and tips that often help. The reason
 * names a setting only when the server sends a setting code, which it does after 3 drops with the same cause; then
 * the first tip opens that setting.
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
  const body = [reason ? t(`unmatched.${reason}`) : t('home.noPodBody'), pool ? t('home.priorityNext') : null].filter(Boolean).join(' ');

  // The distance tip leads when the distance is the named cause.
  const distance =
    !onlyInterests && nextKm !== undefined ? (
      <TipRow testID="tip-distance" label={t('home.tryKm', { km: nextKm })} onPress={() => router.push('/settings/preferences')} />
    ) : null;

  const toggleOpen = (value: boolean) => {
    setOpenToAnyone(value);
    update.mutate({ prefs: { openToAnyone: value } }, { onError: () => setOpenToAnyone(!value) });
  };

  return (
    <EmptyState title={t('home.noPodTitle')}>
      {/* The body is drawn here rather than by EmptyState so it keeps the storyboard's unrounded 22.5 px lines. */}
      <Text variant="body" color="textSecondary" style={styles.body}>
        {body}
      </Text>
      {tips ? (
        <View style={styles.help}>
          <Text accessibilityRole="header" variant="smallBold">
            {t('home.helpTitle')}
          </Text>
          {isUserSettingReason(reason) && (reason !== 'RADIUS' || distance === null) ? (
            <TipRow testID="tip-preferences" label={t(`home.changeSetting.${reason}`)} onPress={() => router.push('/settings/preferences')} />
          ) : null}
          {reason === 'RADIUS' ? distance : null}
          <TipRow testID="tip-interests" label={t('home.moreInterests')} onPress={() => router.push('/interests')} />
          {reason === 'RADIUS' ? null : distance}
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
    </EmptyState>
  );
}

const styles = StyleSheet.create({
  body: { lineHeight: 22.5 },
  help: { gap: 10 },
});
