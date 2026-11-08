/**
 * The pieces of the interests screens that only this area uses (priv-interests.dc.html, onb-interests.dc.html):
 * the star toggle and the "…" button of a list row, the small pills ("Keep this private", "Remove & withdraw"),
 * the "Did you mean" notice, the purple header of the private-interests card and the "How private interests work" link.
 */
import { DROP_TIME_ZONE, type Locale } from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, Text as RNText, StyleSheet, TextInput, View } from 'react-native';
import { BorderWidth, font, Radius, Size, typeStyle, usePalette, type PaletteKey } from '@/components/theme';
import { Banner, Button, Icon, Overline, Text } from '@/components/ui';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

/**
 * "4 Nov 2026" / "4. nov. 2026": the day a consent was given, in Copenhagen time. The spaces are non-breaking, so a
 * narrow line wraps before the date rather than inside it.
 */
export function formatDay(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: DROP_TIME_ZONE })
    .format(new Date(ms))
    .replace(/ /g, '\u00a0');
}

/** The two add rows: the tab's (priv-interests: 50 px, 16 px text) and onboarding's (onb-interests: 52 px, 17 px). */
const ADD_FIELD = {
  tab: { height: 50, type: 'lede' },
  onboarding: { height: Size.inputCompact, type: 'input' },
} as const;

export interface AddFieldProps {
  readonly look: keyof typeof ADD_FIELD;
  /** The input's accessibility label (the storyboards keep it visually hidden). */
  readonly label: string;
  readonly placeholder: string;
  readonly addLabel: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
  /** False until the on-device model is ready. */
  readonly ready: boolean;
  readonly busy: boolean;
}

/**
 * "Add an interest" with the green r14 "Add" beside it. The input follows the storyboards (14 px inset, input border,
 * 2 px green when focused) and its placeholder uses the muted text colour, which reads on white (the faint grey did not).
 */
export function AddField({ look, label, placeholder, addLabel, value, onChangeText, onSubmit, ready, busy }: AddFieldProps) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const spec = ADD_FIELD[look];
  const borderWidth = focused ? BorderWidth.strong : BorderWidth.hairline;
  return (
    <View style={styles.addRow}>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={p.textMuted}
        value={value}
        onChangeText={onChangeText}
        maxLength={80}
        autoCapitalize="none"
        returnKeyType="done"
        editable={ready}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          typeStyle(spec.type),
          styles.addInput,
          {
            height: spec.height,
            lineHeight: undefined,
            color: p.text,
            backgroundColor: p.surface,
            borderColor: focused ? p.primary : p.borderStrong,
            borderWidth,
            paddingHorizontal: 14 - (borderWidth - 1),
          },
        ]}
      />
      <Button
        testID="interest-add"
        label={addLabel}
        shape="rounded"
        fullWidth={false}
        busy={busy}
        disabled={!ready}
        onPress={onSubmit}
        style={[styles.addButton, { minHeight: spec.height }]}
      />
    </View>
  );
}

type PillTone = 'private' | 'danger' | 'neutral';

const PILLS: Record<PillTone, { bg: PaletteKey; fg: PaletteKey; border: PaletteKey }> = {
  /** "Keep this private": white, lilac border, purple text. */
  private: { bg: 'surface', fg: 'privateText', border: 'privateBorder' },
  /** "Remove & withdraw", "Remove": red tint. */
  danger: { bg: 'surface', fg: 'danger', border: 'danger' },
  /** "This isn't sensitive for me". */
  neutral: { bg: 'surface', fg: 'text', border: 'borderStrong' },
};

