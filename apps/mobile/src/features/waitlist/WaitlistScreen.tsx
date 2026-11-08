import { waitlistDisplay, waitlistProgress } from '@grouper/core';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTabScreenOptions } from '@/components/navigation';
import { usePalette } from '@/components/theme';
import { Button, Card, Eyebrow, Heading, ListRow, PageHeader, ProgressBar, Screen, Text } from '@/components/ui';
import { useStoryboardTop } from '@/features/onboarding/OnboardingStep';
import { cityLink } from './cityLink';

export interface WaitlistScreenProps {
  readonly areaId: string;
  readonly city: string;
  /** `areas/{areaId}.waitlistCount`: the exact city total, shown as "<10" below 10. */
  readonly count: number;
  readonly goal: number;
}

/** A link this long does not fit beside "Copy" on one line (e.g. "grouper-prod.firebaseapp.com/c/odense"). */
const ONE_LINE_LINK = 26;

/**
 * The per-city waitlist (city-waitlist; DESIGN.md §3.1 step 13, F34): Home shows this on every app open while the
 * user's launch area is not live. The counter is the server-maintained city total; sharing sends only the city link
 * and a fixed text (no referral code, nothing about who shared it).
 *
 * As on the storyboard, the page stands alone: no tab bar while the city is closed ("this screen stays until then").
 * The interests are one tap away ("While you wait"), and a quiet link at the bottom opens Me, where the profile,
 * privacy settings, notices and account deletion live; the tab bar is back there.
 */
export function WaitlistScreen({ areaId, city, count, goal }: WaitlistScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [copied, setCopied] = useState(false);
  const top = useStoryboardTop();
  useHiddenTabBar();
  const link = cityLink(areaId);
  // Shown without the scheme, as on the storyboard ("grouper.dk/c/odense"). A short link sits on one line; a long
  // one (the Firebase Hosting domain, until there is a short custom one) puts the host and the city path on two lines
  // in 12 px, so neither is cut off beside "Copy"/"Kopiér" and the field keeps its 44 px.
  const shownLink = link.replace(/^https?:\/\//, '');
  const slash = shownLink.indexOf('/');
  const [host, path] = slash < 0 ? [shownLink, ''] : [shownLink.slice(0, slash), shownLink.slice(slash)];
  const twoLines = shownLink.length > ONE_LINE_LINK;
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
      <PageHeader eyebrow={t('waitlist.eyebrow')} title={t('waitlist.title', { city })} />

      <Card variant="panel" testID="waitlist-card">
        <Eyebrow>{t('waitlist.cardTitle', { city })}</Eyebrow>
        <View style={styles.counter} accessible accessibilityLabel={counter}>
          <Text variant="counter" color="text" style={styles.counterNumber}>
            {String(shown)}
          </Text>
          <Text variant="cardTitle" weight="400" color="textMuted">
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
        <Text variant="small" color="textSecondary">
          {t('waitlist.next', { city, goal })}
        </Text>
      </Card>

      <Card radius={22} padding={18} gap={12}>
        <Text accessibilityRole="header" variant="numeral">
          {t('waitlist.shareTitle', { city })}
        </Text>
        <Text variant="small" color="textSecondary">
          {t('waitlist.shareBody')}
        </Text>
        <Button testID="waitlist-share" label={t('waitlist.share')} icon="share" onPress={() => void share()} style={styles.shareButton} />
        <View style={styles.linkRow}>
          <View
            testID="waitlist-link"
            style={[styles.link, { backgroundColor: p.inset }]}
            accessible
            accessibilityLabel={shownLink}
          >
            {twoLines ? (
              <>
                <Text variant="micro" color="textSecondary" numberOfLines={1} ellipsizeMode="middle" style={styles.linkLine}>
                  {host}
                </Text>
                <Text variant="micro" color="textSecondary" numberOfLines={1} style={styles.linkLine}>
                  {path}
                </Text>
              </>
            ) : (
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {shownLink}
              </Text>
            )}
          </View>
          <Button
            testID="waitlist-copy"
            label={copied ? t('waitlist.copied') : t('waitlist.copy')}
            accessibilityLabel={copied ? t('waitlist.copied') : t('waitlist.copyLink')}
            variant="outline"
            size="sm"
            onPress={() => void copy()}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <Heading>{t('waitlist.whileYouWait')}</Heading>
        <ListRow testID="waitlist-interests" label={t('waitlist.moreInterests')} onPress={() => router.push('/interests')} />
      </View>

      {/* Where the storyboard has its prototype link: the way to Me (profile, privacy, delete account) without the tab bar. */}
      <Pressable
        testID="waitlist-me"
        accessibilityRole="link"
        accessibilityLabel={t('waitlist.profileAndSettings')}
        onPress={() => router.push('/me')}
        style={({ pressed }) => [styles.meLink, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="caption" color="textMuted" style={styles.underline}>
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
  counter: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  // The storyboard sets the 48 px number at the font's normal line height.
  counterNumber: { lineHeight: 60 },
  // The storyboard's share button is 52 px (r26).
  shareButton: { minHeight: 52 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 12 px sides; the longest host (grouper-staging.firebaseapp.com, ~198 px in 12 px) fits beside "Kopiér".
  link: { flex: 1, minWidth: 0, height: 44, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center' },
  linkLine: { lineHeight: 16 },
  section: { gap: 8 },
  // 13/400, muted and underlined, centred, 44 px tall: the storyboard's footer link.
  meLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
