import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Body, Button, Card, ErrorText, Heading, LinkRow, Screen } from '@/components/ui';
import { useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { requestDataExport } from '@/features/account/account';
import { art9WithdrawCopy } from '@/features/consent/art9';
import { useUid } from '@/features/session/SessionProvider';
import { toAppError } from '@/firebase/callables';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/** Settings → Privacy (§11, PRIVACY.md §6): consents, export, pause, delete. */
export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const withdraw = useCallable('withdrawArt9Consent');
  const updateProfile = useCallable('updateProfile');
  const participation = useCallable('setParticipation');
  const deletePhoto = useCallable('deletePhoto');
  const [exportState, setExportState] = useState<'idle' | 'working' | 'requested' | 'linkSent' | { error: string }>('idle');

  const exportData = async () => {
    setExportState('working');
    try {
      const outcome = await requestDataExport();
      setExportState(outcome.kind === 'done' ? 'requested' : 'linkSent');
    } catch (e) {
      setExportState({ error: t(errorMessageKey(toAppError(e))) });
    }
  };

  const hasArt9Consent = user.data?.legal.art9 !== undefined;
  const confirmWithdraw = () =>
    Alert.alert(t('settings.privacy.withdrawSensitive'), art9WithdrawCopy(currentLocale()), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.privacy.withdrawSensitive'), style: 'destructive', onPress: () => withdraw.mutate({}) },
    ]);
  const sameGender = user.data?.prefs.sameGenderOnly === true;
  const hasPhoto = user.data?.photo !== null && user.data?.photo !== undefined;
  const firstError = withdraw.error ?? updateProfile.error ?? participation.error ?? deletePhoto.error;

  return (
    <Screen>
      <Heading>{t('settings.privacy.consents')}</Heading>
      <Card>
        <Body bold>{t('settings.privacy.sensitiveTitle')}</Body>
        <Body>{hasArt9Consent ? t('settings.privacy.sensitiveOn', { count: sensitive.length }) : t('settings.privacy.sensitiveOff')}</Body>
        {hasArt9Consent ? (
          <Button label={t('settings.privacy.withdrawSensitive')} variant="danger" busy={withdraw.isPending} onPress={confirmWithdraw} />
        ) : (
          <Button label={t('settings.privacy.giveSensitive')} variant="secondary" onPress={() => router.push('/settings/sensitive-consent')} />
        )}
      </Card>
      <Card>
        <Body>{sameGender ? t('settings.privacy.genderOn') : t('settings.privacy.genderOff')}</Body>
        {sameGender ? (
          <Button
            label={t('settings.privacy.withdrawGender')}
            variant="secondary"
            busy={updateProfile.isPending}
            onPress={() => updateProfile.mutate({ prefs: { sameGenderOnly: false } })}
          />
        ) : null}
      </Card>
      {hasPhoto ? (
        <Button label={t('settings.privacy.deletePhoto')} variant="secondary" busy={deletePhoto.isPending} onPress={() => deletePhoto.mutate({})} />
      ) : null}

      <Heading>{t('settings.privacy.yourData')}</Heading>
      <Body muted>{t('settings.privacy.exportBody')}</Body>
      <Button label={t('settings.privacy.export')} busy={exportState === 'working'} onPress={() => void exportData()} />
      {exportState === 'requested' ? <Body>{t('settings.privacy.exportRequested')}</Body> : null}
      {exportState === 'linkSent' ? <Body>{t('settings.reauthLinkSent')}</Body> : null}
      {typeof exportState === 'object' ? <ErrorText>{exportState.error}</ErrorText> : null}

      <Heading>{t('settings.privacy.restrict')}</Heading>
      <Button label={t('settings.privacy.pause')} variant="secondary" busy={participation.isPending} onPress={() => participation.mutate({ mode: 'pause' })} />
      <LinkRow label={t('settings.delete.title')} onPress={() => router.push('/settings/delete-account')} />
      <LinkRow label={t('info.howMatchingWorks.title')} onPress={() => router.push('/info/how-matching-works')} />
      <Body muted>{t('settings.privacy.complaint')}</Body>
      {firstError ? <ErrorText>{t(errorMessageKey(firstError))}</ErrorText> : null}
    </Screen>
  );
}
