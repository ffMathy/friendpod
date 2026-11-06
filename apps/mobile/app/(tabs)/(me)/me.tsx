import type { SetParticipationMode } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Card, ChipRow, ErrorText, ListGroup, Loading, Screen, ScreenHeader, Segmented, SectionTitle, TextLink, Toggle } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { PhotoCard } from '@/features/photos/PhotoCard';
import { AboutMeField } from '@/features/profile/AboutMeField';
import { useUid } from '@/features/session/SessionProvider';
import { SettingsRow } from '@/features/settings/parts';
import { currentLocale, initI18n } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { isUserSettingReason } from '@/lib/reasons';

const MODES: readonly SetParticipationMode[] = ['auto', 'manual', 'skipNext', 'pause'];
const LOCALES = ['da', 'en'] as const;

/**
 * Me (§11; the hub above storyboard 5.3): profile (photo, "About me", D4), participation, the user's own reliability
 * record, the setting that blocks matching (if any), language, and the way to preferences, privacy, notifications,
 * messages from Grouper and the transparency pages.
 */
export default function Me() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const user = useUserDoc(uid);
  const participation = useCallable('setParticipation');
  const updateProfile = useCallable('updateProfile');
  if (!user.data) return <Loading label={t('common.loading')} />;
  const u = user.data;
  const locale = currentLocale();
  const attended = u.stats.attended;
  const meetups = attended + u.stats.noShows;
  const lastReason = u.lastDrop?.outcome === 'unmatched' ? u.lastDrop.reason : undefined;
  const blocking = isUserSettingReason(lastReason) ? lastReason : null;
  const paused = u.participation.pausedUntil !== undefined || u.status === 'paused';
  const activeMode: SetParticipationMode = paused ? 'pause' : u.participation.mode;

  return (
    <Screen>
      <ScreenHeader eyebrow={t('tabs.me')} title={u.firstName} subtitle={u.area.label} subtitleIcon="pin" />

      <PhotoCard uid={uid} version={u.photo?.v ?? null} />

      <Card>
        <AboutMeField initial={u.aboutMe ?? ''} />
      </Card>

      <Card>
        <SectionTitle title={t('me.participation')} />
        <ChipRow>
          {MODES.map((mode) => (
            <Toggle key={mode} label={t(`me.modes.${mode}`)} value={activeMode === mode} onChange={() => participation.mutate({ mode })} />
          ))}
        </ChipRow>
        {participation.data ? (
          <AppText variant="caption" tone="muted">
            {t('me.effectiveFrom', { week: participation.data.effectiveWeekId })}
          </AppText>
        ) : null}
        {participation.error ? <ErrorText>{t(errorMessageKey(participation.error))}</ErrorText> : null}
      </Card>

      {blocking ? (
        <Banner tone="amber" icon="info" actions={<TextLink label={t('me.preferences')} size="sm" onPress={() => router.push('/settings/preferences')} />}>
          {t(`blockingSetting.${blocking}`)}
        </Banner>
      ) : null}

      <Card>
        <View style={styles.between}>
          <SectionTitle title={t('me.record')} />
          {meetups === 0 ? (
            <AppText variant="bodySm" tone="muted">
              {t('me.noMeetupsYet')}
            </AppText>
          ) : (
            <AppText variant="headingSm">{t('me.attended', { attended, total: meetups })}</AppText>
          )}
        </View>
      </Card>

      <Card>
        <SectionTitle title={t('me.language')} />
        <Segmented
          variant="track"
          options={LOCALES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
          value={locale}
          onChange={(l) => updateProfile.mutate({ locale: l }, { onSuccess: () => initI18n(l) })}
        />
        {updateProfile.error ? <ErrorText>{t(errorMessageKey(updateProfile.error))}</ErrorText> : null}
      </Card>

      <ListGroup>
        <SettingsRow icon="people" title={t('me.preferences')} role="link" onPress={() => router.push('/settings/preferences')} />
        {/* Privacy opens in the Me tab's own stack, so the tab bar stays (storyboard 5.3). */}
        <SettingsRow icon="lock" title={t('settings.privacy.title')} subtitle={t('me.privacyHint')} role="link" onPress={() => router.push('/settings/privacy')} />
        <SettingsRow icon="bell" title={t('settings.notifications.title')} role="link" onPress={() => router.push('/settings/notifications')} />
        <SettingsRow icon="chat" title={t('notices.title')} role="link" onPress={() => router.push('/settings/notices')} />
        <SettingsRow icon="more" title={t('me.settings')} role="link" onPress={() => router.push('/settings')} />
      </ListGroup>

      <ListGroup>
        <SettingsRow icon="info" title={t('info.howMatchingWorks.title')} role="link" onPress={() => router.push('/info/how-matching-works')} />
        <SettingsRow icon="shield" title={t('info.safety.title')} role="link" onPress={() => router.push('/info/safety')} />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
});
