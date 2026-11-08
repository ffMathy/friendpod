import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Lede, Screen, TextField, Title } from '@/components/ui';
import { AuthHeader } from '@/features/auth/AuthHeader';
import { pendingEmail, sendEmailLink } from '@/features/auth/emailLink';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email magic link (F10), reached from "Continue with email" on the welcome screen, or from "Send a new link" when a
 * link did not work. Laid out like the onboarding steps (the welcome logo behind a back chevron, 30/800 title, lede,
 * field, the action pinned at the bottom). The address is kept in secure storage on this phone until the link is
 * opened; if one is still there (a link was asked for before), the field starts with it.
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
    <Screen
      safeTop
      gap={24}
      header={<AuthHeader onBack={back} />}
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
      <View style={styles.titleBlock}>
        <Title>{t('auth.email.title')}</Title>
        <Lede>{t('auth.email.intro')}</Lede>
      </View>
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
        <Banner tone="info" icon="check" title={t('auth.email.sentTitle')} alert>
          {t('auth.email.sent', { email: sentTo })}
        </Banner>
      ) : null}
      {state === 'failed' ? (
        <Banner tone="safety" icon="info" alert>
          {t('auth.email.failed')}
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 8 },
});
