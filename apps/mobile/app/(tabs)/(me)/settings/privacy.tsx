import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { AppText, Button, ErrorText, ListGroup, Loading, Row, Screen, ScreenHeader } from '@/components/ui';
import { useBlocks, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { ExportRequestMessage, ExportStatus, useExportRequest } from '@/features/account/ExportStatus';
import { art9WithdrawCopy } from '@/features/consent/art9';
import { useUid } from '@/features/session/SessionProvider';
import { rowDetail, RowWithDetail, SettingsRow } from '@/features/settings/parts';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * Me → Privacy (storyboard 5.3; §11, PRIVACY.md §6). "What you've agreed to": private interests (a link to the
 * Interests tab, 5.2, plus the blanket Art. 9 consent withdrawn here in one tap with the withdrawal copy, §3.5),
 * same-gender pods (gender deleted when turned off, §3.6) and the photo (a link to the photo page, where it is added,
 * changed or deleted). "Your data and matching", the storyboard's four rows: pause (restriction, Art. 18), the export
 * with its authenticated download (§3.9), blocked people, how matching works. Then Delete account (§3.10) and the
 * complaint line. Skipping one drop and messages from Grouper live on Me (and This week / Settings).
 *
 * A page of the Me tab's stack (/settings/privacy): the tab bar with Me active is the way back, so, as in the
 * storyboard, there is no back chevron. Its sub-pages (photo, blocked people, Delete account…) open over the tabs.
 */
export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const blocks = useBlocks(uid).data;
  const withdraw = useCallable('withdrawArt9Consent');
  const updateProfile = useCallable('updateProfile');
  const participation = useCallable('setParticipation');
  const exportRequest = useExportRequest();

  const hasArt9Consent = user.data?.legal.art9 !== undefined;
  const confirmWithdraw = () =>
    Alert.alert(t('settings.privacy.withdrawSensitive'), art9WithdrawCopy(currentLocale()), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.privacy.withdrawSensitive'), style: 'destructive', onPress: () => withdraw.mutate({}) },
    ]);
  const sameGender = user.data?.prefs.sameGenderOnly === true;
  const hasPhoto = user.data?.photo !== null && user.data?.photo !== undefined;
  const pausedUntil = user.data?.participation.pausedUntil?.toMillis();
  const firstError = withdraw.error ?? updateProfile.error ?? participation.error;
  // Private interests are managed on the Interests tab (5.2): a switch of tabs, which keeps Privacy in the Me tab.
  const openInterests = () => router.navigate('/interests');

  const pauseStatus =
    pausedUntil !== undefined
      ? t('settings.privacy.pausedUntil', { when: formatDateTime(pausedUntil, currentLocale()) })
      : user.data?.status === 'paused'
        ? t('settings.privacy.paused')
        : t('settings.privacy.pauseHint');
  // "Applies from week …" once the pause has been set.
  const pauseSubtitle = participation.data ? `${pauseStatus} ${t('me.effectiveFrom', { week: participation.data.effectiveWeekId })}` : pauseStatus;

  if (!user.data) return <Loading label={t('common.loading')} />;
  const blockedCount = blocks?.length;
  const blockedDetail =
    blockedCount === undefined ? undefined : blockedCount === 0 ? t('settings.privacy.blockedNone') : t('settings.privacy.blockedCount', { count: blockedCount });

  return (
    <Screen>
      <ScreenHeader eyebrow={t('tabs.me')} title={t('settings.privacy.title')} />

      <ListGroup title={t('settings.privacy.agreedTo')}>
        <RowWithDetail
          row={
            <Row
              testID="private-interests"
              title={t('settings.privacy.privateInterests')}
              subtitle={hasArt9Consent ? t('settings.privacy.privateOn', { count: sensitive.length }) : t('settings.privacy.privateOff')}
              onPress={openInterests}
              accessibilityRole="link"
              chevron
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

        {/* Storyboard 5.3 links the photo to its page (1.7); adding, changing and deleting it happen there. */}
        <Row
          testID="photo-settings"
          title={t('me.photo')}
          subtitle={hasPhoto ? t('settings.privacy.photoShown') : t('settings.privacy.photoNone')}
          onPress={() => router.push('/settings/photo')}
          accessibilityRole="link"
          chevron
        />
      </ListGroup>

      <ListGroup title={t('settings.privacy.dataAndMatching')}>
        <SettingsRow
          testID="pause"
          icon="pause"
          title={t('settings.privacy.pauseTitle')}
          subtitle={pauseSubtitle}
          busy={participation.isPending}
          onPress={() => participation.mutate({ mode: 'pause' })}
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
