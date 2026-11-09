import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Button, Note, TextField, TextLink } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { AuthStep } from '@/features/auth/AuthStep';
import { completeEmailLink, isEmailLink, pendingEmail } from '@/features/auth/emailLink';
import { useSession } from '@/features/session/SessionProvider';
import { useEmulators } from '@/lib/env';

/**
 * Email-link completion (§11). Reached through `+native-intent` with the incoming URL in `link`. If the
 * link was opened on another device (no stored address), the user confirms the address. In emulator
 * builds the Auth emulator prints links instead of sending them, so a link can be pasted here.
 * Drawn like /email, the step before it (`AuthStep`: title and lede on Paper, actions pinned at the bottom), without a
 * back chevron: the link opens this screen on its own. The native header is hidden.
 */
export default function CompleteEmailLink() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { phase } = useSession();
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

  const manual = useEmulators && !params.link;
  const askEmail = needsEmail || manual;
  const error = state === 'invalid' ? t('auth.complete.invalid') : state === 'failed' ? t('auth.complete.failed') : null;
  // With a stored address there is nothing to correct here: an error ends in a new link (the email step, which starts
  // with the stored address) or a way back to the start.
  const dead = error !== null && !askEmail;
  // A signed-in person re-authenticating (export, deletion) gets a new link from the action that asked for it, and
  // the email step is for signed-out people only.
  const offerNewLink = dead && phase === 'signedOut';

  const title = askEmail ? t('auth.complete.confirmTitle') : dead ? t('auth.complete.errorTitle') : t('auth.complete.title');
  const lede = askEmail ? t('auth.complete.confirmBody') : dead ? (error ?? '') : t('auth.complete.body');
  const restart = () => router.replace('/');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthStep
        title={title}
        lede={lede}
        // An error is announced (it replaces the progress line once the link has been tried).
        ledeAlert={dead}
        footer={
          askEmail ? (
            <>
              <Button
                label={t('auth.complete.continue')}
                busy={state === 'working'}
                disabled={link.length === 0 || email.trim().length === 0}
                onPress={() => void complete(link, email.trim())}
              />
              {/* A link opened on the wrong phone, or an address the person no longer remembers: a way out. */}
              <TextLink label={t('auth.complete.restart')} align="center" onPress={restart} />
            </>
          ) : offerNewLink ? (
            <>
              <Button label={t('auth.complete.newLink')} onPress={() => router.replace('/email')} />
              <TextLink label={t('auth.complete.restart')} align="center" onPress={restart} />
            </>
          ) : dead ? (
            <Button label={t('auth.complete.restart')} onPress={restart} />
          ) : undefined
        }
      >
        {/* Ink 2, not Skov: the spinner is not something to tap. */}
        {!askEmail && !dead ? (
          <ActivityIndicator size="large" color={p.textSecondary} accessibilityLabel={t('auth.complete.title')} style={styles.spinner} />
        ) : null}
        {manual ? <TextField label={t('auth.complete.pasteLink')} value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} /> : null}
        {askEmail ? (
          <TextField
            label={t('auth.email.label')}
            placeholder={t('auth.email.placeholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
        ) : null}
        {askEmail && error ? (
          <Note tone="safety" icon="alert" alert>
            {error}
          </Note>
        ) : null}
      </AuthStep>
    </>
  );
}

const styles = StyleSheet.create({
  spinner: { alignSelf: 'flex-start' },
});
