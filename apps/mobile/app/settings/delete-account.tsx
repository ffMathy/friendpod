import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Heading, Screen } from '@/components/ui';
import { deleteAccount } from '@/features/account/account';
import { AuthCancelled } from '@/features/auth/errors';
import { toAppError } from '@/firebase/callables';
import { errorMessageKey } from '@/lib/errors';

/** §3.10: explains what is deleted and the backup / Auth windows, re-authenticates, then deletes. */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'working' | 'linkSent' | { error: string }>('idle');

  const run = async () => {
    setState('working');
    try {
      const outcome = await deleteAccount();
      // On success the session ends and the guard returns to sign-in.
      if (outcome.kind === 'emailLinkSent') setState('linkSent');
    } catch (e) {
      if (e instanceof AuthCancelled) setState('idle');
      else setState({ error: t(errorMessageKey(toAppError(e))) });
    }
  };

  return (
    <Screen>
      <Heading>{t('settings.delete.heading')}</Heading>
      <Body>{t('settings.delete.what')}</Body>
      <Body>{t('settings.delete.windows')}</Body>
      <Button label={t('settings.delete.confirm')} variant="danger" busy={state === 'working'} onPress={() => void run()} />
      {state === 'linkSent' ? <Body>{t('settings.reauthLinkSent')}</Body> : null}
      {typeof state === 'object' ? <ErrorText>{state.error}</ErrorText> : null}
    </Screen>
  );
}
