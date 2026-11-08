import { useTranslation } from 'react-i18next';
import { Card, Note, Text } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { IconBullet, IconHeading, IconListCard, PageLede, ShellPage } from '@/features/shell/parts';

type Tip = 'public' | 'transport' | 'tellFriend' | 'address' | 'leave' | 'drink' | 'report';
const BEFORE: readonly Tip[] = ['public', 'transport', 'tellFriend', 'address'];
const AT: readonly Tip[] = ['leave', 'drink', 'report'];
/** A tick is a "do"; a "never" gets the neutral no-entry sign, so it doesn't read as approval. */
const DONT: ReadonlySet<Tip> = new Set(['address']);

/**
 * "Meeting safely" (§4.5, pod-confirmed's safety note), shown at confirmation and at T−24 h: after-report's safety
 * alert "In danger right now? Call 112." (white, 1.5 px Danger border, phone icon), then the tips as drop-why's disc
 * ticks (the one "never" as a no-entry sign, so it doesn't read as approval), before and at the meetup. Signed in, it
 * ends with the pledge the user agreed to at onboarding, in onb-final's white "Our safety pledge" card with the shield
 * (as a reminder: there is nothing to tick here).
 */
export default function Safety() {
  const { t } = useTranslation();
  const signedIn = useSession().phase === 'ready';
  return (
    <ShellPage title={t('info.safety.title')} testID="safety">
      <PageLede>{t('info.safety.lede')}</PageLede>
      <Note tone="safety" title={t('info.safety.emergency')} />
      <IconListCard title={t('info.safety.beforeTitle')}>
        {BEFORE.map((tip) => (
          <IconBullet key={tip} icon={DONT.has(tip) ? 'block' : 'check'}>
            {t(`info.safety.tips.${tip}`)}
          </IconBullet>
        ))}
      </IconListCard>
      <IconListCard title={t('info.safety.atTitle')}>
        {AT.map((tip) => (
          <IconBullet key={tip} icon={DONT.has(tip) ? 'block' : 'check'}>
            {t(`info.safety.tips.${tip}`)}
          </IconBullet>
        ))}
      </IconListCard>
      {signedIn ? (
        <Card gap={8} testID="safety-pledge">
          <IconHeading icon="shield" title={t('onboarding.final.pledgeTitle')} />
          <Text variant="small" color="textSecondary">
            {t('onboarding.final.pledge')}
          </Text>
        </Card>
      ) : null}
    </ShellPage>
  );
}
