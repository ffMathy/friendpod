import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { AppText, Button, ErrorText, ListGroup, Loading, Row, Screen, ScreenHeader } from '@/components/ui';
import { useBlocks, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { ExportRequestMessage, ExportStatus, useExportRequest } from '@/features/account/ExportStatus';
import { art9WithdrawCopy } from '@/features/consent/art9';
import { useUid } from '@/features/session/SessionProvider';
import { rowDetail, RowWithDetail, SettingsRow } from '@/features/settings/parts';
import { useBack } from '@/features/settings/useBack';
import { useInTabs } from '@/features/settings/useInTabs';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * Me → Privacy (storyboard 5.3; §11, PRIVACY.md §6). "What you've agreed to": the blanket Art. 9 consent (withdrawn
 * here in one tap plus the withdrawal copy, §3.5), same-gender pods (gender deleted when turned off, §3.6) and the
 * photo. "Your data and matching": pause or skip (restriction, Art. 18), the export with its authenticated download
 * (§3.9), blocked people, messages from Grouper, how matching works. Then Delete account (§3.10) and the complaint line.
 */
export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/me');
  // Storyboard 5.3 has no back chevron: the tab bar with Me active is the way back. Keep the chevron while this stack is
  // shown over the tabs (no tab bar), so the screen is never a dead end.
  const inTabs = useInTabs();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const blocks = useBlocks(uid).data;
  const withdraw = useCallable('withdrawArt9Consent');
  const updateProfile = useCallable('updateProfile');
  const participation = useCallable('setParticipation');
  const deletePhoto = useCallable('deletePhoto');
  const exportRequest = useExportRequest();

  const hasArt9Consent = user.data?.legal.art9 !== undefined;
  const confirmWithdraw = () =>
    Alert.alert(t('settings.privacy.withdrawSensitive'), art9WithdrawCopy(currentLocale()), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.privacy.withdrawSensitive'), style: 'destructive', onPress: () => withdraw.mutate({}) },
    ]);
  const sameGender = user.data?.prefs.sameGenderOnly === true;
  const hasPhoto = user.data?.photo !== null && user.data?.photo !== undefined;
  const confirmDeletePhoto = () =>
    Alert.alert(t('settings.privacy.deletePhoto'), t('settings.privacy.deletePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.privacy.deletePhoto'),
        style: 'destructive',
        onPress: () => deletePhoto.mutate({}, { onSuccess: () => void clearImageCaches().catch(() => undefined) }),
      },
    ]);
  const pausedUntil = user.data?.participation.pausedUntil?.toMillis();
  const skipWeek = user.data?.participation.skipWeekId;
  const firstError = withdraw.error ?? updateProfile.error ?? participation.error ?? deletePhoto.error;

  // "Applies from week …" goes under the row that was pressed last.
  const effective = participation.data ? t('me.effectiveFrom', { week: participation.data.effectiveWeekId }) : null;
  const lastMode = participation.data ? participation.variables?.mode : undefined;
  const pauseStatus =
    pausedUntil !== undefined
      ? t('settings.privacy.pausedUntil', { when: formatDateTime(pausedUntil, currentLocale()) })
      : user.data?.status === 'paused'
        ? t('settings.privacy.paused')
        : t('settings.privacy.pauseHint');
  const skipStatus = skipWeek ? t('settings.privacy.skipping', { week: skipWeek }) : t('settings.privacy.skipHint');
  const withEffective = (status: string, mode: 'pause' | 'skipNext') => (effective && lastMode === mode ? `${status} ${effective}` : status);

  if (!user.data) return <Loading label={t('common.loading')} />;
  const blockedCount = blocks?.length;
  const blockedDetail =
    blockedCount === undefined ? undefined : blockedCount === 0 ? t('settings.privacy.blockedNone') : t('settings.privacy.blockedCount', { count: blockedCount });

  return (
    <Screen>
      <ScreenHeader eyebrow={t('tabs.me')} title={t('settings.privacy.title')} backLabel={inTabs ? undefined : t('common.back')} onBack={inTabs ? undefined : back} />

      <ListGroup title={t('settings.privacy.agreedTo')}>
        <RowWithDetail
          row={
            <Row
              title={t('settings.privacy.privateInterests')}
              subtitle={hasArt9Consent ? t('settings.privacy.privateOn', { count: sensitive.length }) : t('settings.privacy.privateOff')}
            />
          }
        >
          {hasArt9Consent ? (
            <Button label={t('settings.privacy.withdrawSensitive')} variant="dangerSoft" size="sm" inline busy={withdraw.isPending} onPress={confirmWithdraw} />
          ) : (
            <Button label={t('settings.privacy.giveSensitive')} variant="secondary" size="sm" inline onPress={() => router.push('/settings/sensitive-consent')} />
          )}
        </RowWithDetail>

        <RowWithDetail
          row={
            <Row
              title={t('settings.privacy.sameGender')}
              subtitle={sameGender ? t('settings.privacy.sameGenderOn') : t('settings.privacy.sameGenderOff')}
              onPress={() => router.push('/settings/preferences')}
              accessibilityRole="link"
              chevron
            />
          }
        >
          {sameGender ? (
            <Button
              label={t('settings.privacy.withdrawGender')}
              variant="dangerSoft"
              size="sm"
              inline
              busy={updateProfile.isPending}
              onPress={() => updateProfile.mutate({ prefs: { sameGenderOnly: false } })}
            />
          ) : null}
        </RowWithDetail>

        <RowWithDetail row={<Row title={t('me.photo')} subtitle={hasPhoto ? t('settings.privacy.photoShown') : t('settings.privacy.photoNone')} />}>
          {hasPhoto ? (
            <Button
              testID="delete-photo"
              label={t('settings.privacy.deletePhoto')}
              variant="dangerSoft"
              size="sm"
              inline
              busy={deletePhoto.isPending}
              onPress={confirmDeletePhoto}
            />
          ) : null}
        </RowWithDetail>
      </ListGroup>

      <ListGroup title={t('settings.privacy.dataAndMatching')}>
        <SettingsRow
          testID="pause"
          icon="pause"
          title={t('settings.privacy.pauseTitle')}
          subtitle={withEffective(pauseStatus, 'pause')}
          busy={participation.isPending && participation.variables.mode === 'pause'}
          onPress={() => participation.mutate({ mode: 'pause' })}
        />
        <SettingsRow
          testID="skip-next"
          icon="calendar"
          title={t('settings.privacy.skipNext')}
          subtitle={withEffective(skipStatus, 'skipNext')}
          busy={participation.isPending && participation.variables.mode === 'skipNext'}
          onPress={() => participation.mutate({ mode: 'skipNext' })}
        />
        <View>
          <SettingsRow
            testID="export-request"
            icon="download"
            title={t('settings.privacy.export')}
            subtitle={t('settings.privacy.exportHint')}
            busy={exportRequest.state === 'working'}
            onPress={exportRequest.request}
          />
          <ExportRequestMessage state={exportRequest.state} style={rowDetail.inset} />
          <ExportStatus uid={uid} hidePending={exportRequest.state === 'requested'} style={rowDetail.inset} />
        </View>
        <SettingsRow icon="block" title={t('settings.blocked.title')} subtitle={blockedDetail} role="link" onPress={() => router.push('/settings/blocked')} />
        <SettingsRow icon="chat" title={t('notices.title')} role="link" onPress={() => router.push('/settings/notices')} />
        <SettingsRow icon="info" title={t('info.howMatchingWorks.title')} role="link" onPress={() => router.push('/info/how-matching-works')} />
      </ListGroup>

      <Button label={t('settings.delete.title')} variant="dangerSoft" icon="trash" onPress={() => router.push('/settings/delete-account')} />
      {firstError ? <ErrorText>{t(errorMessageKey(firstError))}</ErrorText> : null}
      <AppText variant="caption" tone="muted" align="center">
        {t('settings.privacy.complaint')}
      </AppText>
    </Screen>
  );
}
