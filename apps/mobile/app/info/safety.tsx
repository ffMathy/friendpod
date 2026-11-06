import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Banner, Card, Heading, Icon, Text } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { IconBullet, IconListCard, PageLede, ShellPage } from '@/features/shell/parts';

type Tip = 'public' | 'transport' | 'tellFriend' | 'address' | 'leave' | 'drink' | 'report';
const BEFORE: readonly Tip[] = ['public', 'transport', 'tellFriend', 'address'];
const AT: readonly Tip[] = ['leave', 'drink', 'report'];
/** A tick is a "do"; a "never" gets the neutral no-entry sign, so it doesn't read as approval. */
const DONT: ReadonlySet<Tip> = new Set(['address']);

/**
 * "Meeting safely" (§4.5, pod-confirmed's safety note), shown at confirmation and at T−24 h: the tips as drop-why's
 * mint ticks (the one "never" as a grey no-entry sign), before and at the meetup, and after-report's red "In danger
 * right now? Call 112.". Signed in, it ends with the pledge the user agreed to at onboarding, in onb-final's mint
 * "Our safety pledge" card (as a reminder: there is nothing to tick here).
 */
export default function Safety() {
  const { t } = useTranslation();
  const p = usePalette();
  const signedIn = useSession().phase === 'ready';
  return (
    <ShellPage title={t('info.safety.title')} testID="safety">
      <PageLede>{t('info.safety.lede')}</PageLede>
      <Banner tone="danger" title={t('info.safety.emergency')} />
      <IconListCard title={t('info.safety.beforeTitle')}>
        {BEFORE.map((tip) => (
          <IconBullet key={tip} icon={DONT.has(tip) ? 'block' : 'check'} tone={DONT.has(tip) ? 'neutral' : 'mint'}>
            {t(`info.safety.tips.${tip}`)}
          </IconBullet>
        ))}
      </IconListCard>
      <IconListCard title={t('info.safety.atTitle')}>
        {AT.map((tip) => (
          <IconBullet key={tip} icon={DONT.has(tip) ? 'block' : 'check'} tone={DONT.has(tip) ? 'neutral' : 'mint'}>
            {t(`info.safety.tips.${tip}`)}
          </IconBullet>
        ))}
      </IconListCard>
      {signedIn ? (
        <Card variant="mint" gap={8} testID="safety-pledge">
          <View style={styles.pledgeTitle}>
            <Icon name="shield" size={20} color={p.onMint} />
            <Heading>{t('onboarding.final.pledgeTitle')}</Heading>
          </View>
          <Text variant="small" color="mintBody">
            {t('onboarding.final.pledge')}
          </Text>
        </Card>
      ) : null}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  pledgeTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
