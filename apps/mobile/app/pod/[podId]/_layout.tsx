import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/**
 * The pod's screens. The pod page, the planner, "Suggest a time" and the chat draw their own headers (back chevron or
 * close cross, as on the storyboards); feedback and the member sheet keep the stack header.
 */
export default function PodLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: t('pod.title'), headerShown: false }} />
      <Stack.Screen name="plan" options={{ title: t('plan.title'), headerShown: false }} />
      <Stack.Screen name="propose" options={{ title: t('plan.proposeTitle'), headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="chat" options={{ title: t('chat.title'), headerShown: false }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen name="member/[uid]" options={{ title: t('member.title'), presentation: 'modal' }} />
    </Stack>
  );
}
