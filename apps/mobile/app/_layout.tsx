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

/**
 * The root stack. The tabs (This week, Pods, Me with their own stacks: the pod page and Privacy sit under their tab, so
 * the tab bar stays, storyboards 3.1, 3.4, 5.3) are its base; everything the storyboards draw without the tab bar opens
 * over them: the pod's planner, chat and feedback (3.2, 3.5, 4.1), the member sheet (4.2), Settings and Privacy's
 * sub-pages (5.4), the info pages and the two sheets. The pod's sub-pages have no layout of their own, so each is a
 * screen of this stack and the member sheet is presented over the pod page. Every screen draws its own in-page header.
 */
function Navigator() {
  const { phase, user } = useSession();
  const { t } = useTranslation();
  // Storyboard look for every navigator below (colours, fonts); nested stacks spread useStackScreenOptions() too.
  const theme = useNavigationTheme();
  const stackOptions = useStackScreenOptions();
  const p = usePalette();
  const ground = p.ground;
  // Storyboards 2.3 and 4.2: bottom sheets sized to their content over the screen below, dimmed to the storyboards'
  // dark backdrop. The route is a transparent modal that fades in; the screen draws the backdrop, the sheet and its
  // gestures with SheetScreen (src/components/sheet.tsx), so the sheet's height follows its content by layout. Not a
  // native form sheet: on Android its fit-to-contents height was measured once and clipped what loaded after (the
  // last reasons, "What we never use" and "How matching works"), and its light grey dimming cannot be themed.
  const bottomSheet = { headerShown: false, presentation: 'transparentModal', animation: 'fade' } as const;

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
          <Stack.Screen name="pod/[podId]/plan" options={{ title: t('plan.title'), headerShown: false }} />
          <Stack.Screen name="pod/[podId]/chat" options={{ title: t('chat.title'), headerShown: false }} />
          <Stack.Screen name="pod/[podId]/feedback" options={{ title: t('feedback.title'), headerShown: false }} />
          <Stack.Screen name="pod/[podId]/member/[uid]" options={{ title: t('member.title'), ...bottomSheet }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase !== 'signedOut'}>
          <Stack.Screen name="sheets/why-this-pod" options={{ title: t('pods.whyThisPod'), ...bottomSheet }} />
          <Stack.Screen name="sheets/report" options={{ title: t('report.title'), presentation: 'modal', headerShown: false }} />
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
