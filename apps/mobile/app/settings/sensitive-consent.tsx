import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/components/theme';
import { BackButton, Button, Card, ErrorText, Icon, Loading, Screen, Text, TextLink } from '@/components/ui';
import { useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { art9WithdrawCopy } from '@/features/consent/art9';
import { Art9ConsentActions, Art9ConsentBox, Art9ConsentHeading } from '@/features/consent/Art9BlanketConsent';
import { formatDay } from '@/features/interests/parts';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/** Below this the copy box is too short to read in (a small phone, large text): the page then scrolls as one column. */
const MIN_BOX = 160;

/**
 * Me → Privacy → Private interests: the blanket Art. 9 consent (D3, PRIVACY.md §3.3, §3.5). Without it, the same
 * screen as onboarding step 3 (onb-consent): the "Private interests" eyebrow with the lock and the title, the locked
 * copy verbatim in its own white card with the 1.5 px Ink border (the onboarding card, scrolling inside), then the
 * unticked box, "I agree" and "Not now" pinned under it. With it, when it was given and how many interests are
 * private, the same card with the text it covers, and "Withdraw consent" (the 54 px danger outline with the trash
 * icon), confirmed with the locked withdrawal text: as easy to withdraw as to give, in the same place. Private stays
 * quiet: no colour anywhere on this screen. When the card gets too little room to read in, the page scrolls as one
 * column instead (the card as tall as its copy), as onboarding does.
 */
export default function SettingsSensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const locale = currentLocale();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const [checked, setChecked] = useState(false);
  const give = useCallable('setArt9Consent');
  const withdraw = useCallable('withdrawArt9Consent');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/privacy'));
  const readMore = () => router.push('/info/sensitive-interests');
  const { boxed, onBoxLayout } = useBoxFits();

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
  // Boxed: the page holds still and the copy scrolls inside its card, whose rounded bottom sits 12 px above the
  // footer (the footer's own top padding). Otherwise the card is as tall as the copy and the page scrolls.
  const box = boxed ? (
    <Art9ConsentBox locale={locale} onReadMore={readMore} onLayout={onBoxLayout} />
  ) : (
    <Art9ConsentBox locale={locale} onReadMore={readMore} scrollInside={false} />
  );
  const contentStyle = boxed ? [top, styles.boxedContent] : top;

  if (!art9) {
    const actions = (
      <Art9ConsentActions
        locale={locale}
        checked={checked}
        onCheck={setChecked}
        busy={give.isPending}
        error={give.error ? t(errorMessageKey(give.error)) : null}
        onAgree={(consent) => give.mutate({ consent }, { onSuccess: back })}
        onNotNow={back}
      />
    );
    return (
      <Screen safeTop gap={14} scroll={!boxed} contentStyle={contentStyle} footer={boxed ? actions : undefined}>
        <Stack.Screen options={{ headerShown: false }} />
        <BackButton onPress={back} accessibilityLabel={t('common.back')} />
        <Art9ConsentHeading locale={locale} />
        {box}
        {boxed ? null : actions}
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
      scroll={!boxed}
      contentStyle={contentStyle}
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
      {/* When it was given and what it covers now: a plain white card, a check for the given consent, no colour. */}
      <Card gap={4}>
        <View style={styles.given}>
          <Icon name="check" size={16} strokeWidth={2.4} color={p.text} />
          <Text variant="heading" style={styles.flex}>
            {t('sensitiveConsent.givenOn', { date: formatDay(art9.at.toMillis(), locale) })}
          </Text>
        </View>
        <Text variant="small" color="textSecondary" style={styles.indent}>
          {t('sensitiveConsent.privateCount', { count: sensitive.length })}
        </Text>
        <View style={styles.indent}>
          <TextLink label={t('sensitiveConsent.seeThem')} onPress={() => router.push('/interests')} />
        </View>
      </Card>
      {box}
    </Screen>
  );
}

/**
 * Whether the card gets enough room to read in (as onboarding's consent step). It is measured where it is laid out;
 * once too short it stays in the one-column layout until the window or the text size changes, when it is measured
 * again.
 */
function useBoxFits(): { readonly boxed: boolean; readonly onBoxLayout: (event: LayoutChangeEvent) => void } {
  const { height, fontScale } = useWindowDimensions();
  const room = `${height}:${fontScale}`;
  const [tooShortIn, setTooShortIn] = useState<string | null>(null);
  return {
    boxed: tooShortIn !== room,
    onBoxLayout: (event) => {
      if (event.nativeEvent.layout.height < MIN_BOX) setTooShortIn(room);
    },
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** The card ends on the footer's 12 px top padding, not on the content's own 16 px bottom padding as well. */
  boxedContent: { paddingBottom: 0 },
  given: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** In line with the text after the check (16 px icon + 6 px gap). */
  indent: { paddingLeft: 22 },
});
