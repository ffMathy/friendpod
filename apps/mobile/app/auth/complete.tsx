import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Field, Screen } from '@/components/ui';
import { completeEmailLink, isEmailLink, pendingEmail } from '@/features/auth/emailLink';
import { useEmulators } from '@/lib/env';

/**
 * Email-link completion (§11). Reached through `+native-intent` with the incoming URL in `link`. If the
 * link was opened on another device (no stored address), the user confirms the address. In emulator
 * builds the Auth emulator prints links instead of sending them, so a link can be pasted here.
 */
export default function CompleteEmailLink() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ link?: string }>();
  const [link, setLink] = useState(params.link ?? '');
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [state, setState] = useState<'idle' | 'working' | 'invalid' | 'failed'>('idle');

  const complete = async (url: string, address: string) => {
    if (!isEmailLink(url)) {
      setState('invalid');
      return;
    }
    setState('working');
    try {
      await completeEmailLink(url, address);
      router.replace('/');
    } catch {
      setState('failed');
    }
  };

  useEffect(() => {
    if (!params.link) return;
    void pendingEmail().then((stored) => {
      if (stored) void complete(params.link as string, stored);
      else setNeedsEmail(true);
    });
    // Runs once per incoming link.
  }, [params.link]);

  return (
    <Screen>
      <Body>{t('auth.complete.body')}</Body>
      {useEmulators && !params.link ? (
        <Field label={t('auth.complete.pasteLink')} value={link} onChangeText={setLink} autoCapitalize="none" />
      ) : null}
      {needsEmail || (useEmulators && !params.link) ? (
        <Field label={t('auth.email.label')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      ) : null}
      {needsEmail || (useEmulators && !params.link) ? (
        <Button
          label={t('auth.complete.continue')}
          busy={state === 'working'}
          disabled={link.length === 0 || email.trim().length === 0}
          onPress={() => void complete(link, email.trim())}
        />
      ) : null}
      {state === 'invalid' ? <ErrorText>{t('auth.complete.invalid')}</ErrorText> : null}
      {state === 'failed' ? <ErrorText>{t('auth.complete.failed')}</ErrorText> : null}
    </Screen>
  );
}
