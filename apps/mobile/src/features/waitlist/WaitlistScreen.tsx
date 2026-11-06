import { waitlistDisplay, waitlistProgress } from '@grouper/core';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';
import { Radius, usePalette } from '@/components/theme';
import { AppText, Button, Card, LinkRow, Screen, ScreenHeader, SectionTitle, StatCard } from '@/components/ui';
import { cityLink } from './cityLink';

export interface WaitlistScreenProps {
  readonly areaId: string;
  readonly city: string;
  /** `areas/{areaId}.waitlistCount`: the exact city total, shown as "<10" below 10. */
  readonly count: number;
  readonly goal: number;
}

/**
 * The per-city waitlist (DESIGN.md §3.1 step 13, F34; storyboard 1.8): Home shows this on every app open while the
 * user's launch area is not live. The counter is the server-maintained city total; sharing sends only the city link and
 * a fixed text. Go-live follows Q11, not the counter's goal, so the copy promises a notification, not a threshold.
 */
export function WaitlistScreen({ areaId, city, count, goal }: WaitlistScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [copied, setCopied] = useState(false);
  const link = cityLink(areaId);
  const shown = waitlistDisplay(count);

  const share = async () => {
    try {
      await Share.share({ message: t('waitlist.shareMessage', { city, link }), url: link, title: t('waitlist.shareTitle', { city }) });
    } catch {
      // Dismissed or unavailable: nothing to do.
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={t('waitlist.eyebrow')} title={t('waitlist.titleSoon', { city })} />

      <StatCard
        label={t('waitlist.label', { city })}
        value={String(shown)}
        suffix={t('waitlist.of', { goal })}
        progress={waitlistProgress(count, goal)}
        progressLabel={t('waitlist.progressLabel', { city })}
        progressValue={{ min: 0, max: goal, now: Math.min(count, goal) }}
        progressTestID="waitlist-progress"
      >
        {t('waitlist.explain', { city })}
      </StatCard>

      <Card radius="lg" padding={18} gap={12}>
        <AppText accessibilityRole="header" variant="headingSm">
          {t('waitlist.helpTitle', { city })}
        </AppText>
        <AppText variant="bodySm" tone="soft">
          {t('waitlist.helpBody')}
        </AppText>
        <Button label={t('waitlist.shareInvite')} variant="accent" icon="share" onPress={() => void share()} testID="waitlist-share" />
        <View style={styles.linkRow}>
          <View style={[styles.link, { backgroundColor: p.inset }]}>
            <AppText variant="bodySm" tone="soft" numberOfLines={1} ellipsizeMode="middle">
              {link.replace(/^https:\/\//, '')}
            </AppText>
          </View>
          <Button
            label={copied ? t('waitlist.copied') : t('waitlist.copyShort')}
            accessibilityLabel={copied ? t('waitlist.copied') : t('waitlist.copy')}
            variant="secondary"
            size="sm"
            inline
            onPress={() => void copy()}
            testID="waitlist-copy"
          />
        </View>
      </Card>

      <View style={styles.section}>
        <SectionTitle title={t('waitlist.whileYouWait')} />
        <LinkRow variant="card" label={t('home.addInterests')} onPress={() => router.navigate('/interests')} testID="waitlist-add-interests" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: Radius.md, paddingHorizontal: 12, justifyContent: 'center' },
  section: { gap: 8 },
});