export interface PillProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: PillTone;
  /** `sm` 34 px, 12/700 (in a list row); `md` 40 px, 13/700 ("Remove & withdraw"). The touch target is 44 either way. */
  readonly size?: 'sm' | 'md';
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/** A small outlined pill action inside a list row. */
export function Pill({ label, onPress, tone = 'neutral', size = 'sm', accessibilityLabel, disabled = false, testID }: PillProps) {
  const p = usePalette();
  const look = PILLS[tone];
  const height = size === 'sm' ? 34 : Size.buttonSmall;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={(Size.hitTarget - height) / 2}
      style={({ pressed }) => [
        styles.pill,
        {
          height,
          borderRadius: height / 2,
          paddingHorizontal: size === 'sm' ? 10 : 12,
          backgroundColor: p[look.bg],
          borderColor: p[look.border],
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text variant={size === 'sm' ? 'microBold' : 'captionBold'} color={look.fg} style={size === 'sm' ? styles.pillTextSm : styles.pillTextMd}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The 40 px star toggle at the start of a row (yellow when starred, grey outline otherwise). */
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
      hitSlop={2}
      style={({ pressed }) => [styles.iconButton, styles.starButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      {starred ? <Icon name="starFilled" size={20} /> : <Icon name="star" size={20} color={p.field} />}
    </Pressable>
  );
}

/** The 40 px "…" at the end of a row; opens the row's actions under it. */
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
      hitSlop={2}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="more" size={20} color={p.textMuted} />
    </Pressable>
  );
}

/** "Did you mean brætspil by “brætspilsaften”?" with "Yes, same thing" and "No, keep it" (amber notice). */
export function SuggestionBanner({ label, typed, onYes, onNo }: { label: string; typed: string; onYes: () => void; onNo: () => void }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone="needsYou"
      icon={null}
      testID="interest-suggestion"
      actions={
        <>
          <Button variant="primary" size="xs" label={t('interests.useSuggestion')} onPress={onYes} />
          <Button variant="outline" size="xs" label={t('interests.keepOwnWording')} onPress={onNo} />
        </>
      }
    >
      <Text variant="small" style={styles.suggestion}>
        <Trans i18nKey="interests.didYouMean" values={{ label, typed }} components={{ b: <RNText style={font('700')} /> }} />
      </Text>
    </Banner>
  );
}

/** "🔒 PRIVATE INTERESTS" in purple, the private card's header; `trailing` sits at its end (the "Off" badge). */
export function PrivateHeader({ trailing }: { trailing?: ReactNode }) {
  const p = usePalette();
  const { t } = useTranslation();
  return (
    <View style={styles.privateHeader}>
      <Icon name="lock" size={14} color={p.privateText} />
      <Overline color="privateText" style={[styles.overline, styles.flex]}>
        {t('interests.privateTitle')}
      </Overline>
      {trailing}
    </View>
  );
}

/**
 * "🔒 How private interests work": one line under the lists that opens /info/sensitive-interests, where the standing
 * notice (interest-notice-*-v2) is shown in full. Purple like the private card it follows; 44 px tall.
 */
export function PrivateInfoLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.infoLink, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="lock" size={14} color={p.privateText} />
      <Text variant="smallBold" color="privateText" style={styles.underline}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The white r20 list card ("INTERESTS"; private: a lilac border). */
export function ListCard({ children, tone, testID }: { children: ReactNode; tone?: 'private'; testID?: string }) {
  const p = usePalette();
  return (
    <View
      testID={testID}
      style={[
        tone === 'private' ? styles.privateCard : styles.listCard,
        { backgroundColor: p.surface, borderColor: tone === 'private' ? p.privateBorder : p.border },
      ]}
    >
      {children}
    </View>
  );
}

/** The 13/700 uppercase title at the top of the interests card. */
export function ListCardTitle({ children }: { children: string }) {
  return (
    <View style={styles.listTitle}>
      <Overline style={styles.overline}>{children}</Overline>
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1, minWidth: 0, borderRadius: Radius.md },
  addButton: { paddingHorizontal: 18, borderRadius: Radius.md },
  pill: { borderWidth: BorderWidth.hairline, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  /**
   * The storyboards' small labels and h2s keep the font's normal line height, which the browser rounds to whole
   * pixels: 15 at 12 px, 16 at 13 px (the type scale's are 16 and 17, which sat the text 1 px low).
   */
  pillTextSm: { lineHeight: 15 },
  pillTextMd: { lineHeight: 16 },
  overline: { lineHeight: 16 },
  iconButton: { width: Size.buttonSmall, height: Size.buttonSmall, alignItems: 'center', justifyContent: 'center' },
  starButton: { marginLeft: -8 },
  suggestion: { lineHeight: Math.round(14 * 1.45) },
  privateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  /** Pulled up 4 px so the 44 px target leaves the storyboard-like 16 px gap between the card and the text. */
  infoLink: { minHeight: Size.hitTarget, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: -4 },
  underline: { textDecorationLine: 'underline' },
  listCard: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 6, paddingHorizontal: 16 },
  privateCard: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  listTitle: { marginTop: 10, marginBottom: 4 },
});
