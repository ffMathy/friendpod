import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

export default function PodLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: t('pod.title') }} />
      <Stack.Screen name="plan" options={{ title: t('plan.title') }} />
      <Stack.Screen name="chat" options={{ title: t('chat.title') }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen name="member/[uid]" options={{ title: t('member.title'), presentation: 'modal' }} />
    </Stack>
  );
}
