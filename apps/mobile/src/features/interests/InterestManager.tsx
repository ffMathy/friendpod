import { currentLegalText, type Locale, type ModerationReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Badge, Banner, Button, Chip, ChipButton, ChipRow, ErrorText, Icon, PageHeader, Text, TextLink } from '@/components/ui';
import { useAreaDoc, useInterests, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import {
  AddField,
  formatDay,
  ListCard,
  ListCardTitle,
  MoreButton,
  Pill,
  PrivateHeader,
  PrivateInfoLink,
  StarButton,
  SuggestionBanner,
} from './parts';
import { useAddInterest, type AddInterestOutcome, type HoldingChoice } from './useAddInterest';
import { useEmbedder } from './useEmbedder';

const MAX_STARRED = 3;
/** The server's per-user limit (INTEREST_LIMIT); shown as "5 of 20". */
const MAX_INTERESTS = 20;
/** Onboarding asks for at least 3 and nudges towards 5 (DESIGN §3.1 step 8). */
const NUDGE_BELOW = 5;

interface Props {
  readonly uid: string;
  readonly locale: Locale;
  /**
   * `onboarding`: the body of "What are you into?" (onb-interests): the add row, the notice, the interests as chips
   * (tap one to change whether it is private), "Did you mean" and the area's popular chips.
   * `full`: the Interests tab (priv-interests): the title with "5 of 20", the add row, the interests as a list with
   * a star and "…", and the private interests with their consent date and "Remove & withdraw".
   */
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

const CONFIRMATIONS: ReadonlySet<MessageKey> = new Set(['interests.added', 'interests.madePrivate', 'interests.madeOrdinary']);

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
  /** The user chose "This isn't sensitive for me" on it (D2): the way back to private stays at hand. */
  readonly notSensitiveForMe: boolean;
  /** When the blanket consent this private holding rests on was given. */
  readonly consentedAt: number | null;
}

interface Suggestion {
  readonly interestId: string;
  readonly conceptId: string;
  readonly label: string;
  /** What the user typed ("brætspilsaften"). */
  readonly typed: string;
}

/**
 * Interests (§3.1 step 8, §11 Interests tab). Tags are embedded on the phone (D1), so adding waits for the model.
 * With the blanket Art. 9 consent, a tag detected as sensitive is stored privately without any prompt and shows a
 * lock; without it, such a tag is refused on the device with a pointer to the consent (D3). Each holding can be made
 * private ("Keep this private") or, when locked, ordinary for this user only ("This isn't sensitive for me").
 * Removing a private interest withdraws the consent for that holding, one tap from the interest (PRIVACY §3.5).
 */
export function InterestManager({ uid, locale, mode }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  /** The row whose actions are open (tab: "…"; onboarding: the tapped chip). */
  const [open, setOpen] = useState<string | null>(null);
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
  const ordinary: Row[] = (interests.data ?? []).map(({ id, data }) => ({
    id,
    display: data.display,
    starred: data.starred,
    locked: false,
    notSensitiveForMe: data.notSensitiveForMe === true,
    consentedAt: null,
  }));
  const locked: Row[] = (sensitive.data ?? []).map(({ id, data }) => ({
    id,
    display: data.display,
    starred: data.starred,
    locked: true,
    notSensitiveForMe: false,
    consentedAt: data.consentedAt.toMillis(),
  }));
  const rows = [...ordinary, ...locked];
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
      setSuggestion({ interestId: outcome.result.interestId, ...outcome.result.suggestion, typed: value.trim() });
    }
    // A rejection keeps the text so the user can reword it.
    if (choice === null && outcome.kind === 'done' && outcome.result.status !== 'rejected') setText('');
    if (choice !== null) setOpen(null);
  };
  const change = (row: Row, choice: Exclude<HoldingChoice, null>) => (ready ? void submit(row.display, choice) : undefined);

  const setStar = (interestId: string, on: boolean) => {
    if (on && starredCount >= MAX_STARRED) {
      setMessage('interests.starLimit');
      return;
    }
    star.mutate({ interestId, starred: on });
  };
  const removeRow = (row: Row) => {
    setOpen(null);
    remove.mutate({ interestId: row.id });
  };
  const toggleOpen = (id: string) => setOpen((current) => (current === id ? null : id));

  const openConsent = () => router.push(mode === 'onboarding' ? '/sensitive-consent' : '/settings/sensitive-consent');
  const mutationError = error ?? star.error ?? remove.error ?? confirmSuggestion.error;
  const loading = interests.isLoading || sensitive.isLoading;
  const loadFailed = interests.error !== null || sensitive.error !== null;
  const needsConsent = message === 'moderation.ART9_CONSENT_REQUIRED' || message === 'moderation.ART9_CONSENT_REQUIRED_SERVER';

  const addRow = (
    <AddField
      look={mode === 'onboarding' ? 'onboarding' : 'tab'}
      label={t('interests.fieldLabel')}
      placeholder={mode === 'onboarding' ? t('interests.fieldLabel') : t('interests.placeholder')}
      addLabel={t('interests.add')}
      value={text}
      onChangeText={setText}
      onSubmit={() => void submit(text)}
      ready={ready}
      busy={pending}
    />
  );

  const feedback = (
    <>
      {embedder.state.status === 'loading' ? (
        <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          {t('interests.model.preparing')}
        </Text>
      ) : null}
      {unavailableReason ? (
        <Banner
          tone="safety"
          icon="info"
          alert
          actions={<Button testID="model-retry" label={t('common.retry')} variant="outline" size="xs" onPress={() => void embedder.retry()} />}
        >
          {t(`interests.model.${unavailableReason}`)}
        </Banner>
      ) : null}
      {message && CONFIRMATIONS.has(message) && !(message === 'interests.added' && suggestion) ? <Confirmation text={t(message)} /> : null}
      {message && !CONFIRMATIONS.has(message) ? (
        <Banner
          tone="info"
          icon="info"
          alert
          actions={
            needsConsent ? <Button label={t('interests.openSensitiveConsent')} variant="outline" size="xs" onPress={openConsent} /> : undefined
          }
        >
          {t(message)}
        </Banner>
      ) : null}
      {mutationError ? <ErrorText>{t(errorMessageKey(mutationError))}</ErrorText> : null}
      {loadFailed ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
    </>
  );

  const suggestionBanner = suggestion ? (
    <SuggestionBanner
      label={suggestion.label}
      typed={suggestion.typed}
      onYes={() => {
        confirmSuggestion.mutate({ interestId: suggestion.interestId, conceptId: suggestion.conceptId });
        setSuggestion(null);
        setMessage(null);
      }}
      onNo={() => {
        setSuggestion(null);
        setMessage(null);
      }}
    />
  ) : null;

  // The locked notice text (interest-notice-*-v2), verbatim, at the storyboard's 13/1.5 (19.5 px, not the caption's 20).
  const noticeText = (
    <Text variant="caption" color="textSecondary" style={styles.notice}>
      {notice.kind === 'interestNotice' ? notice.content.text : ''}
    </Text>
  );
  const noticeBanner = <Banner tone="info">{noticeText}</Banner>;
  const nudge =
    rows.length < NUDGE_BELOW && !loading ? (
      <Text variant="caption" color="textMuted">
        {t('interests.nudge')}
      </Text>
    ) : null;

  if (mode === 'onboarding') {
    const selected = rows.find((r) => r.id === open) ?? null;
    const heldNorms = new Set(rows.map((r) => r.display.toLocaleLowerCase(locale)));
    const chips = (area.data?.chips ?? []).filter((chip) => !heldNorms.has(chip[locale].toLocaleLowerCase(locale)));
    return (
      <View style={[styles.column, { gap: 18 }]}>
        {addRow}
        {feedback}
        {noticeBanner}
        <View style={styles.section}>
          <GroupHeading title={t('interests.yours')} count={rows.length > 0 ? t('interests.addedCount', { count: rows.length }) : undefined} />
          {rows.length > 0 ? (
            // The storyboard's notice says "Tap an interest to change that"; the locked notice text above cannot.
            <Text variant="caption" color="textMuted" style={styles.hint}>
              {t('interests.tapToChange')}
            </Text>
          ) : null}
          {rows.length === 0 ? (
            loading ? null : (
              <Text variant="small" color="textMuted">
                {t('interests.empty')}
              </Text>
            )
          ) : (
            <ChipRow>
              {rows.map((row) => (
                <Chip
                  key={row.id}
                  testID={`interest-chip-${row.id}`}
                  label={row.display}
                  private={row.locked}
                  privateLabel={t('interests.privateIcon')}
                  starred={row.starred}
                  accessibilityLabel={row.locked ? t('interests.privateLabel', { name: row.display }) : row.display}
                  onPress={() => toggleOpen(row.id)}
                  onRemove={() => removeRow(row)}
                  removeLabel={t('interests.removeNamed', { name: row.display })}
                />
              ))}
            </ChipRow>
          )}
          {selected ? <ChipOptions row={selected} onChange={(choice) => change(selected, choice)} /> : null}
          {nudge}
        </View>
        {suggestionBanner}
        {chips.length > 0 && area.data ? (
          <View style={styles.section}>
            <GroupHeading title={t('interests.popularIn', { area: area.data.label[locale] })} />
            <ChipRow>
              {chips.map((chip) => (
                <ChipButton
                  key={chip.conceptId}
                  label={`+ ${chip[locale]}`}
                  accessibilityLabel={t('interests.addNamed', { name: chip[locale] })}
                  onPress={() => (ready ? void submit(chip[locale]) : undefined)}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}
      </View>
    );
  }

  // The private card's "Off" state: no consent, no private interest left, and the user doc has loaded.
  const consentOff = locked.length === 0 && !hasArt9Consent && Boolean(user.data);
  return (
    <View style={styles.column}>
      <View style={styles.tabHeader}>
        <PageHeader title={t('tabs.interests')} meta={t('interests.countOf', { count: rows.length, max: MAX_INTERESTS })} />
      </View>
      {addRow}
      {feedback}
      {suggestionBanner}

      <ListCard testID="interests-list">
        <ListCardTitle>{t('interests.listTitle')}</ListCardTitle>
        {ordinary.length === 0 && !loading ? (
          <View style={styles.row}>
            <Text variant="body" color="textMuted">
              {t('interests.empty')}
            </Text>
          </View>
        ) : null}
        {ordinary.map((row, i) => (
          <OrdinaryRow
            key={row.id}
            row={row}
            last={i === ordinary.length - 1}
            expanded={open === row.id}
            onStar={() => setStar(row.id, !row.starred)}
            onMore={() => toggleOpen(row.id)}
            onKeepPrivate={() => change(row, 'selfFlagPrivate')}
            onRemove={() => removeRow(row)}
          />
        ))}
      </ListCard>
      {nudge}

      {/*
        The standing notice on sensitive interests (interest-notice-*-v2, PRIVACY §3.2) is not on priv-interests. In full
        it says what happens without the consent, so it stands in the private card while the consent is off, in place of
        a separate tip card. With the consent given, one line under the lists opens it on the info page instead.
      */}
      {locked.length > 0 ? (
        <ListCard tone="private" testID="private-interests">
          <PrivateHeader />
          {locked.map((row) => (
            <PrivateRow
              key={row.id}
              row={row}
              locale={locale}
              onStar={() => setStar(row.id, !row.starred)}
              onRemove={() => removeRow(row)}
              onNotSensitive={() => change(row, 'notSensitiveForMe')}
            />
          ))}
          <Text variant="caption" color="textMuted" style={styles.explainer}>
            {t('interests.privateExplainer')}
          </Text>
        </ListCard>
      ) : consentOff ? (
        <ListCard tone="private" testID="private-interests-off">
          <PrivateHeader trailing={<Badge tone="outline" size="sm" label={t('interests.privateOffBadge')} />} />
          {noticeText}
          <TextLink label={t('interests.giveConsent')} onPress={openConsent} />
        </ListCard>
      ) : null}
      {consentOff ? null : (
        <PrivateInfoLink testID="private-interests-how" label={t('interests.howPrivate')} onPress={() => router.push('/info/sensitive-interests')} />
      )}
    </View>
  );
}

/** A green tick and a short confirmation under the add row ("Added."), announced politely. */
function Confirmation({ text }: { text: string }) {
  const p = usePalette();
  return (
    <View style={styles.confirmation} accessibilityLiveRegion="polite">
      <Icon name="check" size={16} color={p.primary} strokeWidth={2.4} />
      <Text variant="captionStrong" color="primary">
        {text}
      </Text>
    </View>
  );
}

/**
 * onb-interests' h2: 15/700 at the font's normal line height (19 px), "· 5 added" in 500 muted. SectionHeader's 24 px
 * row put the heading 2 px low and 5 px further from the chips than on the storyboard.
 */
function GroupHeading({ title, count }: { title: string; count?: string }) {
  return (
    <Text accessibilityRole="header" variant="heading" style={styles.groupHeading}>
      {title}
      {count ? (
        <Text variant="heading" weight="500" color="textMuted" style={styles.groupHeading}>
          {` · ${count}`}
        </Text>
      ) : null}
    </Text>
  );
}

/** Onboarding: what tapping a chip offers ("Tap an interest to change that"). */
function ChipOptions({ row, onChange }: { row: Row; onChange: (choice: 'selfFlagPrivate' | 'notSensitiveForMe') => void }) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <View style={[styles.options, { backgroundColor: p.surface, borderColor: row.locked ? p.privateBorder : p.border }]}>
      <Text variant="small" color="textSecondary" style={styles.optionsText}>
        {row.locked ? t('interests.optionsLocked', { name: row.display }) : t('interests.optionsOrdinary', { name: row.display })}
      </Text>
      <View style={styles.actions}>
        {row.locked ? (
          <Pill tone="private" label={t('interests.notSensitiveForMe')} onPress={() => onChange('notSensitiveForMe')} />
        ) : (
          <Pill tone="private" label={t('interests.keepPrivate')} onPress={() => onChange('selfFlagPrivate')} />
        )}
      </View>
    </View>
  );
}

interface OrdinaryRowProps {
  readonly row: Row;
  readonly last: boolean;
  readonly expanded: boolean;
  readonly onStar: () => void;
  readonly onMore: () => void;
  readonly onKeepPrivate: () => void;
  readonly onRemove: () => void;
}

/**
 * ☆ brætspil … (priv-interests): star, the interest and "…". An interest the user made ordinary ("This isn't
 * sensitive for me") shows "Keep this private" in place of "…", as on the storyboard; its "Remove" is then one tap on
 * the interest's name, which carries the "More for …" button for screen readers. On the other rows, tapping the name
 * opens the same actions as "…" (hidden from screen readers there, so each row has one "More" button).
 */
function OrdinaryRow({ row, last, expanded, onStar, onMore, onKeepPrivate, onRemove }: OrdinaryRowProps) {
  const p = usePalette();
  const { t } = useTranslation();
  const nameIsMore = row.notSensitiveForMe;
  return (
    <View style={last ? null : { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator }}>
      <View style={styles.row}>
        <StarButton name={row.display} starred={row.starred} onPress={onStar} />
        <Pressable
          onPress={onMore}
          accessible={nameIsMore}
          importantForAccessibility={nameIsMore ? 'yes' : 'no-hide-descendants'}
          accessibilityElementsHidden={!nameIsMore}
          accessibilityRole={nameIsMore ? 'button' : undefined}
          accessibilityLabel={nameIsMore ? t('interests.moreNamed', { name: row.display }) : undefined}
          accessibilityState={nameIsMore ? { expanded } : undefined}
          testID={nameIsMore ? `interest-more-${row.id}` : undefined}
          style={styles.name}
        >
          <Text variant="rowTitle">{row.display}</Text>
        </Pressable>
        {nameIsMore ? (
          <Pill tone="private" label={t('interests.keepPrivate')} onPress={onKeepPrivate} />
        ) : (
          <MoreButton testID={`interest-more-${row.id}`} name={row.display} expanded={expanded} onPress={onMore} />
        )}
      </View>
      {expanded ? (
        <View style={[styles.actions, styles.rowActions]}>
          {row.notSensitiveForMe ? null : <Pill tone="private" label={t('interests.keepPrivate')} onPress={onKeepPrivate} />}
          <Pill tone="danger" label={t('interests.remove')} accessibilityLabel={t('interests.removeNamed', { name: row.display })} onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

interface PrivateRowProps {
  readonly row: Row;
  readonly locale: Locale;
  readonly onStar: () => void;
  readonly onRemove: () => void;
  readonly onNotSensitive: () => void;
}

/** gravid · Consent given 4 Nov 2026 · [Remove & withdraw], then "This isn't sensitive for me" (D2). */
function PrivateRow({ row, locale, onStar, onRemove, onNotSensitive }: PrivateRowProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.privateRow}>
      <View style={styles.privateLine}>
        {/* §8.1 has no star on private holdings; one starred before can still be unstarred. */}
        {row.starred ? <StarButton name={row.display} starred onPress={onStar} /> : null}
        <View style={[styles.flex, styles.privateText]} accessible accessibilityLabel={t('interests.privateLabel', { name: row.display })}>
          <Text variant="rowTitle">{row.display}</Text>
          {row.consentedAt !== null ? (
            <Text variant="micro" color="textMuted" style={styles.consentDate}>
              {t('interests.consentGiven', { date: formatDay(row.consentedAt, locale) })}
            </Text>
          ) : null}
        </View>
        <Pill
          tone="danger"
          size="md"
          label={t('interests.removeWithdraw')}
          accessibilityLabel={t('interests.removeWithdrawNamed', { name: row.display })}
          onPress={onRemove}
        />
      </View>
      {/*
        Not on priv-interests, but §3.1 step 8 and §11 offer it on every locked holding. It is the same lilac pill as
        "Keep this private" and as in onboarding's chip options, so the way into and out of private looks alike.
      */}
      <View style={[styles.notSensitive, row.starred ? styles.indent : null]}>
        <Pill tone="private" label={t('interests.notSensitiveForMe')} onPress={onNotSensitive} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  section: { gap: 10 },
  flex: { flex: 1 },
  /** The storyboard's h1 keeps the font's normal line height (38 px), 3 px taller than Title's: 2 above, 1 below. */
  tabHeader: { paddingTop: 2, paddingBottom: 1 },
  notice: { lineHeight: 19.5 },
  /** 12 px at the font's normal line height (15), so "gravid" and its date are the storyboard's 38 px block. */
  consentDate: { lineHeight: 15 },
  hint: { marginTop: -4 },
  name: { flex: 1, minHeight: 44, justifyContent: 'center' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowActions: { paddingLeft: 42, paddingBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  confirmation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  options: { borderWidth: BorderWidth.hairline, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  optionsText: { lineHeight: 20 },
  explainer: { lineHeight: Math.round(13 * 1.45) },
  groupHeading: { lineHeight: 19 },
  privateRow: { gap: 4 },
  privateLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  privateText: { gap: 2 },
  notSensitive: { alignItems: 'flex-start' },
  indent: { paddingLeft: 42 },
});
