import { currentLegalText, DROP_TIME_ZONE, type Locale, type ModerationReason } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Radius, Sizes, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Banner, Button, Card, ChipButton, ChipRow, ErrorText, Field, Icon, IconButton, ListGroup, SectionTitle, TextLink } from '@/components/ui';
import { useAreaDoc, useInterests, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useAddInterest, type AddInterestOutcome, type HoldingChoice } from './useAddInterest';
import { useEmbedder } from './useEmbedder';

const MAX_STARRED = 3;
/** Minimum interests for onboarding and matching (§3.1 step 8), nudged towards 5 [MAT]. */
export const MIN_INTERESTS = 3;
const NUDGE_INTERESTS = 5;
/** The server's holding limit (LIMITS.maxInterests in functions/src/interests/config.ts; "You have reached 20"). */
export const MAX_INTERESTS = 20;

interface Props {
  readonly uid: string;
  readonly locale: Locale;
  /** Onboarding (storyboard 1.5) shows chips; the Interests tab (5.2) shows lists with stars and the private group. */
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

const CONFIRMATIONS: readonly MessageKey[] = ['interests.added', 'interests.madePrivate', 'interests.madeOrdinary'];

interface Row {
  readonly id: string;
  readonly display: string;
  readonly starred: boolean;
  /** Stored as sensitive: lock icon, nothing else (D3). */
  readonly locked: boolean;
  /** A rescan found it may be sensitive and there is no consent: held back, deleted at `pendingUntil` (§5.2 (8)). */
  readonly pendingUntil: number | null;
  /** When a sensitive holding was stored under the blanket consent ("Consent given 4 Nov 2026", storyboard 5.2). */
  readonly consentedAt: number | null;
}

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

function formatDay(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: DROP_TIME_ZONE }).format(
    new Date(ms),
  );
}

/** Splits a translated sentence around `{{label}}` so the label can be drawn bold. */
const LABEL_MARK = '\u0000';

/**
 * Interests (§3.1 step 8, §11 Interests tab). Tags are embedded on the phone (D1), so adding waits for the model.
 * With the blanket Art. 9 consent, a tag detected as sensitive is stored privately without any prompt and shows a
 * lock; without it, such a tag is refused on the device with a pointer to the consent (D3). Each holding can be made
 * private ("Keep this private") or, when locked, ordinary for this user only ("This isn't sensitive for me").
 * Removing a private holding is one tap ("Remove & withdraw", `removeInterest` runs the withdrawal for that holding).
 */
