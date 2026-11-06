import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, type ColorValue } from 'react-native';
import { useTabScreenOptions } from '@/components/navigation';
import { Fonts } from '@/components/theme';
import { Icon, type IconName } from '@/components/ui';

/** The storyboards' bottom navigation: 24-pt icons, 12-pt labels, 800 when active and 600 otherwise. */
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return (
    <Text numberOfLines={1} style={[focused ? Fonts.extrabold : Fonts.semibold, styles.label, { color }]}>
      {children}
    </Text>
  );
}

const tabIcon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Icon name={name} size={24} color={typeof color === 'string' ? color : undefined} />;

/**
 * Every tab screen draws its own in-page header (storyboards 2.1, 5.2, 5.3), so the navigator shows none.
 *
 * Pods and Me are groups with their own stacks, so their pages keep the tab bar while keeping their URLs: the pod page
 * (/pod/<id>, storyboards 3.1 and 3.4) above the Pods list, and Privacy (/settings/privacy, 5.3) above Me. The Pods
 * stack goes back to its list when another tab is chosen, so a pod opened later from This week or a notification
 * lands on the list, never on an older pod page.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const options = useTabScreenOptions();
  return (
    <Tabs screenOptions={{ ...options, headerShown: false, tabBarLabel: TabLabel }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.thisWeek'), tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="(pods)" options={{ title: t('tabs.pods'), tabBarIcon: tabIcon('people'), popToTopOnBlur: true }} />
      <Tabs.Screen name="interests" options={{ title: t('tabs.interests'), tabBarIcon: tabIcon('tag') }} />
      <Tabs.Screen name="(me)" options={{ title: t('tabs.me'), tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
