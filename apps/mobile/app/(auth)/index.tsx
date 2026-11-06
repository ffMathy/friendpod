import type { Locale } from '@grouper/core';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing, usePalette } from '@/components/theme';
import { AppText, Banner, Body, HeroCircles, Logo, Pill, Screen, Segmented, Title } from '@/components/ui';
import { consumeAccountDeleted } from '@/features/account/account';
import { SignInOptions } from '@/features/auth/SignInOptions';
import { currentLocale, initI18n } from '@/i18n';

/** Storyboard 1.1: 8 pt under the status bar (56 on the 844-pt canvas), 28 between the logo row, the story and the buttons. */
const PAD_TOP = Spacing.sm;
/** With the footer's own 12 pt on top this makes the storyboard's 28 between the "18+ only" chip and the first button. */
const PAD_BOTTOM = Spacing.md;
const SECTION_GAP = 28;
const STORY_GAP = Spacing.ml;
/** The storyboard's hero is 220 pt; on shorter screens it gives way so everything fits without scrolling. */
const HERO_MAX = 220;
const HERO_MIN = 120;

type Heights = { viewport: number; top: number; banner: number; copy: number };

/**
 * Storyboard 1.1, §3.1 steps 1–2: welcome and sign-in on one screen. The UI language follows the device and can be
 * switched here; confirms an account deletion (§3.10). The Terms are accepted in the next step (onboarding/terms), so
 * the footer only points to them: one centred caption with the Terms and the privacy notice as inline links.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = currentLocale();
  const [deleted] = useState(consumeAccountDeleted);
  const [h, setH] = useState<Heights>({ viewport: 0, top: 0, banner: 0, copy: 0 });
  const measure = (key: keyof Heights) => (e: LayoutChangeEvent) => {
    const value = e.nativeEvent.layout.height;
    setH((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  };
  // The hero takes what the space above the pinned buttons leaves once everything else is laid out, so the chip ends
  // above the first button in both languages. Below HERO_MIN (large text sizes, very small phones) the page scrolls.
  const free = h.viewport - PAD_TOP - PAD_BOTTOM - h.top - SECTION_GAP - (deleted ? h.banner + STORY_GAP : 0) - STORY_GAP - h.copy;
  const heroHeight = h.viewport > 0 && h.copy > 0 ? Math.min(HERO_MAX, Math.max(HERO_MIN, Math.floor(free))) : HERO_MAX;
  const openLegal = (doc: 'terms' | 'privacy') => router.push({ pathname: '/info/legal/[doc]', params: { doc } });

  return (
    <Screen
      wide
      scroll={false}
      contentStyle={styles.frame}
      footer={
        <View style={styles.actions}>
          <SignInOptions onEmail={() => router.push('/email')} />
          <AppText variant="caption" tone="muted" align="center" style={styles.legal}>
            <Trans
              t={t}
              i18nKey="auth.signIn.legalNote"
              components={{
                terms: <InlineLink onPress={() => openLegal('terms')} />,
                privacy: <InlineLink onPress={() => openLegal('privacy')} />,
              }}
            />
          </AppText>
        </View>
      }
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        alwaysBounceVertical={false}
        onLayout={measure('viewport')}
      >
        <View style={styles.top} onLayout={measure('top')}>
          <Logo />
          <Segmented<Locale>
            variant="track"
            options={[
              { value: 'da', label: t('languages.da') },
              { value: 'en', label: t('languages.en') },
            ]}
            value={locale}
            onChange={(l) => initI18n(l)}
          />
        </View>
        <View style={styles.story}>
          {deleted ? (
            <View onLayout={measure('banner')}>
              <Banner tone="mint" icon="check">
                {t('settings.delete.done')}
              </Banner>
            </View>
          ) : null}
          <HeroCircles height={heroHeight} />
          <View style={styles.copy} onLayout={measure('copy')}>
            <Title size="hero">{t('welcome.headline')}</Title>
            <Body muted>{t('welcome.body')}</Body>
            <Pill label={t('welcome.adultsOnly')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** A link inside a caption, as on storyboard 1.1: the caption's regular weight, primary green and underlined. */
function InlineLink({ onPress, children }: { onPress: () => void; children?: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="link" onPress={onPress} style={[styles.inlineLink, { color: p.primary }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Screen's own padding is replaced by the scroll view's, which needs the whole body to measure what is free.
  frame: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
  content: { flexGrow: 1, paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM, paddingHorizontal: Spacing.gutterWide, gap: SECTION_GAP },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.ms },
  story: { flexGrow: 1, justifyContent: 'center', gap: STORY_GAP },
  copy: { gap: STORY_GAP },
  actions: { gap: Spacing.ms },
  legal: { marginTop: Spacing.xs },
  inlineLink: { textDecorationLine: 'underline' },
});
