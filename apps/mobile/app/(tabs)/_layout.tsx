import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { TAB_ICONS, tabIcon, useTabScreenOptions } from '@/components/navigation';

/** The four tabs of the storyboards' bottom nav: This week, Pods, Interests, Me. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabs.thisWeek'), tabBarIcon: tabIcon(TAB_ICONS.index) }} />
      <Tabs.Screen name="pods" options={{ title: t('tabs.pods'), tabBarIcon: tabIcon(TAB_ICONS.pods) }} />
      <Tabs.Screen name="interests" options={{ title: t('tabs.interests'), tabBarIcon: tabIcon(TAB_ICONS.interests) }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me'), tabBarIcon: tabIcon(TAB_ICONS.me) }} />
    </Tabs>
  );
}
