import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Body, Button, Card, ErrorText } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { errorMessageKey } from '@/lib/errors';
import { AuthenticatedPhoto } from './AuthenticatedPhoto';
import { usePhotoUpload } from './upload';

/**
 * Me → Photo (§3.1 step 10, §9 Photos): the user's own current version, add or change it (a new upload replaces the
 * old version once `onPhotoUploaded` has checked it) and delete it (a Danger outline button, decision 4).
 */
export function PhotoCard({ uid, version }: { uid: string; version: number | null }) {
  const { t } = useTranslation();
  const { state, choose } = usePhotoUpload(uid);
  const remove = useCallable('deletePhoto');
  const confirmDelete = () =>
    Alert.alert(t('settings.privacy.deletePhoto'), t('settings.privacy.deletePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.privacy.deletePhoto'),
        style: 'destructive',
        onPress: () => remove.mutate({}, { onSuccess: () => void clearImageCaches().catch(() => undefined) }),
      },
    ]);
  return (
    <Card>
      <Body bold>{t('me.photo')}</Body>
      <Body muted>{t('me.photoWho')}</Body>
      {version !== null ? (
        <AuthenticatedPhoto
          owner={uid}
          version={version}
          size="thumb"
          accessibilityLabel={t('me.yourPhoto')}
          style={{ width: 96, height: 96, borderRadius: 48 }}
        />
      ) : null}
      <Button
        testID="photo-choose"
        label={version === null ? t('onboarding.photo.choose') : t('me.changePhoto')}
        variant="secondary"
        busy={state === 'uploading'}
        onPress={() => void choose()}
      />
      {state === 'done' ? <Body>{t('onboarding.photo.uploaded')}</Body> : null}
      {state === 'failed' ? <ErrorText>{t('me.photoFailed')}</ErrorText> : null}
      {version !== null ? (
        <Button testID="photo-delete" label={t('settings.privacy.deletePhoto')} variant="danger" busy={remove.isPending} onPress={confirmDelete} />
      ) : null}
      {remove.error ? <ErrorText>{t(errorMessageKey(remove.error))}</ErrorText> : null}
    </Card>
  );
}
