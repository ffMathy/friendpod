import { DECLINE_REASONS, type PodCardDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ChipRow, ErrorText, Heading, Toggle } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { currentLocale } from '@/i18n';

type DeclineReason = (typeof DECLINE_REASONS)[number];

/**
 * The weekly proposal (§3.2): theme in the viewer's own wording (lock if sensitive), size and area,
 * "about N km or less", age span and shared interests for ordinary themes only, and the deadline.
 * Never names, photos, gender or who has accepted.
 */
export function ProposalCard({ podId, card }: { podId: string; card: PodCardDoc }) {
  const { t } = useTranslation();
  const router = useRouter();
  const respond = useCallable('respondToPod');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);
  const near = card.reasons.find((r) => r.code === 'NEAR_YOU');
  const alsoShare = card.reasons.find((r) => r.code === 'ALSO_SHARE');
  const theme = card.themeLabel ?? t('pods.openToAnyone');

  return (
    <Card>
      <Heading>{card.themeSensitive ? `🔒 ${theme}` : theme}</Heading>
      <Body>{t('pods.sizeAndArea', { size: card.sizeTarget, area: card.areaLabel })}</Body>
      {near && near.code === 'NEAR_YOU' ? <Body>{t('pods.nearYou', { km: near.km })}</Body> : null}
      {!card.themeSensitive && card.ageSpan ? <Body>{t('pods.ageSpan', card.ageSpan)}</Body> : null}
      {!card.themeSensitive && alsoShare && alsoShare.code === 'ALSO_SHARE' ? (
        <Body>{t('pods.alsoShare', { list: alsoShare.yourWordings.join(', ') })}</Body>
      ) : null}
      <Body muted>{t('pods.acceptBy', { when: formatDateTime(card.acceptBy.toMillis(), currentLocale()) })}</Body>
      {card.myStatus === 'accepted' ? <Body bold>{t('pods.acceptedCount', { accepted: card.acceptedCount, size: card.sizeTarget })}</Body> : null}
      {respond.error ? <ErrorText>{t(errorMessageKey(respond.error))}</ErrorText> : null}

      {card.myStatus === 'invited' && !declining ? (
        <>
          <Button label={t('pods.accept')} busy={respond.isPending} onPress={() => respond.mutate({ podId, accept: true })} />
          <Button label={t('pods.decline')} variant="secondary" onPress={() => setDeclining(true)} />
        </>
      ) : null}
      {declining ? (
        <>
          <Body muted>{t('pods.declineReasonPrompt')}</Body>
          <ChipRow>
            {DECLINE_REASONS.map((r) => (
              <Toggle key={r} label={t(`pods.declineReasons.${r}`)} value={reason === r} onChange={(on) => setReason(on ? r : undefined)} />
            ))}
          </ChipRow>
          <Button
            label={t('pods.confirmDecline')}
            variant="danger"
            busy={respond.isPending}
            onPress={() => respond.mutate({ podId, accept: false, ...(reason ? { reason } : {}) })}
          />
          <Button label={t('common.cancel')} variant="secondary" onPress={() => setDeclining(false)} />
        </>
      ) : null}
      <Button label={t('pods.whyThisPod')} variant="secondary" onPress={() => router.push({ pathname: '/sheets/why-this-pod', params: { podId } })} />
    </Card>
  );
}
