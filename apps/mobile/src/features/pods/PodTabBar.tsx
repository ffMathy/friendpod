import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ICONS, TabLabel } from '@/components/navigation';
import { BorderWidth, Size, usePalette } from '@/components/theme';
import { Icon } from '@/components/ui';

type TabKey = keyof typeof TAB_ICONS;

const TABS: readonly { readonly key: TabKey; readonly href: Href; readonly label: 'tabs.thisWeek' | 'tabs.pods' | 'tabs.interests' | 'tabs.me' }[] = [
  { key: 'index', href: '/', label: 'tabs.thisWeek' },
  { key: 'pods', href: '/pods', label: 'tabs.pods' },
  { key: 'interests', href: '/interests', label: 'tabs.interests' },
  { key: 'me', href: '/me', label: 'tabs.me' },
];

/**
 * The main tab bar at the foot of a pod page, with Pods selected (pod-confirmed, pod-scheduled storyboards). The pod
 * routes sit in the root stack above the tabs, so the real bar is hidden while one is open; this draws the same bar
 * (same icons, labels and metrics as `useTabScreenOptions`), and a tab goes back down to that tab, as tapping a tab
 * under a pushed page does.
 */
export function PodTabBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);
  return (
    <View
      accessibilityRole="tablist"
      testID="pod-tab-bar"
      style={[styles.bar, { backgroundColor: p.surface, borderTopColor: p.border, height: Size.tabBar + bottom, paddingBottom: bottom }]}
    >
      {TABS.map((tab) => {
        const selected = tab.key === 'pods';
        const color = selected ? p.primary : p.textMuted;
        const label = t(tab.label);
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => router.dismissTo(tab.href)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={TAB_ICONS[tab.key]} size={Size.icon} color={color} />
            <TabLabel focused={selected} color={color}>
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
