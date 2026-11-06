import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/** Modal sheets, presented from the root stack. */
export default function SheetsLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="why-this-pod" options={{ title: t('pods.whyThisPod') }} />
      <Stack.Screen name="report" options={{ title: t('report.title') }} />
    </Stack>
  );
}
