/**
 * Navigation chrome in the brand: the React Navigation theme, the Stack header options every layout uses, and
 * the tab bar (storyboard nav: white, 1 px top border, 24 px icons, 12/600 labels, active green 12/800).
 */
import type { NativeStackNavigationOptions, Theme } from 'expo-router';
import { Text as RNText, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { BorderWidth, Colors, FontFamily, Layout, Size, typeStyle, usePalette, useColorSchemeName, type ColorScheme } from './theme';

/** React Navigation theme: brand colours and Plus Jakarta Sans (one family per weight, so `fontWeight: 'normal'`). */
export function navigationTheme(scheme: ColorScheme): Theme {
  const p = Colors[scheme];
  return {
    dark: scheme === 'dark',
    colors: { primary: p.primary, background: p.page, card: p.page, text: p.text, border: p.border, notification: p.accent },
    fonts: {
      regular: { fontFamily: FontFamily['400'], fontWeight: 'normal' },
      medium: { fontFamily: FontFamily['600'], fontWeight: 'normal' },
      bold: { fontFamily: FontFamily['700'], fontWeight: 'normal' },
      heavy: { fontFamily: FontFamily['800'], fontWeight: 'normal' },
    },
  };
}

export function useNavigationTheme(): Theme {
  return navigationTheme(useColorSchemeName());
}

/**
 * Stack header: page colour, no hairline, near-black chevron (minimal back button), 17/700 title. Screens that
 * draw their own header (a PageHeader or StepHeader in the page) set `headerShown: false` for themselves.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const p = usePalette();
  return {
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: p.page },
    headerTintColor: p.text,
    headerTitleStyle: { fontFamily: FontFamily['700'], fontSize: 17, color: p.text },
    contentStyle: { backgroundColor: p.page },
  };
}

/** The four tabs and their storyboard icons. */
export const TAB_ICONS: Readonly<Record<'index' | 'pods' | 'interests' | 'me', IconName>> = {
  index: 'calendar',
  pods: 'people',
  interests: 'tag',
  me: 'person',
};

/** A `tabBarIcon` render callback for a storyboard icon. */
export function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={Size.icon} color={color} />;
  };
}

/** Bold when selected (12/800), semibold otherwise (12/600). */
export function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return <RNText style={[typeStyle(focused ? 'microHeavy' : 'microStrong'), { color }]}>{children}</RNText>;
}

/**
 * Tab navigator options. The header shows the tab's title as the page title (30/800, left, on the page colour),
 * like the storyboards' in-page titles; a tab screen that renders its own `PageHeader` hides it with
 * `<Tabs.Screen options={{ headerShown: false }} />`.
 */
export function useTabScreenOptions() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);
  return {
    headerStyle: { backgroundColor: p.page },
    headerShadowVisible: false,
    headerTitleAlign: 'left' as const,
    headerTitleStyle: { ...typeStyle('title'), color: p.text },
    headerTitleContainerStyle: { paddingHorizontal: Layout.gutterCompact - 16 },
    headerTintColor: p.text,
    sceneStyle: { backgroundColor: p.page },
    tabBarActiveTintColor: p.primary,
    tabBarInactiveTintColor: p.textMuted,
    tabBarStyle: {
      backgroundColor: p.surface,
      borderTopColor: p.border,
      borderTopWidth: BorderWidth.hairline,
      height: Size.tabBar + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
    },
    tabBarLabel: ({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) => (
      <TabLabel focused={focused} color={color}>
        {children}
      </TabLabel>
    ),
  };
}
