import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Banner, Button, Illustration, Logo, Screen, Text, TextField, TextLink, Title } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { completeEmailLink, isEmailLink, pendingEmail } from '@/features/auth/emailLink';
import { useEmulators } from '@/lib/env';

/**
 * Email-link completion (§11). Reached through `+native-intent` with the incoming URL in `link`. If the
 * link was opened on another device (no stored address), the user confirms the address. In emulator
 * builds the Auth emulator prints links instead of sending them, so a link can be pasted here.
 * Drawn like the welcome screen (logo, 30/800 title, lede); the native header is hidden.
 */
export default function CompleteEmailLink() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
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
  // With a stored address there is nothing to correct: an error ends here, with a way back to the start.
  const dead = error !== null && !askEmail;

  const title = askEmail ? t('auth.complete.confirmTitle') : dead ? t('auth.complete.errorTitle') : t('auth.complete.title');
  const lede = askEmail ? t('auth.complete.confirmBody') : dead ? error : t('auth.complete.body');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        safeTop
        gap={24}
        header={
          <View style={styles.headerRow}>
            <Logo size="md" />
          </View>
        }
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
              <TextLink label={t('auth.complete.restart')} align="center" onPress={() => router.replace('/')} />
            </>
          ) : dead ? (
            <Button variant="outline" label={t('auth.complete.restart')} onPress={() => router.replace('/')} />
          ) : undefined
        }
      >
        {/* Progress and the dead end are drawn like the welcome screen: the mint art, then the title, centred. */}
        <View style={askEmail ? styles.titleBlock : styles.centred}>
          {askEmail ? null : <Illustration variant="welcome" />}
          <View style={styles.titleBlock}>
            <Title>{title}</Title>
            {/* An error is announced (it replaces the progress line once the link has been tried). */}
            <Text variant="lede" color="textMuted" accessibilityRole={dead ? 'alert' : undefined}>
              {lede}
            </Text>
          </View>
          {!askEmail && !dead ? <ActivityIndicator size="large" color={p.primary} accessibilityLabel={t('auth.complete.body')} style={styles.spinner} /> : null}
        </View>
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
          <Banner tone="danger" icon="info" alert>
            {error}
          </Banner>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  titleBlock: { gap: 8 },
  centred: { flexGrow: 1, justifyContent: 'center', gap: 20 },
  spinner: { alignSelf: 'flex-start' },
});
