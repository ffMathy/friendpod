import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Note, TextField } from '@/components/ui';
import { AuthStep } from '@/features/auth/AuthStep';
import { pendingEmail, sendEmailLink } from '@/features/auth/emailLink';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email magic link (F10), reached from "Continue with email" on the welcome screen, or from "Send a new link" when a
 * link did not work. A calm pushed step on Paper (`AuthStep`: back chevron, title, lede), the field, and the action
 * pinned at the bottom. The address is kept in secure storage on this phone until the link is opened; if one is still
 * there (a link was asked for before), the field starts with it.
 */
export default function EmailSignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sentTo, setSentTo] = useState('');
  const valid = EMAIL.test(email.trim());

  useEffect(() => {
    let live = true;
    void pendingEmail()
      .then((stored) => {
        // Never overwrite what the person has started typing.
        if (live && stored) setEmail((typed) => (typed === '' ? stored : typed));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const send = async () => {
    setState('sending');
    try {
      await sendEmailLink(email);
      setSentTo(email.trim());
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <AuthStep
      title={t('auth.email.title')}
      lede={t('auth.email.intro')}
      onBack={back}
      footer={
        <Button
          testID="send-email-link"
          label={state === 'sent' ? t('auth.email.resend') : t('auth.email.send')}
          disabled={!valid}
          busy={state === 'sending'}
          onPress={() => void send()}
        />
      }
    >
      <TextField
        label={t('auth.email.label')}
        placeholder={t('auth.email.placeholder')}
        helper={t('auth.email.helper')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (valid && state !== 'sending') void send();
        }}
      />
      {state === 'sent' ? (
        <Note tone="info" icon="check" title={t('auth.email.sentTitle')} alert>
          {t('auth.email.sent', { email: sentTo })}
        </Note>
      ) : null}
      {state === 'failed' ? (
        <Note tone="safety" icon="alert" alert>
          {t('auth.email.failed')}
        </Note>
      ) : null}
    </AuthStep>
  );
}
