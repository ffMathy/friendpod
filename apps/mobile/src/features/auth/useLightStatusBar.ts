import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useColorSchemeName } from '@/components/theme';

/**
 * White status-bar content while a screen that starts with the Skov field (the welcome) is in front, so the clock and
 * battery stay readable on the field (Skov is dark in both modes). Blurring or leaving the screen (a pushed page such
 * as /email or the Terms, or signing in) puts back the system's style: on iOS `default`, which follows light and dark
 * mode by itself; on Android the dark or light icons for the current mode.
 */
export function useLightStatusBar(): void {
  const scheme = useColorSchemeName();
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      return () => StatusBar.setBarStyle(Platform.OS === 'ios' ? 'default' : scheme === 'dark' ? 'light-content' : 'dark-content', true);
    }, [scheme]),
  );
}
