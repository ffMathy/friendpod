import type { Locale } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Text as RNText, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Display, Lede, Logo, Screen, SegmentedControl, Text } from '@/components/ui';
import { BorderWidth, Layout, Radius, Size, usePalette, type PaletteKey } from '@/components/theme';
import { consumeAccountDeleted } from '@/features/account/account';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { AuthCancelled } from '@/features/auth/errors';
import { signInWithGoogle } from '@/features/auth/google';
import { currentLocale, initI18n } from '@/i18n';

/** Main.dc.html: the logo sits 56 px below the top of the 844 px frame, status bar included. */
const TOP = 56;
/** Main.dc.html gaps: 28 between the blocks, 20 inside the intro. */
const GAP = 28;
const INTRO_GAP = 20;
/** The hero is 220 px tall on the storyboard; on a short screen it gives up to 60 px so the legal line stays in view. */
const HERO = { width: 342, height: 220, min: 160 } as const;

type LegalDoc = 'terms' | 'privacy';
type Part = 'screen' | 'top' | 'banner' | 'copy' | 'actions';

/**
 * §3.1 steps 1–2 on one screen (Main.dc.html): the UI language follows the device and can be switched here, then
 * Apple (iOS only, F25), Google or an email link; no SMS (F10). Also confirms an account deletion (§3.10).
 */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const locale = currentLocale();
  const [deleted] = useState(consumeAccountDeleted);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [failed, setFailed] = useState(false);
  const [parts, setParts] = useState<Partial<Record<Part, number>>>({});

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

  const padTop = Math.max(TOP - insets.top, 8);
  const padBottom = Math.max(insets.bottom, Layout.bottom);
  // The storyboard's one-screen layout runs about 46 px past an 844 pt screen, which would push the Terms line below
  // the fold. Everything but the hero keeps its size: the hero takes what is left (160–220 px), and only a screen too
  // short even for that scrolls.
  const { screen, top, banner = 0, copy, actions } = parts;
  const measured = screen !== undefined && top !== undefined && copy !== undefined && actions !== undefined && (!deleted || banner > 0);
  const room = measured
    ? screen - insets.top - padTop - padBottom - (top + GAP + (deleted ? banner + GAP : 0) + INTRO_GAP + copy + GAP + actions)
    : HERO.height;
  const heroHeight = Math.round(Math.min(HERO.height, Math.max(HERO.min, room)));

  return (
    <View style={styles.flex} onLayout={measure('screen')}>
      <Screen safeTop gap={GAP} contentStyle={{ paddingTop: padTop, paddingBottom: padBottom }}>
        <View style={styles.topRow} onLayout={measure('top')}>
          <Logo size="md" />
          <SegmentedControl<Locale>
            accessibilityLabel={t('welcome.language')}
            options={[
              { value: 'da', label: t('languages.da') },
              { value: 'en', label: t('languages.en') },
            ]}
            value={locale}
            onChange={(l) => initI18n(l)}
          />
        </View>

        {deleted ? (
          <View onLayout={measure('banner')}>
            <Banner tone="mint" icon="check">
              {t('settings.delete.done')}
            </Banner>
          </View>
        ) : null}

        <View style={styles.intro}>
          <Hero height={heroHeight} />
          <View style={styles.copy} onLayout={measure('copy')}>
            <Display>{t('welcome.headline')}</Display>
            <Lede>{t('welcome.body')}</Lede>
            <AdultsOnly label={t('welcome.adultsOnly')} />
          </View>
        </View>

        <View style={styles.actions} onLayout={measure('actions')}>
          {failed ? (
            <Banner tone="danger" icon="info" alert>
              {t('auth.signIn.failed')}
            </Banner>
          ) : null}
          {apple ? (
            <Button variant="dark" label={t('auth.signIn.apple')} busy={busy === 'apple'} disabled={busy !== null} onPress={() => void run('apple')} />
          ) : null}
          <Button variant="outline" label={t('auth.signIn.google')} busy={busy === 'google'} disabled={busy !== null} onPress={() => void run('google')} />
          <Button variant="outline" label={t('auth.signIn.email')} disabled={busy !== null} onPress={() => router.push('/email')} />
          <LegalLine onOpen={openLegal} />
        </View>
      </Screen>
    </View>
  );
}

type Dot = { x: number; y: number; d: number; color: PaletteKey };

/** Main.dc.html's five people-dots on mint, positions on the 342 × 220 artboard. */
const DOTS: readonly Dot[] = [
  { x: 56, y: 42, d: 72, color: 'primary' },
  { x: 150, y: 24, d: 92, color: 'accent' },
  { x: 260, y: 70, d: 64, color: 'sage' },
  { x: 96, y: 128, d: 84, color: 'accentSoft' },
  { x: 204, y: 132, d: 70, color: 'leaf' },
];

/**
 * The welcome hero. The DS `Illustration` keeps its dots at full size and clips them when it is made shorter, so this
 * one scales the dot group about the hero's centre line instead: at 220 px it is the storyboard exactly.
 */
function Hero({ height }: { height: number }) {
  const p = usePalette();
  const s = height / HERO.height;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.hero, { height, backgroundColor: p.mint }]}
    >
      {DOTS.map((dot) => {
        const d = dot.d * s;
        const centre = HERO.width / 2 + (dot.x + dot.d / 2 - HERO.width / 2) * s;
        return (
          <View
            key={dot.color}
            style={[
              styles.dot,
              { left: `${(centre / HERO.width) * 100}%`, marginLeft: -d / 2, top: dot.y * s, width: d, height: d, borderRadius: d / 2, backgroundColor: p[dot.color] },
            ]}
          />
        );
      })}
    </View>
  );
}

/** "18+ only": 13/700 on white with a 1 px border, 30 px tall overall (the storyboard's 28 px box plus its border). */
function AdultsOnly({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.badge, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text variant="captionBold">{label}</Text>
    </View>
  );
}

/** "You accept the Terms before you start…": 13/1.5 muted, centred, with the two documents as inline links. */
function LegalLine({ onOpen }: { onOpen: (doc: LegalDoc) => void }) {
  const p = usePalette();
  // Inline links inherit the sentence's size and weight (the storyboard's plain <a>); WCAG 2.5.8 exempts targets
  // inside a sentence from the 44 px minimum.
  const link = (doc: LegalDoc) => <RNText accessibilityRole="link" onPress={() => onOpen(doc)} style={[styles.link, { color: p.primary }]} />;
  return (
    <Text variant="caption" color="textMuted" align="center" style={styles.legal}>
      <Trans i18nKey="welcome.legal" components={{ terms: link('terms'), privacy: link('privacy') }} />
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  intro: { flexGrow: 1, justifyContent: 'center', gap: INTRO_GAP },
  copy: { gap: INTRO_GAP },
  hero: { alignSelf: 'stretch', borderRadius: Radius.panel, overflow: 'hidden' },
  dot: { position: 'absolute' },
  badge: {
    alignSelf: 'flex-start',
    height: Size.badge + 2 * BorderWidth.hairline,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.hairline,
    justifyContent: 'center',
  },
  actions: { gap: 12 },
  legal: { marginTop: 6 },
  link: { textDecorationLine: 'underline' },
});
