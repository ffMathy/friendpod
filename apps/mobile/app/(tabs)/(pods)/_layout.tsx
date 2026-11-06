import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/components/navigation';

/** A link straight to /pod/<id> (a notification, This week) still gets the Pods list underneath, so back leads to it. */
export const unstable_settings = { anchor: 'pods' };

/**
 * The Pods tab's own stack: the list (/pods) and the pod page (/pod/<id>, storyboards 3.1 and 3.4), which keeps the
 * tab bar with Pods active. The pod's planner, chat, feedback and member sheet open over the tabs from the root stack
 * (app/pod/[podId]/…), as their storyboards have no tab bar. Every screen draws its own in-page header.
 */
export default function PodsLayout() {
  const { t } = useTranslation();
  const stack = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="pods" options={{ title: t('tabs.pods') }} />
      <Stack.Screen name="pod/[podId]" options={{ title: t('pod.title') }} />
    </Stack>
  );
}
