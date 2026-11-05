import { Screen } from '@/components/ui';
import { InterestManager } from '@/features/interests/InterestManager';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/** Interests tab (§11): every holding, private ones with a lock. */
export default function Interests() {
  return (
    <Screen>
      <InterestManager uid={useUid()} locale={currentLocale()} mode="full" />
    </Screen>
  );
}
