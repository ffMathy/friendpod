import { currentLegalText, fillTag, type Locale, type ModerationReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Body, Button, Card, ChipButton, ChipRow, ErrorText, Field, Heading, Toggle } from '@/components/ui';
import { useAreaDoc, useInterests, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { useAddInterest, warmUpEmbedder, type AddInterestOutcome } from './useAddInterest';

const MAX_STARRED = 3;

interface Props {
  readonly uid: string;
  readonly locale: Locale;
  /** Onboarding shows the add flow and the list only; the Interests tab also manages holdings. */
  readonly mode: 'onboarding' | 'full';
}

type MessageKey =
  | `moderation.${ModerationReason}`
  | 'interests.discarded'
  | 'interests.added'
  | 'interests.thirdPartyWarning'
  | 'interests.madePrivate'
  | 'interests.duplicate'
  | 'interests.limit'
  | 'interests.starLimit';

/** Input-time rejections are rendered from the reason code (DSA Art. 17); nothing is stored. */
function outcomeMessage(outcome: AddInterestOutcome): MessageKey {
  if (outcome.kind === 'rejected') return `moderation.${outcome.code}`;
  if (outcome.kind === 'discarded') return 'interests.discarded';
  const r = outcome.result;
  switch (r.status) {
    case 'added':
      return r.warning === 'THIRD_PARTY' ? 'interests.thirdPartyWarning' : 'interests.added';
    case 'madePrivate':
      return 'interests.madePrivate';
    case 'duplicate':
      return 'interests.duplicate';
    case 'limit':
      return 'interests.limit';
    case 'rejected':
      return r.reasonCode ? `moderation.${r.reasonCode}` : 'moderation.BLOCKLIST';
    case 'needsConsent':
      return 'interests.discarded';
  }
}

/**
 * Interests (§3.1 step 7, §11 Interests tab): the standing notice, on-device checks and consent sheet
 * before sending, ordinary holdings (star, remove, "Keep this private") and the sensitive section
 * (lock, "Remove & withdraw").
 */
export function InterestManager({ uid, locale, mode }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [suggestion, setSuggestion] = useState<{ interestId: string; conceptId: string; label: string } | null>(null);
  const { add, pending, error } = useAddInterest();
  const interests = useInterests(uid);
  const sensitive = useSensitiveInterests(uid);
  const user = useUserDoc(uid);
  const area = useAreaDoc(user.data?.area.areaId ?? null);
  const star = useCallable('updateInterest');
  const remove = useCallable('removeInterest');
  const withdraw = useCallable('withdrawSensitive');
  const confirmSuggestion = useCallable('confirmSuggestion');

  useEffect(warmUpEmbedder, []);

  const notice = currentLegalText('interestNotice', locale);
  const ordinary = interests.data ?? [];
  const active = ordinary.filter((i) => i.data.state === 'active');
  const pendingConsent = ordinary.filter((i) => i.data.state === 'pendingConsent');
  const sensitiveRows = sensitive.data ?? [];
  const count = ordinary.length + sensitiveRows.length;
  const starredCount = active.filter((i) => i.data.starred).length + sensitiveRows.filter((i) => i.data.starred).length;

  const submit = async (value: string, selfFlag = false) => {
    setMessage(null);
    setSuggestion(null);
    const outcome = await add(value, { selfFlag });
    if (!outcome) return;
    setMessage(outcomeMessage(outcome));
    if (outcome.kind === 'done' && outcome.result.suggestion && outcome.result.interestId) {
      setSuggestion({ interestId: outcome.result.interestId, ...outcome.result.suggestion });
    }
    // "Don't add" discards the tag (PRIVACY.md §3.1); a rejection keeps it so the user can reword it.
    const settled = outcome.kind === 'discarded' || (outcome.kind === 'done' && outcome.result.status !== 'rejected');
    if (settled && !selfFlag) setText('');
  };

  const setStar = (interestId: string, on: boolean) => {
    if (on && starredCount >= MAX_STARRED) {
      setMessage('interests.starLimit');
      return;
    }
    star.mutate({ interestId, starred: on });
  };

  const confirmWithdraw = (interestId: string, display: string) => {
    const copy = currentLegalText('withdrawConfirmation', locale);
    if (copy.kind !== 'withdrawConfirmation') return;
    Alert.alert(t('interests.withdrawTitle'), fillTag(copy.content.text, display), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('interests.removeAndWithdraw'), style: 'destructive', onPress: () => withdraw.mutate({ interestId }) },
    ]);
  };

  const mutationError = error ?? star.error ?? remove.error ?? withdraw.error ?? confirmSuggestion.error;

  return (
    <View style={{ gap: 16 }}>
      <Body muted>{notice.kind === 'interestNotice' ? notice.content.text : ''}</Body>
      <Field
        label={t('interests.fieldLabel')}
        value={text}
        onChangeText={setText}
        maxLength={80}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => void submit(text)}
      />
      <Button label={t('interests.add')} busy={pending} disabled={text.trim().length === 0} onPress={() => void submit(text)} />
      {message ? <Body>{t(message)}</Body> : null}
      {mutationError ? <ErrorText>{t(errorMessageKey(mutationError))}</ErrorText> : null}
      {suggestion ? (
        <Card>
          <Body>{t('interests.didYouMean', { label: suggestion.label })}</Body>
          <Button
            label={t('interests.useSuggestion')}
            variant="secondary"
            onPress={() => {
              confirmSuggestion.mutate({ interestId: suggestion.interestId, conceptId: suggestion.conceptId });
              setSuggestion(null);
            }}
          />
        </Card>
      ) : null}

      {area.data && area.data.chips.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Body muted>{t('interests.popularNearYou')}</Body>
          <ChipRow>
            {area.data.chips.map((chip) => (
              <ChipButton key={chip.conceptId} label={chip[locale]} onPress={() => void submit(chip[locale])} />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <Body muted>{t('interests.count', { count, min: 3, nudge: 5 })}</Body>

      <Heading>{t('interests.yours')}</Heading>
      {active.length === 0 && sensitiveRows.length === 0 ? <Body muted>{t('interests.empty')}</Body> : null}
      {active.map(({ id, data }) => (
        <Card key={id}>
          <Body bold>{data.starred ? `★ ${data.display}` : data.display}</Body>
          {mode === 'full' ? (
            <ChipRow>
              <Toggle
                label={t('interests.star')}
                value={data.starred}
                onChange={(on) => setStar(id, on)}
              />
              <ChipButton label={t('interests.keepPrivate')} onPress={() => void submit(data.display, true)} />
              <ChipButton label={t('interests.remove')} onPress={() => remove.mutate({ interestId: id })} />
            </ChipRow>
          ) : (
            <Button label={t('interests.remove')} variant="secondary" onPress={() => remove.mutate({ interestId: id })} />
          )}
        </Card>
      ))}

      {pendingConsent.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Heading>{t('interests.pendingTitle')}</Heading>
          <Body muted>{t('interests.pendingBody')}</Body>
          {pendingConsent.map(({ id, data }) => (
            <Card key={id}>
              <Body bold>{data.display}</Body>
              <ChipRow>
                <ChipButton label={t('interests.giveConsent')} onPress={() => void submit(data.display)} />
                <ChipButton label={t('interests.remove')} onPress={() => remove.mutate({ interestId: id })} />
              </ChipRow>
            </Card>
          ))}
        </View>
      ) : null}

      {sensitiveRows.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Heading>{t('interests.sensitiveTitle')}</Heading>
          <Body muted>{t('interests.sensitiveBody')}</Body>
          {sensitiveRows.map(({ id, data }) => (
            <Card key={id}>
              <Body bold>{`🔒 ${data.display}`}</Body>
              {mode === 'full' ? (
                <ChipRow>
                  <Toggle
                    label={t('interests.star')}
                    value={data.starred}
                    onChange={(on) => setStar(id, on)}
                  />
                  <ChipButton label={t('interests.removeAndWithdraw')} onPress={() => confirmWithdraw(id, data.display)} />
                </ChipRow>
              ) : (
                <Button label={t('interests.removeAndWithdraw')} variant="secondary" onPress={() => confirmWithdraw(id, data.display)} />
              )}
            </Card>
          ))}
          {mode === 'full' ? (
            <Button
              label={t('interests.withdrawAll')}
              variant="danger"
              onPress={() =>
                Alert.alert(t('interests.withdrawAllTitle'), t('interests.withdrawAllBody'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('interests.withdrawAll'), style: 'destructive', onPress: () => withdraw.mutate({}) },
                ])
              }
            />
          ) : null}
        </View>
      ) : null}

      <Button label={t('interests.readMoreSensitive')} variant="secondary" onPress={() => router.push('/info/sensitive-interests')} />
    </View>
  );
}
