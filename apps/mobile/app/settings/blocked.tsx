import { useTranslation } from 'react-i18next';
import { Avatar, Banner, Button, ErrorText, ListGroup, Loading, Row, Screen, ScreenHeader } from '@/components/ui';
import { useBlocks } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useUid } from '@/features/session/SessionProvider';
import { useBack } from '@/features/settings/useBack';
import { errorMessageKey } from '@/lib/errors';

/** Blocked users, with the first name the user saw in that pod (empty if it was never confirmed). */
export default function Blocked() {
  const { t } = useTranslation();
  const back = useBack('/settings/privacy');
  const blocks = useBlocks(useUid());
  const unblock = useCallable('unblockUser');
  if (blocks.isLoading) return <Loading label={t('common.loading')} />;
  const rows = blocks.data ?? [];
  return (
    <Screen>
      <ScreenHeader title={t('settings.blocked.title')} backLabel={t('common.back')} onBack={back} />
      {rows.length === 0 ? (
        <Banner tone="subtle" icon="block">
          {t('settings.blocked.none')}
        </Banner>
      ) : (
        <ListGroup>
          {rows.map(({ id, data }) => (
            <Row
              key={id}
              title={data.firstName || t('settings.blocked.unnamed')}
              leading={<Avatar name={data.firstName} uid={id} size={40} placeholder={!data.firstName} />}
              trailing={
                <Button
                  label={t('settings.blocked.unblock')}
                  variant="secondary"
                  size="sm"
                  inline
                  busy={unblock.isPending && unblock.variables.uid === id}
                  onPress={() => unblock.mutate({ uid: id })}
                />
              }
            />
          ))}
        </ListGroup>
      )}
      {unblock.error ? <ErrorText>{t(errorMessageKey(unblock.error))}</ErrorText> : null}
    </Screen>
  );
}
