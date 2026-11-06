import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';
import { Radius, usePalette } from '@/components/theme';

/**
 * The pod stack. Every screen draws its own in-page header (storyboards 3.1–3.5, 4.1), so the native bar is hidden;
 * the titles still name the screens for the system. The member sheet (4.2) sizes to its content and draws its own
 * grabber, so it is a fit-to-contents form sheet on the white surface.
 */
export default function PodLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  const p = usePalette();
  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="index" options={{ title: t('pod.title') }} />
      <Stack.Screen name="plan" options={{ title: t('plan.title') }} />
      <Stack.Screen name="chat" options={{ title: t('chat.title') }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen
        name="member/[uid]"
        options={{
          title: t('member.title'),
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          sheetCornerRadius: Radius.heroLg,
          contentStyle: { backgroundColor: p.surface },
        }}
      />
    </Stack>
  );
}
