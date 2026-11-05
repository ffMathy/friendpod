import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Screen } from '@/components/ui';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { AuthCancelled } from '@/features/auth/errors';
import { signInWithGoogle } from '@/features/auth/google';

/** §3.1 step 2: Apple (iOS), Google or an email link; no SMS (F10). */
export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setApple);
  }, []);

  const run = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    setFailed(false);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      // The session guard moves on to onboarding or the tabs.
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Body>{t('auth.signIn.intro')}</Body>
      {apple ? (
        <Button label={t('auth.signIn.apple')} busy={busy === 'apple'} disabled={busy !== null} onPress={() => void run('apple')} />
      ) : null}
      <Button label={t('auth.signIn.google')} busy={busy === 'google'} disabled={busy !== null} onPress={() => void run('google')} />
      <Button label={t('auth.signIn.email')} variant="secondary" disabled={busy !== null} onPress={() => router.push('/email')} />
      {failed ? <ErrorText>{t('auth.signIn.failed')}</ErrorText> : null}
      <Body muted>{t('auth.signIn.legalHint')}</Body>
    </Screen>
  );
}
