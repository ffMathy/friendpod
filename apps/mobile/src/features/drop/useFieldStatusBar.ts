import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useColorSchemeName } from '@/components/theme';

/**
 * White status-bar content while This week shows the Thursday drop's Skov field at its top (Skov is dark in both
 * modes), so the clock and battery stay readable. Leaving the tab, or the field giving way to a proposal or the
 * no-pod answer (it unmounts), puts back the system's style: `default` on iOS, which follows light and dark mode by
 * itself; on Android the icons for the current mode.
 */
export function useFieldStatusBar(): void {
  const scheme = useColorSchemeName();
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      return () => StatusBar.setBarStyle(Platform.OS === 'ios' ? 'default' : scheme === 'dark' ? 'light-content' : 'dark-content', true);
    }, [scheme]),
  );
}
