import { Stack, useRootNavigationState } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useStackScreenOptions } from '@/components/navigation';
import { usePalette } from '@/components/theme';
import { useSession } from '@/features/session/SessionProvider';
import { MainTabBar, tabUnder } from '@/features/shell/MainTabBar';

/**
 * Transparency pages (Arts. 13/22), readable signed in or out. Each draws its own header (back chevron above a Bricolage
 * title, as priv-delete does); the titles below are what the back button and screen readers use.
 *
 * Signed in, a page keeps the main tab bar of the tab it was opened from, as Settings and its pages keep Me's: Me
 * (its "Good to know" rows, Settings → Legal, Privacy), This week, Pods (a pod's safety note) or Interests. Opened from
 * welcome, onboarding or a full-screen flow (the consent page's "Read more"), it stays full screen like them.
 */
export default function InfoLayout() {
  const { t } = useTranslation();
  const p = usePalette();
  const stackOptions = useStackScreenOptions();
  const signedIn = useSession().phase === 'ready';
  const root = useRootNavigationState();
  const tab = signedIn ? tabUnder(root, 'info') : null;
  return (
    <View style={[styles.flex, { backgroundColor: p.page }]}>
      <View style={styles.flex}>
        <Stack screenOptions={{ ...stackOptions, headerShown: false }}>
          <Stack.Screen name="how-matching-works" options={{ title: t('info.howMatchingWorks.title') }} />
          <Stack.Screen name="safety" options={{ title: t('info.safety.title') }} />
          <Stack.Screen name="sensitive-interests" options={{ title: t('info.sensitive.title') }} />
          <Stack.Screen name="legal/[doc]" options={{ title: t('info.legalTitle') }} />
        </Stack>
      </View>
      {tab ? <MainTabBar selected={tab} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
