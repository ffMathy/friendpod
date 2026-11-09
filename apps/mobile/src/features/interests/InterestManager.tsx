import { currentLegalText, type Locale, type ModerationReason } from '@friendpod/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { BorderWidth, Size, usePalette } from '@/components/theme';
import {
  AddField,
  Badge,
  Button,
  Card,
  Chip,
  ChipButton,
  ChipRow,
  ErrorText,
  Icon,
  ListSection,
  Note,
  PageHeader,
  PodDot,
  StatusText,
  Text,
  TextLink,
} from '@/components/ui';
import { useAreaDoc, useInterests, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { interestColor, type PodColor } from '@/lib/podColor';
import { ChipOptions, formatDay, GroupHeading, ListCardTitle, MoreButton, PrivateHeader, RowAction, StarButton, SuggestionNote } from './parts';
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
   * `onboarding`: the body of "What are you into?" (onb-interests): the add row with the notice under it, the
   * interests as chips in their pod colours (tap one to change whether it is private), "Did you mean" and the area's
   * popular interests.
   * `full`: the Interests tab (priv-interests): the title with "5 of 20", the add row, the interests as a list with a
   * star, the pod-colour dot and "…", and the private interests in their quiet card with the consent date and
   * "Remove & withdraw".
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
  /** Stored as sensitive: quiet (white, Ink lock), never a colour (D3, decision 1). */
  readonly locked: boolean;
  /** The user chose "This isn't sensitive for me" on it (D2): the way back to private stays at hand. */
  readonly notSensitiveForMe: boolean;
  /** When the blanket consent this private holding rests on was given. */
  readonly consentedAt: number | null;
  /**
   * The pod colour of the interest, from its own normalized word (decision 9: the same word has the same colour
   * everywhere, for everyone). `null` for private interests.
   */
  readonly color: PodColor | null;
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
 *
 * Ordinary interests carry their pod colour (a ringed dot in the list, a tinted chip in onboarding); an interest whose
 * "Did you mean" is still open has no settled concept yet and is drawn dashed; private interests stay quiet.
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
    color: interestColor(data),
  }));
  const locked: Row[] = (sensitive.data ?? []).map(({ id, data }) => ({
    id,
    display: data.display,
    starred: data.starred,
    locked: true,
    notSensitiveForMe: false,
    consentedAt: data.consentedAt.toMillis(),
    color: null,
  }));
  const rows = [...ordinary, ...locked];
  const starredCount = rows.filter((r) => r.starred).length;
  const ready = embedder.state.status === 'ready';
  const unavailableReason = unavailable ?? (embedder.state.status === 'unavailable' ? embedder.state.reason : null);
  /** The interest whose "Did you mean" is open: its concept is not settled yet (dashed, no colour). */
  const unsettledId = suggestion?.interestId ?? null;
  /** The only private holding, when there is exactly one: its quiet "not sensitive" link goes after the note. */
  const soleLocked = locked.length === 1 ? (locked[0] ?? null) : null;

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

  // The one input + Add pattern (decision 7): a 52 px input and the 52 px Skov "Add", radius 14.
  const addRow = (
    <AddField
      label={t('interests.fieldLabel')}
      placeholder={mode === 'onboarding' ? t('interests.fieldLabel') : t('interests.placeholder')}
      addLabel={t('interests.add')}
      addTestID="interest-add"
      value={text}
      onChangeText={setText}
      onAdd={() => void submit(text)}
      addDisabled={!ready}
      busy={pending}
      editable={ready}
      maxLength={80}
      autoCapitalize="none"
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
        <Note
          tone="info"
          icon="alert"
          alert
          actions={<Button testID="model-retry" label={t('common.retry')} variant="secondary" size="sm" onPress={() => void embedder.retry()} />}
        >
          {t(`interests.model.${unavailableReason}`)}
        </Note>
      ) : null}
      {message && CONFIRMATIONS.has(message) && !(message === 'interests.added' && suggestion) ? (
        <View accessibilityLiveRegion="polite">
          <StatusText icon="check" label={t(message)} />
        </View>
      ) : null}
      {message && !CONFIRMATIONS.has(message) ? (
        <Note
          tone="info"
          alert
          actions={
            needsConsent ? <Button label={t('interests.openSensitiveConsent')} variant="secondary" size="sm" onPress={openConsent} /> : undefined
          }
        >
          {t(message)}
        </Note>
      ) : null}
      {mutationError ? <ErrorText>{t(errorMessageKey(mutationError))}</ErrorText> : null}
      {loadFailed ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
    </>
  );

  const suggestionNote = suggestion ? (
    <SuggestionNote
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

  // The locked notice text (interest-notice-*-v2, PRIVACY §3.2), verbatim, at 13/1.5.
  const noticeText = notice.kind === 'interestNotice' ? notice.content.text : '';
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
      <View style={styles.onboarding}>
        <View style={styles.addGroup}>
          {addRow}
          {feedback}
          {/* "Your phone checks each interest …": the info note at the field. */}
          <Note tone="info">
            <Text variant="caption" color="textSecondary" style={styles.notice}>
              {noticeText}
            </Text>
          </Note>
        </View>
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
                  kind={row.locked ? 'private' : row.id === unsettledId ? 'unsettled' : row.color ? 'pod' : 'clash'}
                  color={row.color}
                  privateLabel={t('interests.privateIcon')}
                  starred={row.starred}
                  starredLabel={t('common.mainInterest')}
                  accessibilityLabel={row.locked ? t('interests.privateLabel', { name: row.display }) : row.display}
                  onPress={() => toggleOpen(row.id)}
                  onRemove={() => removeRow(row)}
                  removeLabel={t('interests.removeNamed', { name: row.display })}
                />
              ))}
            </ChipRow>
          )}
          {selected ? (
            <ChipOptions
              isPrivate={selected.locked}
              text={selected.locked ? t('interests.optionsLocked', { name: selected.display }) : t('interests.optionsOrdinary', { name: selected.display })}
            >
              {selected.locked ? (
                <RowAction icon={null} label={t('interests.notSensitiveForMe')} onPress={() => change(selected, 'notSensitiveForMe')} />
              ) : (
                <RowAction label={t('interests.keepPrivate')} onPress={() => change(selected, 'selfFlagPrivate')} />
              )}
            </ChipOptions>
          ) : null}
          {nudge}
        </View>
        {suggestionNote}
        {chips.length > 0 && area.data ? (
          // "Popular in Aarhus" runs into its chips, which wrap under it.
          <View style={styles.popular}>
            <View style={styles.popularHeading}>
              <GroupHeading title={t('interests.popularIn', { area: area.data.label[locale] })} />
            </View>
            {chips.map((chip) => (
              <ChipButton
                key={chip.conceptId}
                label={chip[locale]}
                accessibilityLabel={t('interests.addNamed', { name: chip[locale] })}
                onPress={() => (ready ? void submit(chip[locale]) : undefined)}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // The private card's "Off" state: no consent, no private interest left, and the user doc has loaded.
  const consentOff = locked.length === 0 && !hasArt9Consent && Boolean(user.data);
  return (
    <View style={styles.column}>
      <PageHeader title={t('tabs.interests')} meta={t('interests.countOf', { count: rows.length, max: MAX_INTERESTS })} />
      {addRow}
      {feedback}
      {suggestionNote}

      <ListSection testID="interests-list">
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
            unsettled={row.id === unsettledId}
            last={i === ordinary.length - 1}
            expanded={open === row.id}
            onStar={() => setStar(row.id, !row.starred)}
            onMore={() => toggleOpen(row.id)}
            onKeepPrivate={() => change(row, 'selfFlagPrivate')}
            onRemove={() => removeRow(row)}
          />
        ))}
      </ListSection>
      {nudge}

      {/*
        The standing notice on sensitive interests (interest-notice-*-v2, PRIVACY §3.2) is not on priv-interests. In full
        it says what happens without the consent, so it stands in the private card while the consent is off. With the
        consent given, one link under the lists opens it on the info page instead.
      */}
      {locked.length > 0 ? (
        <Card variant="private" testID="private-interests">
          <PrivateHeader />
          {locked.map((row) => (
            <PrivateRow
              key={row.id}
              row={row}
              locale={locale}
              onStar={() => setStar(row.id, !row.starred)}
              onRemove={() => removeRow(row)}
              onNotSensitive={soleLocked === null ? () => change(row, 'notSensitiveForMe') : undefined}
            />
          ))}
          <Text variant="caption" color="textMuted" style={styles.explainer}>
            {t('interests.privateExplainer')}
          </Text>
          {/*
            One holding: the note sits right under "Remove & withdraw" (priv-interests), and the quiet way out of private
            closes the card. With several, each row keeps its own link so it never reads as acting on the wrong one.
          */}
          {soleLocked !== null ? (
            <View style={styles.notSensitiveLast}>
              <TextLink
                muted
                size="sm"
                accessibilityRole="button"
                label={t('interests.notSensitiveForMe')}
                onPress={() => change(soleLocked, 'notSensitiveForMe')}
              />
            </View>
          ) : null}
        </Card>
      ) : consentOff ? (
        <Card variant="private" testID="private-interests-off">
          <PrivateHeader trailing={<Badge tone="outline" size="sm" label={t('interests.privateOffBadge')} />} />
          <Text variant="caption" color="textSecondary" style={styles.notice}>
            {noticeText}
          </Text>
          <TextLink label={t('interests.giveConsent')} onPress={openConsent} />
        </Card>
      ) : null}
      {consentOff ? null : (
        <TextLink testID="private-interests-how" label={t('interests.howPrivate')} onPress={() => router.push('/info/sensitive-interests')} />
      )}
    </View>
  );
}

interface OrdinaryRowProps {
  readonly row: Row;
  /** Its "Did you mean" is open: a dashed dot until the concept is settled. */
  readonly unsettled: boolean;
  readonly last: boolean;
  readonly expanded: boolean;
  readonly onStar: () => void;
  readonly onMore: () => void;
  readonly onKeepPrivate: () => void;
  readonly onRemove: () => void;
}

/**
 * ☆ ● brætspil … (priv-interests): the star, the pod-colour dot, the interest and "…". An interest the user made
 * ordinary ("This isn't sensitive for me") shows "Keep this private" in place of "…", as on the storyboard; its
 * "Remove" is then one tap on the interest's name, which carries the "More for …" button for screen readers. On the
 * other rows, tapping the name opens the same actions as "…" (hidden from screen readers there, so each row has one
 * "More" button).
 */
function OrdinaryRow({ row, unsettled, last, expanded, onStar, onMore, onKeepPrivate, onRemove }: OrdinaryRowProps) {
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
          <PodDot color={row.color} variant={unsettled ? 'dashed' : row.color ? 'pod' : 'hollow'} />
          <Text variant="rowTitle" style={styles.nameText}>
            {row.display}
          </Text>
        </Pressable>
        {nameIsMore ? (
          <RowAction label={t('interests.keepPrivate')} onPress={onKeepPrivate} />
        ) : (
          <MoreButton testID={`interest-more-${row.id}`} name={row.display} expanded={expanded} onPress={onMore} />
        )}
      </View>
      {expanded ? (
        <View style={[styles.actions, styles.rowActions]}>
          {row.notSensitiveForMe ? null : <RowAction label={t('interests.keepPrivate')} onPress={onKeepPrivate} />}
          <RowAction tone="danger" label={t('interests.remove')} accessibilityLabel={t('interests.removeNamed', { name: row.display })} onPress={onRemove} />
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
  /** Absent when the card shows the link itself, after the note (the only private holding). */
  readonly onNotSensitive?: () => void;
}

/**
 * 🔒 gravid · Consent given 4 Nov 2026 · [Remove & withdraw] (priv-interests): quiet, Ink lock and word, no colour.
 * "This isn't sensitive for me" (D2; §3.1 step 8 and §11 offer it on every locked holding) is a quiet link (it never
 * fits beside the danger button at 390 px, in en or da), so the way out of private stays at hand without competing
 * with it. With one holding the card puts it after the note, so the note sits right
 * under the button as drawn; with several, each row keeps its own under its button.
 */
function PrivateRow({ row, locale, onStar, onRemove, onNotSensitive }: PrivateRowProps) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <View style={[styles.privateRow, onNotSensitive ? styles.privateRowWithLink : null]}>
      <View style={styles.privateLine}>
        {/* §8.1 has no star on private holdings; one starred before can still be unstarred. */}
        {row.starred ? <StarButton name={row.display} starred onPress={onStar} /> : null}
        <View style={styles.privateText} accessible accessibilityLabel={t('interests.privateLabel', { name: row.display })}>
          <View style={styles.privateName}>
            <Icon name="lock" size={16} strokeWidth={2.2} color={p.privateText} />
            <Text variant="rowTitle" style={styles.nameText}>
              {row.display}
            </Text>
          </View>
          {row.consentedAt !== null ? (
            <Text variant="micro" color="textMuted">
              {t('interests.consentGiven', { date: formatDay(row.consentedAt, locale) })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.privateActions}>
        <RowAction
          tone="danger"
          label={t('interests.removeWithdraw')}
          accessibilityLabel={t('interests.removeWithdrawNamed', { name: row.display })}
          onPress={onRemove}
        />
        {onNotSensitive ? (
          <TextLink muted size="sm" accessibilityRole="button" label={t('interests.notSensitiveForMe')} onPress={onNotSensitive} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  onboarding: { gap: 12 },
  addGroup: { gap: 8 },
  section: { gap: 8 },
  /** 13/1.5, the storyboards' notice and explainer lines. */
  notice: { lineHeight: 19.5 },
  hint: { marginTop: -2 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, minHeight: Size.hitTarget, flexDirection: 'row', alignItems: 'center', gap: 9 },
  /** The storyboard's 16/600 rows sit on a 22 px line. */
  nameText: { lineHeight: 22, flexShrink: 1 },
  /** The actions line up with the dot (the star's 44 px target, pulled 12 px into the inset, plus the 4 px gap). */
  rowActions: { paddingLeft: 36, paddingBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  explainer: { lineHeight: Math.round(13 * 1.45) },
  popular: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 0, marginTop: -6 },
  popularHeading: { marginRight: 4 },
  privateRow: { gap: 10, alignItems: 'flex-start' },
  /**
   * The link's 44 px target already leaves 13 px under its text, so the row cancels the private card's 10 px gap
   * after it: 16 px from the link to the explainer (or the next private interest), the storyboard's 12–16 px rhythm.
   */
  privateRowWithLink: { marginBottom: -10 },
  /**
   * The sole holding's link after the note: its 44 px target (13 px above and below the 18 px line) pulls up over the
   * card's 10 px gap, 13 px from the note to the link's line, and down into the card's 14 px padding, so the line
   * ends 14 px above the border like the note did. The target stays inside the card.
   */
  notSensitiveLast: { alignItems: 'flex-start', marginTop: -10, marginBottom: -13 },
  privateLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  privateText: { gap: 2 },
  privateName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** The danger button, then the quiet link on its own line; the two 44 px targets touch but never overlap. */
  privateActions: { alignItems: 'flex-start' },
});
