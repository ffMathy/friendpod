import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ICONS, TabLabel } from '@/components/navigation';
import { BorderWidth, Size, usePalette } from '@/components/theme';
import { Icon } from '@/components/ui';

export type MainTab = keyof typeof TAB_ICONS;

/** Settings pages that take the whole screen, as priv-delete does: no tab bar under them. */
export const FULL_SCREEN_SETTINGS: ReadonlySet<string> = new Set(['delete-account', 'sensitive-consent']);

/** The part of a navigation state this needs: route names, nested states and the focused index. */
export interface RouteStateLike {
  readonly index?: number;
  readonly routes: readonly { readonly name: string; readonly state?: RouteStateLike }[];
}

const focusedName = (s: RouteStateLike | undefined): string | undefined => s?.routes[s.index ?? s.routes.length - 1]?.name;
const TAB_KEYS: ReadonlySet<string> = new Set(Object.keys(TAB_ICONS));
const isMainTab = (name: string | undefined): name is MainTab => name !== undefined && TAB_KEYS.has(name);

/** The stack that holds `route`: the navigation state, or the first one down its focused routes that has it. */
function stackHolding(state: RouteStateLike | undefined, route: string): RouteStateLike | undefined {
  for (let s = state; s !== undefined; s = s.routes[s.index ?? s.routes.length - 1]?.state) {
    if (s.routes.some((r) => r.name === route)) return s;
  }
  return undefined;
}

/**
 * The tab a page in the app's root stack (`route`, e.g. the info pages) belongs to, read from the screen it was opened
 * over in the navigation state (`useRootNavigationState`; the app's stack may sit inside the container's own): the
 * tab that was open, Pods under a pod page, Me under Settings. A sheet in between is looked through. Opened over a
 * full-screen flow (the consent page) or outside the signed-in app (welcome, onboarding), it belongs to no tab and
 * gets no bar: `null`. Opened on its own (a link with nothing under it), it is Me's, which lists these pages.
 */
export function tabUnder(state: RouteStateLike, route: string): MainTab | null {
  const stack = stackHolding(state, route);
  if (stack === undefined) return null;
  const at = stack.routes.map((r) => r.name).lastIndexOf(route);
  for (let i = at - 1; i >= 0; i--) {
    const under = stack.routes[i];
    if (under === undefined || under.name === 'sheets' || under.name === route) continue;
    if (under.name === '(tabs)') {
      const tab = focusedName(under.state);
      return isMainTab(tab) ? tab : 'index';
    }
    if (under.name === 'settings') return FULL_SCREEN_SETTINGS.has(focusedName(under.state) ?? '') ? null : 'me';
    if (under.name === 'pod/[podId]') return 'pods';
    return null;
  }
  return 'me';
}

const TABS: readonly { readonly key: MainTab; readonly href: Href; readonly label: 'tabs.thisWeek' | 'tabs.pods' | 'tabs.interests' | 'tabs.me' }[] = [
  { key: 'index', href: '/', label: 'tabs.thisWeek' },
  { key: 'pods', href: '/pods', label: 'tabs.pods' },
  { key: 'interests', href: '/interests', label: 'tabs.interests' },
  { key: 'me', href: '/me', label: 'tabs.me' },
];

/**
 * The main tab bar under a page that sits in the root stack above the tabs, with its tab selected: Me under Settings
 * and its pages, as priv-settings draws it ("Me" above the title, Me active in the bar), and under the info pages the
 * tab they were opened from (`tabUnder`). The real bar is hidden while
 * such a page is open, so this draws the same one (icons, labels and metrics of `useTabScreenOptions`); a tab goes
 * back down to that tab, as tapping a tab under a pushed page does. Same as the pod pages' bar (PodTabBar).
 */
export function MainTabBar({ selected }: { readonly selected: MainTab }) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);
  return (
    <View
      accessibilityRole="tablist"
      testID="main-tab-bar"
      style={[styles.bar, { backgroundColor: p.surface, borderTopColor: p.border, height: Size.tabBar + bottom, paddingBottom: bottom }]}
    >
      {TABS.map((tab) => {
        const active = tab.key === selected;
        const color = active ? p.primary : p.textMuted;
        const label = t(tab.label);
        return (
          <Pressable
            key={tab.key}
            testID={`main-tab-${tab.key}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => router.dismissTo(tab.href)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={TAB_ICONS[tab.key]} size={Size.icon} color={color} />
            <TabLabel focused={active} color={color}>
              {label}
            </TabLabel>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: BorderWidth.hairline, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: Size.hitTarget },
});
