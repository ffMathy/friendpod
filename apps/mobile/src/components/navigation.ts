/**
 * Navigator styling from the storyboard tokens.
 *
 * - `useNavigationTheme()` feeds the root ThemeProvider, so every navigator (including nested stacks and the tab bar)
 *   picks up the ground colour, ink text, green tint and Plus Jakarta Sans without per-layout changes.
 * - `useStackScreenOptions()` is the default for a Stack's `screenOptions`: a native header that blends into the
 *   ground (no shadow, 17/700 title, green back chevron). Screens that follow a storyboard set `headerShown: false`
 *   and draw `ScreenHeader` (back chevron + big title) themselves.
 * - `useTabScreenOptions()` is for the bottom tabs: white bar with a hairline, green active label and icon.
 */
import type { NativeStackNavigationOptions, Theme } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { useColorScheme } from 'react-native';
import { Fonts, usePalette } from './theme';

export function useNavigationTheme(): Theme {
  const p = usePalette();
  return {
    dark: useColorScheme() === 'dark',
    colors: {
      primary: p.primary,
      background: p.ground,
      // Header bars blend into the screen; the tab bar sets its own white background (useTabScreenOptions).
      card: p.ground,
      text: p.ink,
      border: p.border,
      notification: p.amber,
    },
    fonts: { regular: Fonts.regular, medium: Fonts.semibold, bold: Fonts.bold, heavy: Fonts.extrabold },
  };
}

export function useStackScreenOptions(): NativeStackNavigationOptions {
  const p = usePalette();
  return {
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: p.ground },
    headerTintColor: p.primary,
    headerTitleStyle: { ...Fonts.bold, fontSize: 17, color: p.ink },
    contentStyle: { backgroundColor: p.ground },
  };
}

export function useTabScreenOptions(): BottomTabNavigationOptions {
  const p = usePalette();
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: p.ground },
    headerTitleStyle: { ...Fonts.bold, fontSize: 17, color: p.ink },
    tabBarActiveTintColor: p.primary,
    tabBarInactiveTintColor: p.muted,
    tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border, borderTopWidth: 1 },
    tabBarLabelStyle: { ...Fonts.bold, fontSize: 12 },
    sceneStyle: { backgroundColor: p.ground },
  };
}
