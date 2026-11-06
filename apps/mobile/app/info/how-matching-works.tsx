import {
  DAY_MS,
  getMatchingProfile,
  NO_SHOW_PAUSE_MS,
  NO_SHOW_SUSPENSION_MS,
  NO_SHOW_WINDOW_WEEKS,
  REPORT_PAUSE_MS,
  REPORT_WINDOW_MS,
  SENSITIVE_HOLD_MS,
  UNDERAGE_PAUSE_MS,
} from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Banner, Card, Heading, ListRow, Text } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { IconBullet, IconListCard, NoteBox, PageLede, ShellPage } from '@/features/shell/parts';

const USED = ['interests', 'area', 'age', 'prefs', 'reliability'] as const;
const days = (ms: number) => Math.round(ms / DAY_MS);
const weeks = (ms: number) => Math.round(ms / (7 * DAY_MS));

/**
 * "How matching works" (§11, PRIVACY.md §4.4, §13): the inputs used (drop-why's mint ticks) and not used (its grey
 * "What we never use" box), meet-again effects, the rules for private (sensitive) themes in drop-why's purple box,
 * every automated pause with its length (from the same constants the server applies), that no person reviews these
 * decisions and what that means, and that matching can be paused at any time: signed in, a row that opens Me, where
 * "Weekly drops" has "Pause matching"; signed out (the page is public), the same sentence as a note.
 */
export default function HowMatchingWorks() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useSession().phase === 'ready';
  const meetAgainWeeks = getMatchingProfile('launch').defaults.h5.meetAgainWeeks;
  const pauses = [
    t('info.howMatchingWorks.pauseList.reports', { window: days(REPORT_WINDOW_MS), days: days(REPORT_PAUSE_MS) }),
    t('info.howMatchingWorks.pauseList.underage', { days: days(UNDERAGE_PAUSE_MS) }),
    t('info.howMatchingWorks.pauseList.noShow', { window: NO_SHOW_WINDOW_WEEKS, weeks: weeks(NO_SHOW_PAUSE_MS), suspension: weeks(NO_SHOW_SUSPENSION_MS) }),
    t('info.howMatchingWorks.pauseList.notGenuine', { days: days(SENSITIVE_HOLD_MS) }),
  ];
  return (
    <ShellPage title={t('info.howMatchingWorks.title')} testID="how-matching-works">
      <PageLede>{t('info.howMatchingWorks.intro')}</PageLede>

      <IconListCard title={t('info.howMatchingWorks.usedTitle')}>
        {USED.map((k) => (
          <IconBullet key={k} icon="check">
            {t(`info.howMatchingWorks.used.${k}`)}
          </IconBullet>
        ))}
        <IconBullet icon="people">{t('info.howMatchingWorks.meetAgain', { weeks: meetAgainWeeks })}</IconBullet>
      </IconListCard>

      <NoteBox title={t('info.howMatchingWorks.neverTitle')}>{t('info.howMatchingWorks.notUsed')}</NoteBox>

      <Banner tone="private" icon="lock" title={t('info.howMatchingWorks.sensitiveTitle')}>
        {t('info.howMatchingWorks.sensitive')}
      </Banner>

      <IconListCard title={t('info.howMatchingWorks.pausesTitle')}>
        <Text variant="small" color="textSecondary">
          {t('info.howMatchingWorks.pauses')}
        </Text>
        {pauses.map((line) => (
          <IconBullet key={line} icon="pause" tone="warning">
            {line}
          </IconBullet>
        ))}
      </IconListCard>

      <Card gap={8}>
        <Heading>{t('info.howMatchingWorks.reviewTitle')}</Heading>
        <Text variant="small" color="textBody">
          {t('info.howMatchingWorks.noReview')}
        </Text>
        <Text variant="small" color="textBody">
          {t('info.howMatchingWorks.humanReview')}
        </Text>
      </Card>

      {signedIn ? (
        <ListRow
          testID="pause-link"
          icon="pause"
          label={t('info.howMatchingWorks.pauseLink')}
          detail={t('info.howMatchingWorks.pause')}
          onPress={() => router.dismissTo('/me')}
        />
      ) : (
        <Banner tone="mint" icon="pause">
          {t('info.howMatchingWorks.pause')}
        </Banner>
      )}
    </ShellPage>
  );
}
