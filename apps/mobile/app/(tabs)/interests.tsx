import { Tabs } from 'expo-router/js-tabs';
import { Screen } from '@/components/ui';
import { useTabTopPadding } from '@/features/drop/layout';
import { InterestManager } from '@/features/interests/InterestManager';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/**
 * Interests tab (§11, priv-interests): "Interests · 5 of 20", the add row, every holding with a star and "…", and the
 * private ones in their own card with the consent date and "Remove & withdraw". The page draws its own title.
 */
export default function Interests() {
  const top = useTabTopPadding();
  return (
    <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }}>
      <Tabs.Screen options={{ headerShown: false }} />
      <InterestManager uid={useUid()} locale={currentLocale()} mode="full" />
    </Screen>
  );
}
