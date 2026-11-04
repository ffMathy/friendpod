import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Modal sheets, presented from the root stack. */
export default function SheetsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="consent" options={{ title: t('consent.title') }} />
      <Stack.Screen name="why-this-pod" options={{ title: t('pods.whyThisPod') }} />
      <Stack.Screen name="report" options={{ title: t('report.title') }} />
    </Stack>
  );
}
