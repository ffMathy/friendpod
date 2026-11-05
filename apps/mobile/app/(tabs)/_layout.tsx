import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarIconStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.thisWeek') }} />
      <Tabs.Screen name="pods" options={{ title: t('tabs.pods') }} />
      <Tabs.Screen name="interests" options={{ title: t('tabs.interests') }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
    </Tabs>
  );
}
