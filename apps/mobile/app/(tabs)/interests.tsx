import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';
import { InterestManager, MAX_INTERESTS } from '@/features/interests/InterestManager';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/** Interests tab (§11, storyboard 5.2): every holding, private ones with a lock in their own group. */
export default function Interests() {
  const { t } = useTranslation();
  const uid = useUid();
  const count = (useInterests(uid).data?.length ?? 0) + (useSensitiveInterests(uid).data?.length ?? 0);
  return (
    <Screen>
      <ScreenHeader title={t('tabs.interests')} meta={t('interests.ofMax', { count, max: MAX_INTERESTS })} />
      <InterestManager uid={uid} locale={currentLocale()} mode="full" />
    </Screen>
  );
}
