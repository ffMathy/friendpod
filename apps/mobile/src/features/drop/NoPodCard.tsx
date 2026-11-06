import { RADII_KM, type UnmatchedReason, type UserDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Fonts, Radius, usePalette } from '@/components/theme';
import { AppText, Card, ErrorText, LinkRow, SwitchRow } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { isUserSettingReason } from '@/lib/reasons';

/** Decorative: you (filled) and three empty seats on a grey panel. */
function EmptySeats() {
  const p = usePalette();
  const seat = { borderColor: p.faint };
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.panel, { backgroundColor: p.subtle }]}
    >
      <View style={[styles.you, { backgroundColor: p.ink }]} />
      <View style={[styles.seat, seat, styles.seat1]} />
      <View style={[styles.seat, seat, styles.seat2]} />
      <View style={[styles.seat, seat, styles.seat3]} />
    </View>
  );
}

/**
 * "No pod for you this week" (§3.2, storyboard 2.5): the server's reason, then things that often help. The reason names
 * a setting only when the server chose such a code (after 3 weeks with the same cause); only then does "Change
 * preferences" appear, as before. "Open to meeting anyone" writes `prefs.openToAnyone` like the preferences screen.
 */
export function NoPodCard({ user, reason }: { user: UserDoc; reason: UnmatchedReason | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useCallable('updateProfile');
  const [openToAnyone, setOpenToAnyone] = useState<boolean | null>(null);
  const nextKm = RADII_KM.find((km) => km > user.prefs.maxKm);
  const saved = user.prefs.openToAnyone;
  // Shows the new position until the live user doc catches up (or the call fails).
  useEffect(() => setOpenToAnyone(null), [saved]);
  const value = openToAnyone ?? saved;
  const setOpen = (next: boolean) => {
    setOpenToAnyone(next);
    update.mutate({ prefs: { openToAnyone: next } }, { onError: () => setOpenToAnyone(null) });
  };

  return (
    <Card radius="xl" padding={22} gap={16}>
      <EmptySeats />
      <AppText accessibilityRole="header" variant="titleSm">
        {t('home.noPodTitle')}
      </AppText>
      <AppText variant="bodyMd" tone="soft">
        {reason ? t(`unmatched.${reason}`) : t('home.noPodGeneric')}
      </AppText>
      {reason !== 'MAX_ACTIVE_PODS' ? (
        <View style={styles.helps}>
          <AppText accessibilityRole="header" variant="bodySm" style={Fonts.bold}>
            {t('home.helps')}
          </AppText>
          <LinkRow variant="card" label={t('home.addInterests')} onPress={() => router.navigate('/interests')} testID="home-add-interests" />
          {nextKm !== undefined ? (
            <LinkRow variant="card" label={t('home.tryKm', { km: nextKm })} onPress={() => router.push('/settings/preferences')} testID="home-try-km" />
          ) : null}
          {isUserSettingReason(reason) && reason !== 'RADIUS' ? (
            <LinkRow variant="card" label={t('home.openPreferences')} onPress={() => router.push('/settings/preferences')} testID="home-preferences" />
          ) : null}
          <SwitchRow
            label={t('home.openToAnyone')}
            description={t('home.openToAnyoneHint')}
            value={value}
            onChange={setOpen}
            disabled={update.isPending}
            testID="home-open-to-anyone"
          />
          {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  helps: { gap: 10 },
  panel: { height: 120, borderRadius: Radius.xl, overflow: 'hidden' },
  you: { position: 'absolute', left: '22%', top: 30, width: 56, height: 56, borderRadius: 28 },
  seat: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed' },
  seat1: { left: '47%', top: 40 },
  seat2: { left: '64%', top: 26 },
  seat3: { left: '81%', top: 52 },
});
