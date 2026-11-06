import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';
import { usePalette } from '@/components/theme';

/**
 * Modal sheets, presented from the root stack. Both draw their own in-page header ("Why this pod", storyboard 2.3;
 * the report sheet, 4.3), so the native bar is hidden; the titles still name the screens for the system. "Why this
 * pod" is a bottom sheet that sizes itself to its content (grabber, 28-pt top corners), ready to be presented as a
 * form sheet fitted to its contents; inside this full-height modal it sits at the top on the surface colour.
 */
export default function SheetsLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  const p = usePalette();
  return (
    <Stack screenOptions={stack}>
      <Stack.Screen name="why-this-pod" options={{ title: t('pods.whyThisPod'), headerShown: false, contentStyle: { backgroundColor: p.surface } }} />
      <Stack.Screen name="report" options={{ title: t('report.title'), headerShown: false }} />
    </Stack>
  );
}
