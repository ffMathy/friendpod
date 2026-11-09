/**
 * Navigation chrome (blend spec §6.12, §6.13): the React Navigation theme, the Stack header options every layout uses,
 * and the tab bar: white, 1 px Line on top, 24 px icons; the active tab gets a 56 × 30 Skov-tint pill behind its icon
 * and a Skov-deep 12/800 label, inactive tabs are Muted 12/600. An unread tab gets an Ink dot, never a pod colour.
 * Light and dark follow the palette (dark: Skov light on the active tab, a deep green pill).
 */
import type { NativeStackNavigationOptions, Theme } from 'expo-router';
import { Text as RNText, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnreadDot } from './Chip';
import { Icon, type IconName } from './Icon';
import { BorderWidth, Colors, DisplayFontFamily, FontFamily, Layout, Size, typeStyle, usePalette, useColorSchemeName, type ColorScheme } from './theme';

/** React Navigation theme: E colours and fonts (one family per weight, so `fontWeight: 'normal'`). */
export function navigationTheme(scheme: ColorScheme): Theme {
  const p = Colors[scheme];
  return {
    dark: scheme === 'dark',
    colors: { primary: p.primary, background: p.page, card: p.page, text: p.text, border: p.border, notification: p.ink },
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
 * Stack header: Paper (Night in dark mode), no hairline, an Ink chevron (minimal back button), the title in Bricolage
 * 800 at 18 px. Screens that draw their own header (a PageHeader, StepHeader or PodBand in the page) set
 * `headerShown: false` for themselves.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const p = usePalette();
  return {
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerStyle: { backgroundColor: p.page },
    headerTintColor: p.text,
    headerTitleStyle: { fontFamily: DisplayFontFamily['800'], fontSize: 18, color: p.text },
    contentStyle: { backgroundColor: p.page },
  };
}

/** The four tabs and their icons. */
export const TAB_ICONS: Readonly<Record<'index' | 'pods' | 'interests' | 'me', IconName>> = {
  index: 'calendar',
  pods: 'people',
  interests: 'tag',
  me: 'person',
};

/**
 * A tab icon: the 24 px icon, on a 56 × 30 Skov-tint pill when the tab is active, with an Ink unread dot at its top
 * right when `unread`. Used by the tab navigator and by the bars drawn under pushed pages (MainTabBar, PodTabBar).
 */
export function TabBarIcon({ name, focused, color, unread = false }: { name: IconName; focused: boolean; color: ColorValue; unread?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.pill, focused ? { backgroundColor: p.tabActiveBg } : null]}>
      <Icon name={name} size={Size.icon} color={color} />
      {unread ? (
        <View style={styles.dot}>
          <UnreadDot />
        </View>
      ) : null}
    </View>
  );
}

/** A `tabBarIcon` render callback for a tab icon. */
export function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabBarIcon name={name} focused={focused} color={color} />;
  };
}

/** Bold when selected (12/800), semibold otherwise (12/600). */
export function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return <RNText style={[typeStyle(focused ? 'microHeavy' : 'microStrong'), { color }]}>{children}</RNText>;
}

/**
 * Tab navigator options. The header shows the tab's title as the page title (Bricolage 30/32, left, on Paper), like
 * the storyboards' in-page titles; a tab screen that renders its own `PageHeader` or poster field hides it with
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
    tabBarActiveTintColor: p.tabActive,
    tabBarInactiveTintColor: p.tabInactive,
    tabBarStyle: {
      backgroundColor: p.surface,
      borderTopColor: p.border,
      borderTopWidth: BorderWidth.hairline,
      height: Size.tabBar + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
    },
    tabBarIconStyle: { width: 56, height: 30 },
    tabBarLabel: ({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) => (
      <TabLabel focused={focused} color={color}>
        {children}
      </TabLabel>
    ),
  };
}

const styles = StyleSheet.create({
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 0, right: 12 },
});
