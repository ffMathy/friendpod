/**
 * The pieces of the interests screens that only this area uses (priv-interests.dc.html, onb-interests.dc.html, blend
 * spec §6.3, §6.5, §6.6, §9): the star toggle and the "…" button of an interest row, the 44 px row actions ("Keep this
 * private", "Remove & withdraw"), the "Did you mean" note, the eyebrow of the private card and the list card's title.
 * The add row is the design system's `AddField`; chips are its `Chip`.
 */
import { DROP_TIME_ZONE, type Locale } from '@friendpod/core';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { BorderWidth, font, Radius, Size, usePalette } from '@/components/theme';
import { Button, Icon, NeedsYouMarker, Note, Overline, Text, type IconName } from '@/components/ui';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

/**
 * "4 Nov 2026" / "4. nov. 2026": the day a consent was given, in Copenhagen time. The spaces are non-breaking, so a
 * narrow line wraps before the date rather than inside it.
 */
export function formatDay(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: DROP_TIME_ZONE })
    .format(new Date(ms))
    .replace(/ /g, ' ');
}

type RowActionTone = 'secondary' | 'danger';

const ROW_ACTIONS: Record<RowActionTone, { icon: number; gap: number; padLeft: number; padRight: number; type: 'captionBold' | 'smallBold' }> = {
  /** "Keep this private": white, 1.5 px Outline, 14 px lock, Ink 13/700 (priv-interests' row button). */
  secondary: { icon: 14, gap: 5, padLeft: 10, padRight: 12, type: 'captionBold' },
  /** "Remove & withdraw", "Remove": white, 1.5 px Danger, 16 px trash, Danger 14/700 (spec §6.1, danger outline 44). */
  danger: { icon: 16, gap: 6, padLeft: 12, padRight: 14, type: 'smallBold' },
};

export interface RowActionProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: RowActionTone;
  /** Default: `lock` for secondary, `trash` for danger; `null` for none. */
  readonly icon?: IconName | null;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/**
 * A 44 px pill action inside a list row or card, on the storyboard's compact metrics (13/700 or 14/700, a 14 or 16 px
 * icon). `Button size="sm"` sets its label in 15/700, which does not fit "Keep this private" beside an interest.
 */
export function RowAction({ label, onPress, tone = 'secondary', icon, accessibilityLabel, disabled = false, testID }: RowActionProps) {
  const p = usePalette();
  const look = ROW_ACTIONS[tone];
  const glyph = icon === null ? null : (icon ?? (tone === 'danger' ? 'trash' : 'lock'));
  const fg = disabled ? p.disabledText : tone === 'danger' ? p.danger : p.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowAction,
        {
          gap: look.gap,
          paddingLeft: look.padLeft,
          paddingRight: look.padRight,
          backgroundColor: pressed ? (tone === 'danger' ? p.dangerPressedBg : p.page) : p.surface,
          borderColor: disabled ? p.track : tone === 'danger' ? p.danger : p.borderStrong,
        },
      ]}
    >
      {glyph ? <Icon name={glyph} size={look.icon} strokeWidth={2.2} color={fg} /> : null}
      <Text variant={look.type} style={[styles.rowActionText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The 44 px star toggle at the start of a row: Ink, filled when it is a main interest (never yellow). */
export function StarButton({ name, starred, onPress, testID }: { name: string; starred: boolean; onPress: () => void; testID?: string }) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="togglebutton"
      accessibilityLabel={t('interests.starNamed', { name })}
      accessibilityState={{ checked: starred }}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, styles.starButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={starred ? 'starFilled' : 'star'} size={20} color={p.text} />
    </Pressable>
  );
}

/** The 44 px "…" at the end of a row (Muted dots); opens the row's actions under it. */
export function MoreButton({ name, expanded, onPress, testID }: { name: string; expanded: boolean; onPress: () => void; testID?: string }) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('interests.moreNamed', { name })}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, styles.moreButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="more" size={20} color={p.textMuted} />
    </Pressable>
  );
}