export function InterestManager({ uid, locale, mode }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [suggestion, setSuggestion] = useState<{ interestId: string; conceptId: string; label: string; text: string } | null>(null);
  /** The chip whose privacy panel is open (onboarding), or the row whose actions are shown (tab). */
  const [openId, setOpenId] = useState<string | null>(null);
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
      consentedAt: null,
    })),
    ...(sensitive.data ?? []).map(({ id, data }) => ({
      id,
      display: data.display,
      starred: data.starred,
      locked: true,
      pendingUntil: null,
      consentedAt: data.consentedAt?.toMillis() ?? null,
    })),
  ];
  const ordinary = rows.filter((r) => !r.locked);
  const locked = rows.filter((r) => r.locked);
  const starredCount = rows.filter((r) => r.starred).length;
  const ready = embedder.state.status === 'ready';
  const unavailableReason = unavailable ?? (embedder.state.status === 'unavailable' ? embedder.state.reason : null);
  const chips = area.data?.chips ?? [];
  const areaLabel = area.data?.label[locale] ?? null;

  const submit = async (value: string, choice: HoldingChoice = null) => {
    setMessage(null);
    setSuggestion(null);
    const outcome = await add(value, { hasArt9Consent, choice });
    if (!outcome) return;
    setMessage(outcomeMessage(outcome));
    if (outcome.kind === 'done' && outcome.result.suggestion && outcome.result.interestId) {
      setSuggestion({ interestId: outcome.result.interestId, ...outcome.result.suggestion, text: value });
    }
    // A rejection keeps the text so the user can reword it.
    if (choice === null && outcome.kind === 'done' && outcome.result.status !== 'rejected') setText('');
  };

  /** "Keep this private" / "This isn't sensitive for me": the holding is sent again with that flag. */
  const choosePrivacy = (row: Row, choice: Exclude<HoldingChoice, null>) => {
    if (!ready) return;
    setOpenId(null);
    void submit(row.display, choice);
  };

  const setStar = (interestId: string, on: boolean) => {
    if (on && starredCount >= MAX_STARRED) {
      setMessage('interests.starLimit');
      return;
    }
    star.mutate({ interestId, starred: on });
  };

  const removeRow = (row: Row) => {
    setOpenId(null);
    remove.mutate({ interestId: row.id });
  };

  const openConsent = () => router.push(mode === 'onboarding' ? '/sensitive-consent' : '/settings/sensitive-consent');
  const mutationError = error ?? star.error ?? remove.error ?? confirmSuggestion.error;
  const needsConsent = message === 'moderation.ART9_CONSENT_REQUIRED' || message === 'moderation.ART9_CONSENT_REQUIRED_SERVER';
  const consentButton = (
    <Button label={t('interests.openSensitiveConsent')} variant="secondary" size="xs" inline onPress={openConsent} />
  );

  const addRow = (
    <View style={styles.addRow}>
      <Field
        label={t('interests.fieldLabel')}
        hideLabel
        placeholder={mode === 'onboarding' ? t('interests.fieldLabel') : t('interests.addPlaceholder')}
        value={text}
        onChangeText={setText}
        maxLength={80}
        autoCapitalize="none"
        returnKeyType="done"
        editable={ready}
        onSubmitEditing={() => void submit(text)}
        size={mode === 'onboarding' ? 'lg' : 'md'}
        containerStyle={styles.flex}
      />
      <AddButton
        testID="interest-add"
        label={t('interests.add')}
        height={mode === 'onboarding' ? Sizes.input : Sizes.inputMd}
        busy={pending}
        disabled={!ready || text.trim().length === 0}
        onPress={() => void submit(text)}
      />
    </View>
  );

  const status = (
    <>
      {embedder.state.status === 'loading' ? (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={p.primary} />
          <AppText variant="caption" tone="muted" style={styles.flex}>
            {t('interests.model.preparing')}
          </AppText>
        </View>
      ) : null}
      {unavailableReason ? (
        <Banner
          tone="coral"
          icon="info"
          accessibilityRole="alert"
          actions={<Button testID="model-retry" label={t('common.retry')} variant="secondary" size="xs" inline onPress={() => void embedder.retry()} />}
        >
          {t(`interests.model.${unavailableReason}`)}
        </Banner>
      ) : null}
    </>
  );

  const feedback = (
    <>
      {message && CONFIRMATIONS.includes(message) ? (
        <View style={styles.line}>
          <Icon name="check" size={18} color={p.primary} strokeWidth={2.4} />
          <AppText variant="bodySm" tone="soft" style={styles.flex}>
            {t(message)}
          </AppText>
        </View>
      ) : message ? (
        <Banner tone="amber" icon={null} accessibilityRole="alert" actions={needsConsent ? consentButton : undefined}>
          {t(message)}
        </Banner>
      ) : null}
      {mutationError ? <ErrorText>{t(errorMessageKey(mutationError))}</ErrorText> : null}
    </>
  );

  // The standing notice at the interest field (PRIVACY.md §3.2), verbatim.
  const noticeBox = (
    <View style={[styles.notice, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Icon name="info" size={20} color={p.primary} style={styles.noticeIcon} />
      <AppText variant="caption" tone="soft" style={styles.flex}>
        {notice.kind === 'interestNotice' ? notice.content.text : ''}
      </AppText>
    </View>
  );

  const suggestionBox = suggestion
    ? (() => {
        const [before, after = ''] = t('interests.didYouMeanBy', { label: LABEL_MARK, text: suggestion.text }).split(LABEL_MARK);
        return (
          <Banner
            tone="amber"
            icon={null}
            actions={
              <>
                <Button
                  testID="suggestion-confirm"
                  label={t('interests.sameThing')}
                  size="xs"
                  inline
                  onPress={() => {
                    confirmSuggestion.mutate({ interestId: suggestion.interestId, conceptId: suggestion.conceptId });
                    setSuggestion(null);
                  }}
                />
                <Button testID="suggestion-dismiss" label={t('interests.keepIt')} variant="secondary" size="xs" inline onPress={() => setSuggestion(null)} />
              </>
            }
          >
            <AppText variant="bodySm">
              {before}
              <AppText variant="bodySm" style={Fonts.bold}>
                {suggestion.label}
              </AppText>
              {`${after} ${t('interests.didYouMeanWhy')}`}
            </AppText>
          </Banner>
        );
      })()
    : null;

  const popular =
    chips.length > 0 ? (
      <View style={styles.section}>
        <SectionTitle title={areaLabel ? t('interests.popularIn', { area: areaLabel }) : t('interests.popularNearYou')} />
        <ChipRow>
          {chips.map((chip) => (
            <ChipButton
              key={chip.conceptId}
              icon="plus"
              label={chip[locale]}
              accessibilityLabel={t('interests.addNamed', { name: chip[locale] })}
              disabled={!ready}
              onPress={() => void submit(chip[locale])}
            />
          ))}
        </ChipRow>
      </View>
    ) : null;

  const pendingText = (row: Row) =>
    row.pendingUntil !== null && row.pendingUntil > 0
      ? t('interests.pendingConsent', { when: formatDateTime(row.pendingUntil, locale) })
      : t('interests.pendingConsentNoDate');

  const nudge = (min: number) =>
    rows.length < min ? (
      <AppText variant="caption" tone="muted">
        {t('interests.nudge', { min: MIN_INTERESTS, nudge: NUDGE_INTERESTS })}
      </AppText>
    ) : null;

  const readMore = <TextLink label={t('interests.readMoreSensitive')} onPress={() => router.push('/info/sensitive-interests')} />;

  if (mode === 'onboarding') {
    const openRow = rows.find((r) => r.id === openId) ?? null;
    return (
      <View style={styles.root}>
        {status}
        {addRow}
        {feedback}
        {noticeBox}

        <View style={styles.section}>
          <SectionTitle title={t('interests.yours')} detail={rows.length > 0 ? t('interests.addedCount', { count: rows.length }) : undefined} />
          {rows.length === 0 ? (
            <AppText variant="caption" tone="muted">
              {t('interests.empty')}
            </AppText>
          ) : (
            <ChipRow>
              {rows.map((row) => (
                <InterestChip
                  key={row.id}
                  row={row}
                  open={row.id === openId}
                  label={
                    row.locked
                      ? t('interests.privateLabel', { name: row.display })
                      : row.starred
                        ? t('interests.starredLabel', { name: row.display })
                        : row.display
                  }
                  removeLabel={t('interests.removeNamed', { name: row.display })}
                  onPress={() => setOpenId(row.id === openId ? null : row.id)}
                  onRemove={() => removeRow(row)}
                />
              ))}
            </ChipRow>
          )}
          {openRow ? (
            <Card padding={12} gap={8} radius="md">
              <AppText variant="bodySm" style={Fonts.bold}>
                {openRow.display}
              </AppText>
              <ChipRow>
                {openRow.locked ? (
                  <ChipButton label={t('interests.notSensitiveForMe')} disabled={!ready} onPress={() => choosePrivacy(openRow, 'notSensitiveForMe')} />
                ) : (
                  <ChipButton
                    label={t('interests.keepPrivate')}
                    tone="violet"
                    icon="lock"
                    disabled={!ready}
                    onPress={() => choosePrivacy(openRow, 'selfFlagPrivate')}
                  />
                )}
              </ChipRow>
            </Card>
          ) : null}
          {rows.length > 0 ? (
            <AppText variant="caption" tone="muted">
              {t('interests.tapHint')}
            </AppText>
          ) : null}
          {nudge(NUDGE_INTERESTS)}
        </View>

        {ordinary
          .filter((row) => row.pendingUntil !== null)
          .map((row) => (
            <Banner key={row.id} tone="amber" icon="clock" title={row.display} actions={hasArt9Consent ? undefined : consentButton}>
              {pendingText(row)}
            </Banner>
          ))}

        {suggestionBox}
        {popular}
        {readMore}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {status}
      {addRow}
      {feedback}
      {noticeBox}
      {suggestionBox}

      {rows.length === 0 ? (
        <AppText variant="bodySm" tone="muted">
          {t('interests.empty')}
        </AppText>
      ) : null}
      {nudge(MIN_INTERESTS)}

      {ordinary.length > 0 ? (
        <ListGroup title={t('interests.ordinaryTitle')}>
          {ordinary.map((row) => {
            const expanded = row.id === openId;
            return (
              <View key={row.id} style={styles.listRow}>
                <View style={styles.listRowMain}>
                  <StarButton label={t('interests.star')} starred={row.starred} onChange={(on) => setStar(row.id, on)} />
                  <AppText variant="rowTitle" style={styles.flex}>
                    {row.display}
                  </AppText>
                  <MoreButton
                    label={t('interests.moreFor', { name: row.display })}
                    expanded={expanded}
                    onPress={() => setOpenId(expanded ? null : row.id)}
                  />
                </View>
                {row.pendingUntil !== null ? (
                  <View style={styles.rowExtra}>
                    <AppText variant="caption" tone="amber">
                      {pendingText(row)}
                    </AppText>
                    {hasArt9Consent ? null : consentButton}
                  </View>
                ) : null}
                {expanded ? (
                  <View style={styles.rowExtra}>
                    <ChipRow>
                      <ChipButton
                        label={t('interests.keepPrivate')}
                        tone="violet"
                        icon="lock"
                        disabled={!ready}
                        onPress={() => choosePrivacy(row, 'selfFlagPrivate')}
                      />
                      <ChipButton label={t('interests.remove')} tone="coral" icon="trash" onPress={() => removeRow(row)} />
                    </ChipRow>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ListGroup>
      ) : null}

      {locked.length > 0 ? (
        <View style={[styles.privateCard, { backgroundColor: p.surface, borderColor: p.violetBorder }]}>
          <SectionTitle title={t('interests.privateTitle')} variant="overline" tone="violet" icon="lock" />
          {locked.map((row, i) => (
            <View key={row.id} style={[styles.privateRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider }]}>
              <View style={styles.listRowMain}>
                <StarButton label={t('interests.star')} starred={row.starred} onChange={(on) => setStar(row.id, on)} />
                <View style={styles.privateText}>
                  <AppText variant="rowTitle" accessibilityLabel={t('interests.privateLabel', { name: row.display })}>
                    {row.display}
                  </AppText>
                  {row.consentedAt !== null ? (
                    <AppText variant="micro" tone="muted">
                      {t('interests.consentGiven', { date: formatDay(row.consentedAt, locale) })}
                    </AppText>
                  ) : null}
                </View>
                <ChipButton
                  label={t('interests.removeWithdraw')}
                  accessibilityLabel={t('interests.removeWithdrawFor', { name: row.display })}
                  tone="coral"
                  size="lg"
                  onPress={() => removeRow(row)}
                />
              </View>
              <View style={styles.rowExtra}>
                <TextLink
                  label={t('interests.notSensitiveForMe')}
                  role="button"
                  size="sm"
                  onPress={() => choosePrivacy(row, 'notSensitiveForMe')}
                />
              </View>
            </View>
          ))}
          <AppText variant="caption" tone="muted">
            {t('interests.privateNote')}
          </AppText>
        </View>
      ) : null}

      {popular}
      {readMore}
    </View>
  );
}

/** The green "Add" next to the field: 14-pt corners, the field's height (storyboards 1.5, 5.2). */
function AddButton({
  label,
  onPress,
  height,
  disabled,
  busy,
  testID,
}: {
  label: string;
  onPress: () => void;
  height: number;
  disabled: boolean;
  busy: boolean;
  testID?: string;
}) {
  const p = usePalette();
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.addButton, { minHeight: height, backgroundColor: disabled ? p.disabledBg : pressed ? p.primaryPressed : p.primary }]}
    >
      {busy ? <ActivityIndicator color={p.onPrimary} /> : <Text style={[Type.button, { color: disabled ? p.disabledText : p.onPrimary }]}>{label}</Text>}
    </Pressable>
  );
}

/** One of "Your interests" (storyboard 1.5): ink, or violet with a lock when private; an amber star (`starOnInk`) when starred. */
function InterestChip({
  row,
  open,
  label,
  removeLabel,
  onPress,
  onRemove,
}: {
  row: Row;
  open: boolean;
  label: string;
  removeLabel: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const p = usePalette();
  const bg = row.locked ? p.violet : p.ink;
  const fg = row.locked ? p.onViolet : p.onInk;
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: open ? p.primary : bg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [styles.chipBody, pressed && styles.pressed]}
      >
        {row.locked ? (
          <Icon name="lock" size={14} strokeWidth={2.2} color={fg} />
        ) : row.starred ? (
          <Icon name="starFilled" size={14} color={p.starOnInk} />
        ) : null}
        <Text style={[Type.chip, { color: fg }]}>{row.display}</Text>
      </Pressable>
      <IconButton icon="close" label={removeLabel} onPress={onRemove} size={28} iconSize={14} color={fg} />
    </View>
  );
}

/** The 40-pt star toggle of storyboard 5.2 (role switch, named "Star"). */
function StarButton({ label, starred, onChange }: { label: string; starred: boolean; onChange: (on: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: starred }}
      onPress={() => onChange(!starred)}
      hitSlop={2}
      style={({ pressed }) => [styles.iconTarget, styles.starTarget, pressed && { backgroundColor: p.subtle }]}
    >
      {starred ? (
        <View>
          <Icon name="starFilled" size={20} color={p.amber} />
          <Icon name="star" size={20} strokeWidth={1.5} color={p.amberText} style={StyleSheet.absoluteFill} />
        </View>
      ) : (
        <Icon name="star" size={20} strokeWidth={1.8} color={p.muted} />
      )}
    </Pressable>
  );
}

/** The "···" button that shows a row's actions ("Keep this private", "Remove") under it. */
function MoreButton({ label, expanded, onPress }: { label: string; expanded: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [styles.iconTarget, (pressed || expanded) && { backgroundColor: p.subtle }]}
    >
      <Icon name="more" size={20} color={p.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  section: { gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  addButton: { borderRadius: Radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.ms, paddingHorizontal: 14 },
  noticeIcon: { marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderRadius: 18, borderWidth: 2, paddingLeft: 10, paddingRight: 2 },
  chipBody: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconTarget: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  starTarget: { marginLeft: -8 },
  listRow: { paddingVertical: 6 },
  listRowMain: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Under the row's text: the 40-pt star sits 8 pt into the gutter, then a 10-pt gap.
  rowExtra: { paddingLeft: 42, paddingBottom: 6, gap: Spacing.sm, alignItems: 'flex-start' },
  privateCard: { borderWidth: 1, borderRadius: Radius.xl, paddingVertical: 14, paddingHorizontal: Spacing.md, gap: 10 },
  privateRow: { paddingTop: 4 },
  privateText: { flex: 1, gap: 2 },
});
