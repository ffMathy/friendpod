import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ErrorText, Heading, LinkRow, Loading, Screen, Toggle } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { isConfirmedMember } from '@/features/pods/membership';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * A pod (§3.4, §11): the proposal until confirmation, then first names, photos through grants (opt-in
 * per member in sensitive-themed pods, S6), the theme in the viewer's own wording, pod interests and the plan.
 */
export default function PodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const leave = useCallable('leavePod');
  const sharePhoto = useCallable('setPhotoSharing');
  const locale = currentLocale();

  if (card.isLoading) return <Loading label={t('common.loading')} />;
  if (!card.data) {
    return (
      <Screen>
        <Body>{t('pod.gone')}</Body>
      </Screen>
    );
  }
  const c = card.data;
  const theme = c.themeLabel ?? t('pods.openToAnyone');

  const confirmLeave = () =>
    Alert.alert(t('pod.leaveTitle'), t('pod.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pod.leave'), style: 'destructive', onPress: () => leave.mutate({ podId }, { onSuccess: () => router.back() }) },
    ]);

  return (
    <Screen>
      {c.themeSensitive ? <ScreenCaptureGuard /> : null}
      {!member ? (
        <ProposalCard podId={podId} card={c} />
      ) : (
        <>
          <Heading>{c.themeSensitive ? `🔒 ${theme}` : theme}</Heading>
          <Body muted>{t(`podState.${c.state}`)}</Body>
          {pod.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
          {pod.data ? (
            <>
              <Card>
                <Body bold>{t('pod.members')}</Body>
                {pod.data.memberUids.map((memberUid) => {
                  const entry = pod.data?.roster[memberUid];
                  if (!entry) return null;
                  return (
                    <View key={memberUid} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {entry.photoV !== null ? (
                        <AuthenticatedPhoto
                          owner={memberUid}
                          version={entry.photoV}
                          size="thumb"
                          accessibilityLabel={t('pod.photoOf', { name: entry.firstName })}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                      ) : null}
                      <LinkRow
                        label={memberUid === uid ? t('pod.you', { name: entry.firstName }) : entry.firstName}
                        onPress={() => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId, uid: memberUid } })}
                      />
                    </View>
                  );
                })}
              </Card>
              {pod.data.podInterests[locale].length > 0 ? (
                <Body>{t('pod.podInterests', { list: pod.data.podInterests[locale].join(', ') })}</Body>
              ) : null}
              {pod.data.planning.meetupAt ? (
                <Card>
                  <Body bold>{t('pod.meetup', { when: formatDateTime(pod.data.planning.meetupAt.toMillis(), locale) })}</Body>
                  {pod.data.planning.placeText ? <Body>{pod.data.planning.placeText}</Body> : null}
                </Card>
              ) : (
                <Body>{t('pod.planBy', { when: formatDateTime(pod.data.planning.deadline.toMillis(), locale) })}</Body>
              )}
            </>
          ) : null}

          {c.themeSensitive ? (
            <Toggle
              label={t('pod.showMyPhoto')}
              value={c.photoShared === true}
              onChange={(share) => sharePhoto.mutate({ podId, share })}
            />
          ) : null}
          {sharePhoto.error ? <ErrorText>{t(errorMessageKey(sharePhoto.error))}</ErrorText> : null}

          <Button label={t('pod.openPlanner')} onPress={() => router.push({ pathname: '/pod/[podId]/plan', params: { podId } })} />
          {c.state === 'happened' ? (
            <Button label={t('pod.giveFeedback')} onPress={() => router.push({ pathname: '/pod/[podId]/feedback', params: { podId } })} />
          ) : null}
          <LinkRow label={t('info.safety.title')} onPress={() => router.push('/info/safety')} />
          {c.state !== 'archived' ? <Button label={t('pod.leave')} variant="danger" busy={leave.isPending} onPress={confirmLeave} /> : null}
          {leave.error ? <ErrorText>{t(errorMessageKey(leave.error))}</ErrorText> : null}
        </>
      )}
    </Screen>
  );
}