/**
 * "Did you mean brætspil by “brætspilsaften”? Saying yes puts you with more people." (spec §6.5): a needs-you note,
 * white with the ringed Solsikke marker at the start of the first line and the text wrapping under it (the marker is
 * an inline view in the text, like the storyboard's inline span), then "Yes, same thing" (Skov) beside "No, keep it"
 * (secondary). A question only this user can answer, so it is needs-you.
 */
export function SuggestionNote({ label, typed, onYes, onNo }: { label: string; typed: string; onYes: () => void; onNo: () => void }) {
  const { t } = useTranslation();
  return (
    <Note
      tone="needsYou"
      icon={null}
      testID="interest-suggestion"
      actions={
        <>
          <Button variant="primary" size="sm" label={t('interests.useSuggestion')} onPress={onYes} />
          <Button variant="secondary" size="sm" label={t('interests.keepOwnWording')} onPress={onNo} />
        </>
      }
    >
      <Text variant="small" style={styles.suggestionText}>
        <View style={styles.marker}>
          <NeedsYouMarker />
        </View>
        <Trans i18nKey="interests.didYouMean" values={{ label, typed }} components={{ b: <RNText style={font('700')} /> }} />
      </Text>
    </Note>
  );
}

/** "🔒 PRIVATE INTERESTS": the private card's eyebrow, in Ink with a 14 px lock; `trailing` sits at its end ("Off"). */
export function PrivateHeader({ trailing }: { trailing?: ReactNode }) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <View style={styles.privateHeader}>
      <Icon name="lock" size={14} strokeWidth={2.2} color={p.privateText} />
      <Overline color="privateText" style={[styles.overline, styles.flex]}>
        {t('interests.privateTitle')}
      </Overline>
      {trailing}
    </View>
  );
}

/** The eyebrow at the top of the interests list card ("INTERESTS"), 10 px under the card's edge, 4 px over the rows. */
export function ListCardTitle({ children }: { children: string }) {
  return (
    <View style={styles.listTitle}>
      <Overline style={styles.overline}>
        {children}
      </Overline>
    </View>
  );
}

/** The heading of a group on onb-interests ("Your interests · 5 added", "Popular in Aarhus"): 15/700 on a 20 px line. */
export function GroupHeading({ title, count }: { title: string; count?: string }) {
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

/**
 * What tapping an interest chip offers in onboarding ("Tap an interest to change that"): a white note (1 px Line; a
 * private interest's has the quiet 1.5 px Ink border) with one sentence and the one change that applies.
 */
export function ChipOptions({ text, isPrivate, children }: { text: string; isPrivate: boolean; children: ReactNode }) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.options,
        {
          backgroundColor: isPrivate ? p.privateBg : p.surface,
          borderColor: isPrivate ? p.privateBorder : p.border,
          borderWidth: isPrivate ? BorderWidth.control : BorderWidth.hairline,
        },
      ]}
    >
      <Text variant="small" color="textSecondary" style={styles.optionsText}>
        {text}
      </Text>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowAction: {
    height: Size.hitTarget,
    borderRadius: Size.hitTarget / 2,
    borderWidth: BorderWidth.control,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowActionText: { flexShrink: 1 },
  iconButton: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  /** The glyph lines up with the card's 16 px inset, as on the storyboard. */
  starButton: { marginLeft: -12 },
  moreButton: { marginRight: -10 },
  suggestionText: { lineHeight: Math.round(14 * 1.45) },
  /** The 20 px marker and 6 px before the text, at the top of the first line (vertical-align: top on the storyboard). */
  marker: { width: 26, height: 20, verticalAlign: 'top' },
  privateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { lineHeight: 16 },
  listTitle: { marginTop: 10, marginBottom: 4 },
  groupHeading: { lineHeight: 20 },
  options: { borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  optionsText: { lineHeight: Math.round(14 * 1.45) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
