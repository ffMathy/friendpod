import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Heading, Screen } from '@/components/ui';
import { usePhotoUpload } from '@/features/photos/upload';
import { useUid } from '@/features/session/SessionProvider';

/** §3.1 step 9 (optional). */
export default function Photo() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, choose } = usePhotoUpload(useUid());

  return (
    <Screen>
      <Heading>{t('onboarding.photo.title')}</Heading>
      <Body>{t('onboarding.photo.body')}</Body>
      <Button label={t('onboarding.photo.choose')} busy={state === 'uploading'} onPress={() => void choose()} />
      {state === 'done' ? <Body>{t('onboarding.photo.uploaded')}</Body> : null}
      {state === 'failed' ? <ErrorText>{t('onboarding.photo.failed')}</ErrorText> : null}
      <Button
        label={state === 'done' ? t('common.continue') : t('common.skip')}
        variant={state === 'done' ? 'primary' : 'secondary'}
        onPress={() => router.push('/notifications')}
      />
    </Screen>
  );
}
