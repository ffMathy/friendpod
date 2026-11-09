import { Stack, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useStackScreenOptions } from '@/components/navigation';
import { usePalette } from '@/components/theme';
import { FULL_SCREEN_SETTINGS, MainTabBar } from '@/features/shell/MainTabBar';

/**
 * Me → Settings and its pages. They live under Me, so the main tab bar stays at the foot with Me selected, as on
 * priv-settings; deleting the account and the consent page take the whole screen. Settings, preferences,
 * notifications, blocked people and messages from Grouper draw their own header ("Me" above the Bricolage title, the
 * back chevron above it when there is history); the titles below are what the back button and screen readers use.
 */
export default function SettingsLayout() {
  const { t } = useTranslation();
  const p = usePalette();
  const stackOptions = useStackScreenOptions();
  const segments: readonly string[] = useSegments();
  const page = segments[segments.length - 1] ?? '';
  return (
    <View style={[styles.flex, { backgroundColor: p.page }]}>
      <View style={styles.flex}>
        <Stack screenOptions={stackOptions}>
          <Stack.Screen name="index" options={{ title: t('settings.title'), headerShown: false }} />
          <Stack.Screen name="privacy" options={{ title: t('settings.privacy.title') }} />
          <Stack.Screen name="delete-account" options={{ title: t('settings.delete.title') }} />
          <Stack.Screen name="blocked" options={{ title: t('settings.blocked.title'), headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: t('settings.notifications.title'), headerShown: false }} />
          <Stack.Screen name="preferences" options={{ title: t('me.preferences'), headerShown: false }} />
          <Stack.Screen name="sensitive-consent" options={{ title: t('settings.privacy.sensitiveTitle') }} />
          <Stack.Screen name="notices" options={{ title: t('notices.title'), headerShown: false }} />
        </Stack>
      </View>
      {FULL_SCREEN_SETTINGS.has(page) ? null : <MainTabBar selected="me" />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
