import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Body, Button, Checkbox, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/** Member sheet (§3.7): block (two-way, immediate) and report. */
export default function MemberSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId, uid: memberUid } = useLocalSearchParams<{ podId: string; uid: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const pod = usePod(podId, isConfirmedMember(card.data));
  const block = useCallable('blockUser');
  const [leaveInstead, setLeaveInstead] = useState(false);

  if (!pod.data) return <Loading label={t('common.loading')} />;
  const entry = pod.data.roster[memberUid];
  const isSelf = memberUid === uid;

  const confirmBlock = () =>
    Alert.alert(t('member.blockTitle', { name: entry?.firstName ?? '' }), t('member.blockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('member.block'),
        style: 'destructive',
        onPress: () =>
          block.mutate({ podId, uid: memberUid, ...(leaveInstead ? { leave: true } : {}) }, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <Screen>
      {entry && entry.photoV !== null ? (
        <AuthenticatedPhoto
          owner={memberUid}
          version={entry.photoV}
          size="full"
          accessibilityLabel={t('pod.photoOf', { name: entry.firstName })}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }}
        />
      ) : null}
      <Heading>{entry?.firstName ?? t('member.formerMember')}</Heading>
      {isSelf ? null : (
        <>
          <Button
            label={t('member.report')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/sheets/report', params: { podId, uid: memberUid } })}
          />
          <Checkbox label={t('member.leaveInstead')} checked={leaveInstead} onChange={setLeaveInstead} />
          <Body muted>{t('member.blockExplainer')}</Body>
          <Button label={t('member.block')} variant="danger" busy={block.isPending} onPress={confirmBlock} />
          {block.error ? <ErrorText>{t(errorMessageKey(block.error))}</ErrorText> : null}
        </>
      )}
    </Screen>
  );
}
