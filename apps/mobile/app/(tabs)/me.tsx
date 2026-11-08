import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { usePalette } from '@/components/theme';
import { Banner, Button, Card, ErrorText, Icon, ListRow, ListSection, Loading, PageHeader, Screen } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { useNow } from '@/features/drop/time';
import { useUid } from '@/features/session/SessionProvider';
import { AboutMeCard } from '@/features/shell/AboutMeCard';
import { GearIcon, usePageTop } from '@/features/shell/parts';
import { prefsSummary } from '@/features/shell/prefsSummary';
import { ProfileCard } from '@/features/shell/ProfileCard';
import { WeeklyDropsCard } from '@/features/shell/WeeklyDropsCard';
import { isUserSettingReason } from '@/lib/reasons';

/**
 * Me (§11): the profile (photo, name, area, the user's own attendance record, "About me", D4), weekly drops, a hint
 * when a setting keeps the user out of pods, and the way to preferences, privacy, messages from Grouper and settings
 * (language, notifications, the legal documents, sign out). No storyboard draws it; it follows priv-settings (whose
 * "Me" eyebrow points here) and onb-final. The private-interests page carries the purple lock of private interests.
 */
export default function Me() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const uid = useUid();
  const user = useUserDoc(uid);
  const now = useNow();
  const top = usePageTop(40);
  const hideHeader = <Tabs.Screen options={{ headerShown: false }} />;
  if (!user.data) {
    return (
      <>
        {hideHeader}
        {user.error ? (
          <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }}>
            <PageHeader title={t('tabs.me')} />
            <Card>
              <ErrorText>{t('common.loadFailed')}</ErrorText>
            </Card>
          </Screen>
        ) : (
          <Loading label={t('common.loading')} />
        )}
      </>
    );
  }
  const u = user.data;
  const lastReason = u.lastDrop?.outcome === 'unmatched' ? u.lastDrop.reason : undefined;
  const blocking = isUserSettingReason(lastReason) ? lastReason : null;

  return (
    <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }} testID="me">
      {hideHeader}
      <PageHeader title={t('tabs.me')} />

      <ProfileCard uid={uid} user={u} />

      <AboutMeCard initial={u.aboutMe ?? ''} />

      <WeeklyDropsCard user={u} now={now} />

      {blocking ? (
        <Banner
          tone="info"
          icon="info"
          testID="blocking-setting"
          actions={<Button label={t('me.changePreferences')} variant="outline" size="xs" onPress={() => router.push('/settings/preferences')} />}
        >
          {t(`blockingSetting.${blocking}`)}
        </Banner>
      ) : null}

      <ListSection>
        <ListRow
          icon="people"
          label={t('me.preferences')}
          detail={prefsSummary(t, u.prefs)}
          testID="me-preferences"
          onPress={() => router.push('/settings/preferences')}
        />
        <ListRow icon="lock" label={t('me.privacy')} detail={t('me.privacyDetail')} testID="me-privacy" onPress={() => router.push('/settings/privacy')} />
        <ListRow icon="chat" label={t('notices.title')} detail={t('me.noticesDetail')} testID="me-notices" onPress={() => router.push('/settings/notices')} />
        <ListRow leading={<GearIcon />} label={t('me.settings')} detail={t('me.settingsDetail')} testID="me-settings" onPress={() => router.push('/settings')} />
      </ListSection>

      <ListSection title={t('me.goodToKnow')}>
        <ListRow icon="info" label={t('info.howMatchingWorks.title')} onPress={() => router.push('/info/how-matching-works')} />
        <ListRow icon="shield" label={t('info.safety.title')} onPress={() => router.push('/info/safety')} />
        <ListRow
          leading={<Icon name="lock" size={22} color={p.privateText} />}
          label={t('info.sensitive.title')}
          onPress={() => router.push('/info/sensitive-interests')}
        />
      </ListSection>
    </Screen>
  );
}
