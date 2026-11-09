import type { Locale } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Text as RNText, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Logo, Note, PodMark, PosterField, Text } from '@/components/ui';
import { font, Layout, typeStyle, usePalette } from '@/components/theme';
import { consumeAccountDeleted } from '@/features/account/account';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { AuthCancelled } from '@/features/auth/errors';
import { signInWithGoogle } from '@/features/auth/google';
import { LanguageSwitch } from '@/features/auth/LanguageSwitch';
import { useLightStatusBar } from '@/features/auth/useLightStatusBar';
import { currentLocale, initI18n } from '@/i18n';

/**
 * Main.dc.html: the Skov field starts at y = 0, under the status bar, and the logo row starts 8 px below the status bar
 * (52 px on the 844 px frame, which draws a 44 px status bar); 24 at the sides and bottom. The storyboard sets the
 * headline at 1.05 and the tagline at 1.2 (46.2 and 26.4 px a line), 0.8 px taller in all than the 46 and 26 of the type
 * tokens; the bottom padding takes up that 0.8 so the field still ends at 475 as drawn.
 */
const FIELD = { statusBar: 44, belowStatusBar: 8, bottom: 24.8 } as const;
/** Gaps inside the field: 8 above the poster mark's box, 12 above the headline, 10 above the tagline. */
const GAP = { hero: 8, headline: 12, tagline: 10 } as const;
/**
 * The poster mark's box is 202 px tall on the storyboard (the 220 px mark overhangs it by 3 px). On a screen too short
 * for the whole welcome it gives up height, down to 120, before anything has to scroll.
 */
const HERO = { height: 202, min: 120, mark: 220 } as const;
/** The Paper part under the field: padding 20 / 24 / 22, and at least 16 between the paragraph and the buttons. */
const BELOW = { top: 20, bottom: 22, minGap: 16 } as const;

type LegalDoc = 'terms' | 'privacy';
type Part = 'screen' | 'top' | 'copy' | 'intro' | 'actions';

