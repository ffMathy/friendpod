import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { useNavigationTheme, useStackScreenOptions } from '@/components/navigation';
import { usePalette } from '@/components/theme';
import { useUserDoc } from '@/data/docs';
import { queryClient } from '@/data/queryClient';
import { initFirebase } from '@/firebase';
import { useDeviceCacheHygiene } from '@/features/account/useDeviceCacheHygiene';
import { useNotificationRouting } from '@/features/notifications/useNotificationRouting';
import { usePushTokenSync } from '@/features/notifications/usePushTokenSync';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { useAppOpened } from '@/features/session/useAppOpened';
import { i18n, initI18n } from '@/i18n';

initFirebase();
initI18n();
void SplashScreen.preventAutoHideAsync();

/** Once a profile exists, its `locale` (set at onboarding, changed in Me) drives the UI language. */
function ProfileEffects({ uid }: { uid: string }) {
  const profile = useUserDoc(uid);
  const locale = profile.data?.locale;
  useEffect(() => {
    if (locale) initI18n(locale);
  }, [locale]);
  useDeviceCacheHygiene(uid);
  usePushTokenSync();
  useAppOpened();
  useNotificationRouting(uid);
  return null;
}

function Navigator() {
  const { phase, user } = useSession();
  const { t } = useTranslation();
  // Storyboard look for every navigator below (colours, fonts); nested stacks spread useStackScreenOptions() too.
  const theme = useNavigationTheme();
  const stackOptions = useStackScreenOptions();
  const ground = usePalette().ground;

  useEffect(() => {
    if (phase !== 'loading') void SplashScreen.hideAsync();
  }, [phase]);
  // The root view shows through during transitions and behind the keyboard.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(ground);
  }, [ground]);
  if (phase === 'loading') return null;

  return (
    <ThemeProvider value={theme}>
      {phase === 'ready' && user ? <ProfileEffects key={user.uid} uid={user.uid} /> : null}
      <Stack screenOptions={stackOptions}>
        <Stack.Protected guard={phase === 'signedOut'}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'onboarding'}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'ready'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="pod/[podId]" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase !== 'signedOut'}>
          <Stack.Screen name="sheets" options={{ presentation: 'modal', headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="auth/complete" options={{ title: t('auth.complete.title'), headerShown: false }} />
        <Stack.Screen name="info" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Navigator />
        </SessionProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
