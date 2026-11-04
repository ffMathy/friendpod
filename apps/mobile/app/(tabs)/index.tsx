import { dropSchedule, nextDropWeek } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, Heading, Loading, Screen } from '@/components/ui';
import { usePodCards, useUserDoc } from '@/data/docs';
import { ProposalCard } from '@/features/pods/ProposalCard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { isUserSettingReason } from '@/lib/reasons';

/** "This week" (§3.2): the proposal card, or "No pod this week" with the reason and a tip, and the next drop. */
export default function ThisWeek() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const user = useUserDoc(uid);
  const cards = usePodCards(uid);
  if (user.isLoading || cards.isLoading) return <Loading label={t('common.loading')} />;

  const locale = currentLocale();
  const nextRelease = dropSchedule(nextDropWeek(Date.now())).releaseAt;
  const proposals = (cards.data ?? []).filter((c) => c.data.state === 'proposed' && c.data.myStatus !== 'declined');
  const lastDrop = user.data?.lastDrop ?? null;
  const reason = lastDrop?.outcome === 'unmatched' ? lastDrop.reason : undefined;

  return (
    <Screen>
      {proposals.map((c) => (
        <ProposalCard key={c.id} podId={c.id} card={c.data} />
      ))}
      {proposals.length === 0 ? (
        <Card>
          <Heading>{t('home.noPod')}</Heading>
          {reason ? <Body>{t(`unmatched.${reason}`)}</Body> : <Body>{t('home.noPodYet')}</Body>}
          {isUserSettingReason(reason) ? (
            <Button label={t('home.openPreferences')} variant="secondary" onPress={() => router.push('/settings/preferences')} />
          ) : null}
          <Body muted>{t('home.tip')}</Body>
        </Card>
      ) : null}
      <Body muted>{t('home.nextDrop', { when: formatDateTime(nextRelease, locale) })}</Body>
    </Screen>
  );
}
