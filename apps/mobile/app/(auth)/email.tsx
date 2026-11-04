import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Field, Screen } from '@/components/ui';
import { sendEmailLink } from '@/features/auth/emailLink';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email magic link (F10); the address is kept in secure storage until the link is opened. */
export default function EmailSignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const valid = EMAIL.test(email.trim());

  const send = async () => {
    setState('sending');
    try {
      await sendEmailLink(email);
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <Screen>
      <Field
        label={t('auth.email.label')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Button label={t('auth.email.send')} disabled={!valid} busy={state === 'sending'} onPress={() => void send()} />
      {state === 'sent' ? <Body>{t('auth.email.sent')}</Body> : null}
      {state === 'failed' ? <ErrorText>{t('auth.email.failed')}</ErrorText> : null}
    </Screen>
  );
}
