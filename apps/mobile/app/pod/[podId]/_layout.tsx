import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PodLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: t('pod.title') }} />
      <Stack.Screen name="plan" options={{ title: t('plan.title') }} />
      <Stack.Screen name="chat" options={{ title: t('chat.title') }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen name="member/[uid]" options={{ title: t('member.title'), presentation: 'modal' }} />
    </Stack>
  );
}
