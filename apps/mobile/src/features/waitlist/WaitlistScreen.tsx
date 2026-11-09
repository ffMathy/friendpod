import { waitlistDisplay, waitlistProgress } from '@grouper/core';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTabScreenOptions } from '@/components/navigation';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import { Button, Card, Eyebrow, Heading, Icon, ProgressBar, Screen, Text, Title } from '@/components/ui';
import { useStoryboardTop } from '@/features/onboarding/OnboardingStep';
import { cityLink } from './cityLink';

export interface WaitlistScreenProps {
  readonly areaId: string;
  readonly city: string;
  /** `areas/{areaId}.waitlistCount`: the exact city total, shown as "<10" below 10. */
  readonly count: number;
  readonly goal: number;
}

/**
 * The per-city waitlist (city-waitlist; DESIGN.md §3.1 step 13, F34): Home shows this on every app open while the
 * user's launch area is not live. The counter is the server-maintained city total; sharing sends only the city link
 * and a fixed text (no referral code, nothing about who shared it).
 *
 * Calm, as the storyboard draws it (not a poster moment: no field, no mark): "You're on the list" over the Title, a
 * white card with the count in Display L and the Skov progress bar, a white card to share the invite link (Skov) or
 * copy it, and "While you wait". The page stands alone: no tab bar while the city is closed ("this screen stays until
 * then"). The interests are one tap away, and a quiet link at the bottom opens Me, where the profile, privacy
 * settings, notices and account deletion live; the tab bar is back there.
 */
export function WaitlistScreen({ areaId, city, count, goal }: WaitlistScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [copied, setCopied] = useState(false);
  // The storyboard's tab-screen top (40 px) where there is no status bar; under one, 16.
  const top = useStoryboardTop(24);
  useHiddenTabBar();
  const link = cityLink(areaId);
  // Shown without the scheme, as on the storyboard: "friendpod.dk/c/odense" on one line beside "Copy"/"Kopiér".
  const shownLink = link.replace(/^https?:\/\//, '');
  const shown = waitlistDisplay(count);
  const progress = waitlistProgress(count, goal);
  const counter = t('waitlist.counter', { n: shown, goal });

  const share = async () => {
    try {
      await Share.share({ message: t('waitlist.shareMessage', { city, link }), url: link, title: t('waitlist.shareSheetTitle', { city }) });
    } catch {
      // Dismissed or unavailable: nothing to do.
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
  };

  return (
    <Screen safeTop gutter="compact" gap={16} contentStyle={{ paddingTop: 16 + top }}>
      <View style={styles.header}>
        <Text variant="smallStrong" color="textMuted">
          {t('waitlist.eyebrow')}
        </Text>
        <Title>{t('waitlist.title', { city })}</Title>
      </View>

      <Card testID="waitlist-card">
        <Eyebrow>{t('waitlist.cardTitle', { city })}</Eyebrow>
        <View style={styles.counter} accessible accessibilityLabel={counter}>
          <Text variant="displayL">{String(shown)}</Text>
          <Text variant="cardTitle" weight="600" color="textMuted">
            {t('waitlist.ofGoal', { goal })}
          </Text>
        </View>
        <ProgressBar
          testID="waitlist-progress"
          value={progress}
          height={10}
          color="primary"
          trackColor="track"
          accessibilityLabel={t('waitlist.progressLabel', { city })}
          accessibilityValue={{ min: 0, max: goal, now: Math.min(count, goal) }}
        />
        <Text variant="small" color="textSecondary" style={styles.prose}>
          {t('waitlist.next', { city, goal })}
        </Text>
      </Card>

      <Card>
        <Text accessibilityRole="header" variant="cardTitle">
          {t('waitlist.shareTitle', { city })}
        </Text>
        <Text variant="small" color="textSecondary" style={styles.prose}>
          {t('waitlist.shareBody')}
        </Text>
        <Button testID="waitlist-share" label={t('waitlist.share')} icon="share" size="md" fullWidth onPress={() => void share()} />
        <View style={styles.linkRow}>
          <View testID="waitlist-link" style={[styles.link, { backgroundColor: p.inset }]} accessible accessibilityLabel={shownLink}>
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1} ellipsizeMode="middle">
              {shownLink}
            </Text>
          </View>
          <Button
            testID="waitlist-copy"
            label={copied ? t('waitlist.copied') : t('waitlist.copy')}
            accessibilityLabel={copied ? t('waitlist.copied') : t('waitlist.copyLink')}
            variant="secondary"
            size="input"
            onPress={() => void copy()}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <Heading>{t('waitlist.whileYouWait')}</Heading>
        <Pressable
          testID="waitlist-interests"
          accessibilityRole="link"
          onPress={() => router.push('/interests')}
          style={({ pressed }) => [styles.row, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text variant="rowTitle" style={styles.flex}>
            {t('waitlist.moreInterests')}
          </Text>
          <Icon name="chevronRight" size={20} color={p.textMuted} />
        </Pressable>
      </View>

      {/* Where the storyboard has its prototype link: the way to Me (profile, privacy, delete account) without the tab bar. */}
      <Pressable
        testID="waitlist-me"
        accessibilityRole="link"
        accessibilityLabel={t('waitlist.profileAndSettings')}
        onPress={() => router.push('/me')}
        style={({ pressed }) => [styles.meLink, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="captionStrong" color="textMuted" style={styles.underline}>
          {t('waitlist.profileAndSettings')}
        </Text>
      </Pressable>
    </Screen>
  );
}

/**
 * Hides the tab's header (the page draws its own title) and the tab bar while the waitlist is shown, and gives the
 * bar back when it unmounts (the city went live, or the user left the area). Options set from a screen outlive it,
 * so the bar's own style is restored explicitly.
 */
function useHiddenTabBar() {
  const navigation = useNavigation();
  const { tabBarStyle } = useTabScreenOptions();
  const shown = useRef<StyleProp<ViewStyle>>(tabBarStyle);
  shown.current = tabBarStyle;
  useLayoutEffect(() => {
    // `setOptions` is typed for the generic navigator; these are bottom-tab options.
    const setOptions = navigation.setOptions as (options: { headerShown?: boolean; tabBarStyle?: StyleProp<ViewStyle> }) => void;
    setOptions({ headerShown: false, tabBarStyle: { display: 'none' } });
    return () => setOptions({ tabBarStyle: shown.current });
  }, [navigation]);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: 4 },
  counter: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  // 14/1.5, as the storyboard sets the cards' paragraphs.
  prose: { lineHeight: 21 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // A read-only field: Paper, 52 px, radius 14, 15 px text, beside the 52 px Copy button. The public link is short
  // (the longest, "friendpod.dk/c/copenhagen", is ~170 px), so it sits on one line beside "Kopieret" too.
  link: { flex: 1, minWidth: 0, height: Size.inputCompact, borderRadius: Radius.md, paddingHorizontal: 14, justifyContent: 'center' },
  section: { gap: 8 },
  // "Add a few more interests": a white row, radius 22, 1 px Line, min 52, 16/600 with a chevron.
  row: {
    minHeight: 52,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.hairline,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // 13/600 Muted, underlined, centred, 44 px tall: the storyboard's footer link.
  meLink: { alignSelf: 'center', minHeight: Size.hitTarget, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
