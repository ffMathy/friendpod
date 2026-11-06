import { waitlistDisplay, waitlistProgress } from '@grouper/core';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { Body, Button, Card, Heading, ProgressBar, Screen } from '@/components/ui';
import { cityLink } from './cityLink';

export interface WaitlistScreenProps {
  readonly areaId: string;
  readonly city: string;
  /** `areas/{areaId}.waitlistCount`: the exact city total, shown as "<10" below 10. */
  readonly count: number;
  readonly goal: number;
}

/**
 * The per-city waitlist (DESIGN.md §3.1 step 12): Home shows this on every app open while the user's launch area is not
 * live. The counter is the server-maintained city total; sharing sends only the city link and a fixed text.
 */
export function WaitlistScreen({ areaId, city, count, goal }: WaitlistScreenProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = cityLink(areaId);
  const shown = waitlistDisplay(count);
  const progress = waitlistProgress(count, goal);

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
      <Heading>{t('waitlist.title', { city })}</Heading>
      <Card>
        <Body bold>{t('waitlist.counter', { n: shown, goal })}</Body>
        <ProgressBar
          testID="waitlist-progress"
          value={progress}
          height={10}
          color="accent"
          accessibilityLabel={t('waitlist.counter', { n: shown, goal })}
          accessibilityValue={{ min: 0, max: goal, now: Math.min(count, goal) }}
        />
      </Card>
      <Card>
        <Body bold>{t('waitlist.nextTitle')}</Body>
        <Body>{t('waitlist.next', { city })}</Body>
      </Card>
      <Body muted>{t('waitlist.shareIntro', { city })}</Body>
      <Button label={t('waitlist.share')} onPress={() => void share()} testID="waitlist-share" />
      <Button label={copied ? t('waitlist.copied') : t('waitlist.copy')} variant="secondary" onPress={() => void copy()} testID="waitlist-copy" />
    </Screen>
  );
}
