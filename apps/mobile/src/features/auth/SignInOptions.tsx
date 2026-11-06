import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, ErrorText } from '@/components/ui';
import { isAppleSignInAvailable, signInWithApple } from './apple';
import { AuthCancelled } from './errors';
import { signInWithGoogle } from './google';

/**
 * §3.1 step 2 (storyboard 1.1): Apple (iOS only, F25), Google or an email link; no SMS (F10). Apple is the ink main
 * action on iPhone; on Android, where Apple is never offered, Google takes that place. The storyboard's "Continue with …"
 * titles are ones Apple's and Google's button guidelines allow; the accessible names are the visible labels.
 */
export function SignInOptions({ onEmail }: { onEmail: () => void }) {
  const { t } = useTranslation();
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
    <View style={styles.list}>
      {apple ? (
        <Button label={t('auth.signIn.continueApple')} busy={busy === 'apple'} disabled={busy !== null} onPress={() => void run('apple')} />
      ) : null}
      <Button
        label={t('auth.signIn.continueGoogle')}
        // Decided by platform, not by `apple`, so the button does not change colour once the Apple check resolves.
        variant={Platform.OS === 'ios' ? 'secondary' : 'primary'}
        busy={busy === 'google'}
        disabled={busy !== null}
        onPress={() => void run('google')}
      />
      <Button label={t('auth.signIn.continueEmail')} variant="secondary" disabled={busy !== null} onPress={onEmail} />
      {failed ? <ErrorText>{t('auth.signIn.failed')}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