/**
 * §3.1 steps 1–2 on one screen (Main.dc.html, a poster moment): the Skov house field with the lockup, the language
 * switch, the poster mark (your seat saved, dashed), "18+ only", the headline and the in-app tagline; then on Paper the
 * paragraph, Apple (iOS only, F25), Google or an email link (no SMS, F10) and the Terms line. The UI language follows
 * the device and can be switched here. Also confirms an account deletion (§3.10).
 */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const locale = currentLocale();
  const [deleted] = useState(consumeAccountDeleted);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [failed, setFailed] = useState(false);
  const [parts, setParts] = useState<Partial<Record<Part, number>>>({});
  useLightStatusBar();

  useEffect(() => {
    void isAppleSignInAvailable().then(setApple);
  }, []);

  const measure = useCallback(
    (part: Part) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setParts((prev) => (prev[part] === h ? prev : { ...prev, [part]: h }));
    },
    [],
  );

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

  const openLegal = (doc: LegalDoc) => router.push({ pathname: '/info/legal/[doc]', params: { doc } });

  // The preview (and any host without insets) reports 0: then the storyboard's own status bar stands in.
  const padTop = (insets.top > 0 ? insets.top : FIELD.statusBar) + FIELD.belowStatusBar;
  const padBottom = Math.max(insets.bottom, BELOW.bottom);
  // The whole welcome fits an 844 pt screen as drawn. On a shorter one the mark's box gives up height first (202 → 120)
  // so the buttons and the Terms line stay in view; only a screen too short even for that scrolls.
  const { screen, top, copy, intro, actions } = parts;
  const room =
    screen !== undefined && top !== undefined && copy !== undefined && intro !== undefined && actions !== undefined
      ? screen - (padTop + top + GAP.hero + GAP.headline + copy + FIELD.bottom) - (BELOW.top + intro + BELOW.minGap + actions + padBottom)
      : HERO.height;
  const heroHeight = Math.round(Math.min(HERO.height, Math.max(HERO.min, room)));
  const markWidth = Math.min(HERO.mark, Math.round(((heroHeight + 3) * 120) / 112));

  return (
    <View style={[styles.flex, { backgroundColor: p.page }]} onLayout={measure('screen')}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.grow} bounces={false} overScrollMode="never">
        <PosterField safeTop={false} gap={0} paddingBottom={FIELD.bottom} style={[styles.field, { paddingTop: padTop }]} testID="welcome-field">
          <View style={styles.topRow} onLayout={measure('top')}>
            <Logo size="md" ground="skov" />
            <LanguageSwitch
              accessibilityLabel={t('welcome.language')}
              options={[
                { value: 'da', label: t('languages.da') },
                { value: 'en', label: t('languages.en') },
              ]}
              value={locale}
              onChange={(l: Locale) => initI18n(l)}
            />
          </View>

          <View style={[styles.hero, { height: heroHeight }]}>
            <PodMark variant="poster" ground="skov" seat="saved" size={markWidth} />
            <AdultsOnly label={t('welcome.adultsOnly')} />
          </View>

          <View style={styles.copy} onLayout={measure('copy')}>
            <Display color="onHouse">{t('welcome.headline')}</Display>
            <Text variant="headline" color="onHouse" style={styles.tagline}>
              {t('welcome.tagline')}
            </Text>
          </View>
        </PosterField>

        <View style={[styles.below, { paddingBottom: padBottom }]}>
          <View style={styles.intro} onLayout={measure('intro')}>
            {deleted ? (
              <Note tone="info" icon="check">
                {t('settings.delete.done')}
              </Note>
            ) : null}
            <Text variant="body" color="textSecondary">
              {t('welcome.body')}
            </Text>
          </View>

          <View style={styles.actions} onLayout={measure('actions')}>
            {failed ? (
              <Note tone="safety" icon="alert" alert>
                {t('auth.signIn.failed')}
              </Note>
            ) : null}
            {apple ? (
              <Button variant="apple" label={t('auth.signIn.apple')} busy={busy === 'apple'} disabled={busy !== null} onPress={() => void run('apple')} />
            ) : null}
            <Button variant="secondary" label={t('auth.signIn.google')} busy={busy === 'google'} disabled={busy !== null} onPress={() => void run('google')} />
            <Button variant="secondary" label={t('auth.signIn.email')} disabled={busy !== null} onPress={() => router.push('/email')} />
            <LegalLine onOpen={openLegal} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** "18+ only": a white pill on the field, 32 px, Ink 13/800, at the bottom left of the mark's box. */
function AdultsOnly({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.adults, { backgroundColor: p.surface }]}>
      <RNText style={[typeStyle('captionBold', '800'), { color: p.text }]}>{label}</RNText>
    </View>
  );
}

/**
 * "You accept the Terms before you start…": 13 px Muted at the storyboard's 1.5 (19.5 px a line, not the caption's 20,
 * so the buttons above it sit where they are drawn), centred, the two documents as bold Skov-deep inline links.
 */
function LegalLine({ onOpen }: { onOpen: (doc: LegalDoc) => void }) {
  const p = usePalette();
  // Inline links inherit the sentence's size (the storyboard's <a>, 700); WCAG 2.5.8 exempts targets inside a sentence
  // from the 44 px minimum.
  const link = (doc: LegalDoc) => <RNText accessibilityRole="link" onPress={() => onOpen(doc)} style={[font('700'), styles.link, { color: p.link }]} />;
  return (
    <Text variant="caption" color="textMuted" align="center" style={styles.legal}>
      <Trans i18nKey="welcome.legal" components={{ terms: link('terms'), privacy: link('privacy') }} />
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  field: { paddingHorizontal: Layout.gutter },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hero: { marginTop: GAP.hero, alignItems: 'center', justifyContent: 'center' },
  adults: { position: 'absolute', left: 0, bottom: 2, height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
  copy: { marginTop: GAP.headline },
  tagline: { marginTop: GAP.tagline },
  below: { flexGrow: 1, paddingTop: BELOW.top, paddingHorizontal: Layout.gutter, justifyContent: 'space-between', gap: BELOW.minGap },
  intro: { gap: 16 },
  actions: { gap: 10 },
  legal: { marginTop: 4, lineHeight: 19.5 },
  link: { textDecorationLine: 'underline' },
});
