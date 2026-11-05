import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Body, Button, Checkbox, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { useBlocks, usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { clearImageCaches } from '@/features/account/clearDeviceData';
import { AuthenticatedPhoto } from '@/features/photos/AuthenticatedPhoto';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/** What the blocker chooses besides the block itself (§3.7): by default the blocked member is removed. */
type BlockChoice = 'removeThem' | 'leave' | 'replan';

/**
 * Member sheet (§3.7, F28): first name, photo and "about me"; report; block (two-way, immediate) with the choice to
 * leave instead and, once the meetup is scheduled (the blocked person knows the plan), to re-plan it; unblock.
 */
export default function MemberSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId, uid: memberUid } = useLocalSearchParams<{ podId: string; uid: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const pod = usePod(podId, isConfirmedMember(card.data));
  const blocks = useBlocks(uid);
  const block = useCallable('blockUser');
  const unblock = useCallable('unblockUser');
  const [choice, setChoice] = useState<BlockChoice>('removeThem');

  if (!pod.data) return <Loading label={t('common.loading')} />;
  const entry = pod.data.roster[memberUid];
  const isSelf = memberUid === uid;
  const name = entry?.firstName ?? '';
  const blocked = (blocks.data ?? []).some((b) => b.id === memberUid);
  const canReplan = pod.data.state === 'scheduled';
  const effective: BlockChoice = choice === 'replan' && !canReplan ? 'removeThem' : choice;

  const confirmBlock = () =>
    Alert.alert(t('member.blockTitle', { name }), t(effective === 'replan' ? 'member.blockBodyReplan' : 'member.blockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('member.block'),
        style: 'destructive',
        onPress: () =>
          block.mutate(
            { podId, uid: memberUid, ...(effective === 'leave' ? { leave: true } : {}), ...(effective === 'replan' ? { replan: true } : {}) },
            {
              onSuccess: () => {
                // Their photo leaves this device's caches now, not only at the next app open (§9 Photos).
                void clearImageCaches().catch(() => undefined);
                router.back();
              },
            },
          ),
      },
    ]);

  return (
    <Screen>
      {entry && entry.photoV !== null && !blocked ? (
        <AuthenticatedPhoto
          owner={memberUid}
          version={entry.photoV}
          size="full"
          accessibilityLabel={t('pod.photoOf', { name })}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }}
        />
      ) : null}
      <Heading>{entry?.firstName ?? t('member.formerMember')}</Heading>
      {entry?.aboutMe ? <Body>{entry.aboutMe}</Body> : null}
      {isSelf ? null : (
        <>
          <Button
            testID="member-report"
            label={t('member.report')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/sheets/report', params: { podId, uid: memberUid } })}
          />
          {blocked ? (
            <>
              <Body muted>{t('member.blockedAlready', { name })}</Body>
              <Button
                testID="member-unblock"
                label={t('settings.blocked.unblock')}
                variant="secondary"
                busy={unblock.isPending}
                onPress={() => unblock.mutate({ uid: memberUid })}
              />
              {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
            </>
          ) : (
            <>
              <Body muted>{t('member.blockExplainer')}</Body>
              <Checkbox
                testID="block-leave"
                label={t('member.leaveInstead')}
                checked={effective === 'leave'}
                onChange={(on) => setChoice(on ? 'leave' : 'removeThem')}
              />
              {canReplan ? (
                <Checkbox
                  testID="block-replan"
                  label={t('member.replan')}
                  checked={effective === 'replan'}
                  onChange={(on) => setChoice(on ? 'replan' : 'removeThem')}
                />
              ) : null}
              {canReplan ? <Body muted>{t('member.replanExplainer')}</Body> : null}
              <Button testID="member-block" label={t('member.block')} variant="danger" busy={block.isPending} onPress={confirmBlock} />
              {block.error ? <ErrorText>{t(errorMessageKey(block.error))}</ErrorText> : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
