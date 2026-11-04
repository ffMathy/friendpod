import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { useBlocks } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/** Blocked users, with the first name the user saw in that pod (empty if it was never confirmed). */
export default function Blocked() {
  const { t } = useTranslation();
  const blocks = useBlocks(useUid());
  const unblock = useCallable('unblockUser');
  if (blocks.isLoading) return <Loading label={t('common.loading')} />;
  const rows = blocks.data ?? [];
  return (
    <Screen>
      {rows.length === 0 ? <Body muted>{t('settings.blocked.none')}</Body> : null}
      {rows.map(({ id, data }) => (
        <Card key={id}>
          <Body bold>{data.firstName || t('settings.blocked.unnamed')}</Body>
          <Button label={t('settings.blocked.unblock')} variant="secondary" onPress={() => unblock.mutate({ uid: id })} />
        </Card>
      ))}
      {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
    </Screen>
  );
}
