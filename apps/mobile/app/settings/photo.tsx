import { useTranslation } from 'react-i18next';
import { Loading, Screen, ScreenHeader } from '@/components/ui';
import { useUserDoc } from '@/data/docs';
import { PhotoCard } from '@/features/photos/PhotoCard';
import { useUid } from '@/features/session/SessionProvider';
import { useBack } from '@/features/settings/useBack';

/**
 * Me → Privacy → Photo (storyboard 5.3 links the Photo row to the photo card of 1.7): the user's own photo, added,
 * changed or deleted here (deleting asks first and clears the image caches), with who can see it and the per-pod
 * choice in pods about a private interest.
 */
export default function PhotoSettings() {
  const { t } = useTranslation();
  const back = useBack('/settings/privacy');
  const uid = useUid();
  const user = useUserDoc(uid);
  if (!user.data) return <Loading label={t('common.loading')} />;
  return (
    <Screen>
      <ScreenHeader eyebrow={t('settings.privacy.title')} title={t('me.photo')} backLabel={t('common.back')} onBack={back} />
      <PhotoCard uid={uid} version={user.data.photo?.v ?? null} title={t('me.yourPhoto')} />
    </Screen>
  );
}
