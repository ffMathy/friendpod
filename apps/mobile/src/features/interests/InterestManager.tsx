import { currentLegalText, type Locale, type ModerationReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Body, Button, Card, ChipButton, ChipRow, ErrorText, Field, Heading, Toggle } from '@/components/ui';
import { useAreaDoc, useInterests, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useAddInterest, type AddInterestOutcome, type HoldingChoice } from './useAddInterest';
import { useEmbedder } from './useEmbedder';

const MAX_STARRED = 3;

interface Props {
  readonly uid: string;
  readonly locale: Locale;
  /** Onboarding shows the add flow and the list; the Interests tab also stars holdings. */
  readonly mode: 'onboarding' | 'full';
}

type MessageKey =
  | `moderation.${ModerationReason}`
  | 'moderation.ART9_CONSENT_REQUIRED_SERVER'
  | 'interests.added'
  | 'interests.thirdPartyWarning'
  | 'interests.madePrivate'
  | 'interests.madeOrdinary'
  | 'interests.duplicate'
  | 'interests.limit'
  | 'interests.starLimit';

/** Input-time rejections are rendered from the reason code (DSA Art. 17); nothing is stored. */
function outcomeMessage(outcome: AddInterestOutcome): MessageKey {
  if (outcome.kind === 'rejected') return `moderation.${outcome.code}`;
  const r = outcome.result;
  switch (r.status) {
    case 'added':
      return r.warning === 'THIRD_PARTY' ? 'interests.thirdPartyWarning' : 'interests.added';
    case 'madePrivate':
      return 'interests.madePrivate';
    case 'madeOrdinary':
      return 'interests.madeOrdinary';
    case 'duplicate':
      return 'interests.duplicate';
    case 'limit':
      return 'interests.limit';
    case 'rejected':
      // The text and its vector did reach the server here, so the device-side "Nothing was sent" would be untrue.
      if (r.reasonCode === 'ART9_CONSENT_REQUIRED') return 'moderation.ART9_CONSENT_REQUIRED_SERVER';
      return r.reasonCode ? `moderation.${r.reasonCode}` : 'moderation.BLOCKLIST';
  }
}

interface Row {
  readonly id: string;
  readonly display: string;
  readonly starred: boolean;
  /** Stored as sensitive: lock icon, nothing else (D3). */
  readonly locked: boolean;
  /** A rescan found it may be sensitive and there is no consent: held back, deleted at `pendingUntil` (§5.2 (8)). */
  readonly pendingUntil: number | null;
}

/**
 * Interests (§3.1 step 7, §11 Interests tab). Tags are embedded on the phone (D1), so adding waits for the model.
 * With the blanket Art. 9 consent, a tag detected as sensitive is stored privately without any prompt and shows a
 * lock; without it, such a tag is refused on the device with a pointer to the consent (D3). Each holding can be made
 * private ("Keep this private") or, when locked, ordinary for this user only ("This isn't sensitive for me").
 */
