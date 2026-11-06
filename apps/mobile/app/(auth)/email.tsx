import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Banner, Button, Lede, Screen, TextField, Title } from '@/components/ui';
import { sendEmailLink } from '@/features/auth/emailLink';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email magic link (F10), reached from "Continue with email" on the welcome screen; laid out like the onboarding
 * steps (back chevron, 30/800 title, lede, field, the action pinned at the bottom). The address is kept in secure
 * storage until the link is opened.
 */
export default function EmailSignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sentTo, setSentTo] = useState('');
  const valid = EMAIL.test(email.trim());

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
      header={
        <View style={styles.headerRow}>
          <BackButton onPress={back} accessibilityLabel={t('common.back')} />
        </View>
      }
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
        <Banner tone="mint" icon="check" title={t('auth.email.sentTitle')} alert>
          {t('auth.email.sent', { email: sentTo })}
        </Banner>
      ) : null}
      {state === 'failed' ? (
        <Banner tone="danger" icon="info" alert>
          {t('auth.email.failed')}
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleBlock: { gap: 8 },
});
