import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { usePalette } from '@/components/theme';
import { Body, Button, ErrorText, Field, Screen, ScreenHeader } from '@/components/ui';
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
  const p = usePalette();
  const params = useLocalSearchParams<{ link?: string }>();
  const [link, setLink] = useState(params.link ?? '');
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [state, setState] = useState<'idle' | 'working' | 'invalid' | 'failed'>('idle');
  const showForm = needsEmail || (useEmulators && !params.link);
  // A link with a stored address completes by itself; the form's button shows its own progress.
  const autoCompleting = Boolean(params.link) && !needsEmail && (state === 'idle' || state === 'working');

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
    <>
      {/* The root stack gives this route a native bar; the page draws its own header instead. */}
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        wide
        gap={24}
        footer={
          showForm ? (
            <Button
              label={t('auth.complete.continue')}
              busy={state === 'working'}
              disabled={link.length === 0 || email.trim().length === 0}
              onPress={() => void complete(link, email.trim())}
            />
          ) : undefined
        }
      >
        <ScreenHeader
          title={t('auth.complete.title')}
          backLabel={router.canGoBack() ? t('common.back') : undefined}
          onBack={() => router.back()}
        />
        <Body muted>{t('auth.complete.body')}</Body>
        {autoCompleting ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.primary} /> : null}
        {useEmulators && !params.link ? (
          <Field label={t('auth.complete.pasteLink')} value={link} onChangeText={setLink} autoCapitalize="none" />
        ) : null}
        {showForm ? (
          <Field label={t('auth.email.label')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        ) : null}
        {state === 'invalid' ? <ErrorText>{t('auth.complete.invalid')}</ErrorText> : null}
        {state === 'failed' ? <ErrorText>{t('auth.complete.failed')}</ErrorText> : null}
      </Screen>
    </>
  );
}