export function InterestManager({ uid, locale, mode }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [suggestion, setSuggestion] = useState<{ interestId: string; conceptId: string; label: string } | null>(null);
  const embedder = useEmbedder();
  const { add, pending, error, unavailable } = useAddInterest();
  const interests = useInterests(uid);
  const sensitive = useSensitiveInterests(uid);
  const user = useUserDoc(uid);
  const area = useAreaDoc(user.data?.area.areaId ?? null);
  const star = useCallable('updateInterest');
  const remove = useCallable('removeInterest');
  const confirmSuggestion = useCallable('confirmSuggestion');

  const hasArt9Consent = user.data?.legal.art9 !== undefined;
  const notice = currentLegalText('interestNotice', locale);
  const rows: Row[] = [
    ...(interests.data ?? []).map(({ id, data }) => ({
      id,
      display: data.display,
      starred: data.starred,
      locked: false,
      pendingUntil: data.state === 'pendingConsent' ? (data.pendingUntil?.toMillis() ?? 0) : null,
    })),
    ...(sensitive.data ?? []).map(({ id, data }) => ({ id, display: data.display, starred: data.starred, locked: true, pendingUntil: null })),
  ];
  const starredCount = rows.filter((r) => r.starred).length;
  const ready = embedder.state.status === 'ready';
  const unavailableReason = unavailable ?? (embedder.state.status === 'unavailable' ? embedder.state.reason : null);

  const submit = async (value: string, choice: HoldingChoice = null) => {
    setMessage(null);
    setSuggestion(null);
    const outcome = await add(value, { hasArt9Consent, choice });
    if (!outcome) return;
    setMessage(outcomeMessage(outcome));
    if (outcome.kind === 'done' && outcome.result.suggestion && outcome.result.interestId) {
      setSuggestion({ interestId: outcome.result.interestId, ...outcome.result.suggestion });
    }
    // A rejection keeps the text so the user can reword it.
    if (choice === null && outcome.kind === 'done' && outcome.result.status !== 'rejected') setText('');
  };

  const setStar = (interestId: string, on: boolean) => {
    if (on && starredCount >= MAX_STARRED) {
      setMessage('interests.starLimit');
      return;
    }
    star.mutate({ interestId, starred: on });
  };

  const openConsent = () => router.push(mode === 'onboarding' ? '/sensitive-consent' : '/settings/sensitive-consent');
  const mutationError = error ?? star.error ?? remove.error ?? confirmSuggestion.error;

  return (
    <View style={{ gap: 16 }}>
      <Body muted>{notice.kind === 'interestNotice' ? notice.content.text : ''}</Body>

      {embedder.state.status === 'loading' ? <Body muted>{t('interests.model.preparing')}</Body> : null}
      {unavailableReason ? (
        <Card>
          <ErrorText>{t(`interests.model.${unavailableReason}`)}</ErrorText>
          <Button testID="model-retry" label={t('common.retry')} variant="secondary" onPress={() => void embedder.retry()} />
        </Card>
      ) : null}

      <Field
        label={t('interests.fieldLabel')}
        value={text}
        onChangeText={setText}
        maxLength={80}
        autoCapitalize="none"
        returnKeyType="done"
        editable={ready}
        onSubmitEditing={() => void submit(text)}
      />
      <Button
        testID="interest-add"
        label={t('interests.add')}
        busy={pending}
        disabled={!ready || text.trim().length === 0}
        onPress={() => void submit(text)}
      />
      {message ? <Body>{t(message)}</Body> : null}
      {message === 'moderation.ART9_CONSENT_REQUIRED' || message === 'moderation.ART9_CONSENT_REQUIRED_SERVER' ? (
        <Button label={t('interests.openSensitiveConsent')} variant="secondary" onPress={openConsent} />
      ) : null}
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
              <ChipButton key={chip.conceptId} label={chip[locale]} onPress={() => (ready ? void submit(chip[locale]) : undefined)} />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <Body muted>{t('interests.count', { count: rows.length, min: 3, nudge: 5 })}</Body>

      <Heading>{t('interests.yours')}</Heading>
      {rows.length === 0 ? <Body muted>{t('interests.empty')}</Body> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <View accessible accessibilityLabel={row.locked ? t('interests.privateLabel', { name: row.display }) : row.display}>
            <Body bold>{`${row.locked ? '🔒 ' : ''}${row.starred ? '★ ' : ''}${row.display}`}</Body>
          </View>
          {row.pendingUntil !== null ? (
            <>
              <Body muted>
                {row.pendingUntil > 0
                  ? t('interests.pendingConsent', { when: formatDateTime(row.pendingUntil, locale) })
                  : t('interests.pendingConsentNoDate')}
              </Body>
              {hasArt9Consent ? null : <Button label={t('interests.openSensitiveConsent')} variant="secondary" onPress={openConsent} />}
            </>
          ) : null}
          <ChipRow>
            {mode === 'full' ? <Toggle label={t('interests.star')} value={row.starred} onChange={(on) => setStar(row.id, on)} /> : null}
            {row.locked ? (
              <ChipButton
                label={t('interests.notSensitiveForMe')}
                onPress={() => (ready ? void submit(row.display, 'notSensitiveForMe') : undefined)}
              />
            ) : (
              <ChipButton label={t('interests.keepPrivate')} onPress={() => (ready ? void submit(row.display, 'selfFlagPrivate') : undefined)} />
            )}
            <ChipButton label={t('interests.remove')} onPress={() => remove.mutate({ interestId: row.id })} />
          </ChipRow>
        </Card>
      ))}
      {rows.some((r) => r.locked) ? <Body muted>{t('interests.privateExplainer')}</Body> : null}

      <Button label={t('interests.readMoreSensitive')} variant="secondary" onPress={() => router.push('/info/sensitive-interests')} />
    </View>
  );
}
