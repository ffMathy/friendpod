import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, Card, ErrorText, Loading, Screen, Text, TextLink } from '@/components/ui';
import { useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { art9WithdrawCopy } from '@/features/consent/art9';
import { Art9ConsentActions, Art9ConsentBody, Art9ConsentHeading } from '@/features/consent/Art9BlanketConsent';
import { formatDay } from '@/features/interests/parts';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Me → Privacy → Private interests: the blanket Art. 9 consent (D3, PRIVACY.md §3.3, §3.5). Without it, the same
 * screen as onboarding step 3 (onb-consent): the locked copy, the unticked box, "I agree" and "Not now". With it, when
 * it was given and how many interests are private, the text it covers, and "Withdraw consent for sensitive
 * interests", confirmed with the locked withdrawal text: as easy to withdraw as to give, in the same place.
 */
export default function SettingsSensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const locale = currentLocale();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const [checked, setChecked] = useState(false);
  const give = useCallable('setArt9Consent');
  const withdraw = useCallable('withdrawArt9Consent');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/privacy'));
  const readMore = () => router.push('/info/sensitive-interests');

  if (user.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Loading label={t('common.loading')} />
      </>
    );
  }
  const art9 = user.data?.legal.art9;
  const top = { paddingTop: Math.max(8, 24 - insets.top) };

  if (!art9) {
    return (
      <Screen
        safeTop
        gap={14}
        contentStyle={top}
        footer={
          <Art9ConsentActions
            locale={locale}
            checked={checked}
            onCheck={setChecked}
            busy={give.isPending}
            error={give.error ? t(errorMessageKey(give.error)) : null}
            onAgree={(consent) => give.mutate({ consent }, { onSuccess: back })}
            onNotNow={back}
          />
        }
      >
        <Stack.Screen options={{ headerShown: false }} />
        <BackButton onPress={back} accessibilityLabel={t('common.back')} />
        <Art9ConsentHeading locale={locale} />
        <Art9ConsentBody locale={locale} onReadMore={readMore} />
      </Screen>
    );
  }

  const confirmWithdraw = () =>
    Alert.alert(t('settings.privacy.withdrawSensitive'), art9WithdrawCopy(locale), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.privacy.withdrawSensitive'), style: 'destructive', onPress: () => withdraw.mutate({}, { onSuccess: back }) },
    ]);

  return (
    <Screen
      safeTop
      gap={14}
      contentStyle={top}
      footer={
        <>
          {withdraw.error ? <ErrorText>{t(errorMessageKey(withdraw.error))}</ErrorText> : null}
          <Button
            testID="art9-withdraw"
            variant="danger"
            label={t('sensitiveConsent.withdraw')}
            busy={withdraw.isPending}
            onPress={confirmWithdraw}
          />
        </>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <BackButton onPress={back} accessibilityLabel={t('common.back')} />
      <Art9ConsentHeading locale={locale} />
      <Card variant="default" gap={6}>
        <Text variant="bodyStrong" color="textSecondary">
          {t('sensitiveConsent.givenOn', { date: formatDay(art9.at.toMillis(), locale) })}
        </Text>
        <Text variant="small" color="textSecondary">
          {t('sensitiveConsent.privateCount', { count: sensitive.length })}
        </Text>
        <TextLink compact label={t('sensitiveConsent.seeThem')} onPress={() => router.push('/interests')} />
      </Card>
      <Art9ConsentBody locale={locale} onReadMore={readMore} />
    </Screen>
  );
}
