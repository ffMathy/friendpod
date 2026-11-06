import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/**
 * Modal sheets, presented from the root stack. Each draws its own header with a close cross (drop-why,
 * after-report), so the stack header is hidden; the titles still name the screens for the system.
 */
export default function SheetsLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="why-this-pod" options={{ title: t('pods.whyThisPod'), headerShown: false }} />
      <Stack.Screen name="report" options={{ title: t('report.title'), headerShown: false }} />
    </Stack>
  );
}
