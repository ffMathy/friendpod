import type { Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import { Button, Checkbox, ErrorText, Eyebrow, Icon, Strong, Text, TextLink, Title } from '@/components/ui';
import { art9BlanketCopy, consentPayload, type ConsentPayload } from './art9';

export interface Art9BlanketConsentProps {
  readonly locale: Locale;
  readonly onAgree: (consent: ConsentPayload) => void;
  readonly onNotNow: () => void;
  readonly onReadMore: () => void;
  readonly busy?: boolean;
  readonly error?: string | null;
}

/**
 * The blanket Art. 9 consent (D3, PRIVACY.md §3.3) in one column: the eyebrow and title, the verbatim copy, then the
 * actions. The onboarding step (onb-consent) puts the copy in its own scrolling box with the actions under it.
 * Saying no keeps the app usable; sensitive tags are then refused when added, so the consent stays freely given.
 * Private stays quiet: Ink and white only, no colour anywhere.
 */
export function Art9BlanketConsent({ locale, onAgree, onNotNow, onReadMore, busy = false, error = null }: Art9BlanketConsentProps) {
  const [checked, setChecked] = useState(false);
  return (
    <View style={styles.column}>
      <Art9ConsentHeading locale={locale} />
      <Art9ConsentBody locale={locale} onReadMore={onReadMore} />
      <Art9ConsentActions locale={locale} checked={checked} onCheck={setChecked} onAgree={onAgree} onNotNow={onNotNow} busy={busy} error={error} />
    </View>
  );
}

/**
 * The "Private interests" eyebrow (12/800 caps in Ink, with a 14 px Ink lock) over the consent's own title, Title
 * 30/32 (onb-consent). Quiet: no badge fill.
 */
export function Art9ConsentHeading({ locale }: { readonly locale: Locale }) {
  const { t } = useTranslation();
  const p = usePalette();
  const { copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.heading}>
      <View style={styles.eyebrow}>
        <Icon name="lock" size={14} strokeWidth={2.2} color={p.privateText} />
        <Eyebrow color="privateText">{t('onboarding.consent.badge')}</Eyebrow>
      </View>
      <Title>{copy.title}</Title>
    </View>
  );
}

export interface Art9ConsentBodyProps {
  readonly locale: Locale;
  readonly onReadMore: () => void;
  /**
   * The copy sits in a white box (onb-consent): the note is a Paper inset. Default: on the Paper page, where the note is
   * a white card with a 1 px Line border.
   */
  readonly onCard?: boolean;
}

/**
 * The consent text, verbatim from @grouper/core (its hash is what the server records), set as onb-consent sets it:
 * 14/1.55 prose in Ink 2, the list intro in bold Ink, the bullets, and the note in its own box. Nothing reworded,
 * nothing added: the emphasis is the copy's own structure (the list intro and the note's label).
 */
export function Art9ConsentBody({ locale, onReadMore, onCard = false }: Art9ConsentBodyProps) {
  const { copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.body}>
      <Text variant="small" color="textSecondary" style={styles.prose}>
        {copy.intro}
      </Text>
      <Text variant="smallBold" color="text" style={styles.prose}>
        {copy.listIntro}
      </Text>
      <View style={styles.list}>
        {copy.bullets.map((bullet) => (
          <View key={bullet} style={styles.bullet}>
            <Text variant="small" color="textSecondary" style={[styles.prose, styles.dot]} accessibilityElementsHidden importantForAccessibility="no">
              {'•'}
            </Text>
            <Text variant="small" color="textSecondary" style={[styles.prose, styles.flex]}>
              {bullet}
            </Text>
          </View>
        ))}
      </View>
      <ConsentNote label={copy.note.label} text={copy.note.text} onCard={onCard} />
      <Text variant="small" color="textSecondary" style={styles.prose}>
        {copy.override}
      </Text>
      <Text variant="small" color="textSecondary" style={styles.prose}>
        {copy.withdrawal}
      </Text>
      <TextLink testID="art9-read-more" label={copy.readMore} onPress={onReadMore} />
    </View>
  );
}

/** The note inside the copy: a Paper inset inside the white box, or a white card on the Paper page. */
function ConsentNote({ label, text, onCard }: { readonly label: string; readonly text: string; readonly onCard: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.note, onCard ? { backgroundColor: p.inset } : { backgroundColor: p.surface, borderWidth: BorderWidth.hairline, borderColor: p.border }]}>
      <Text variant="small" color="textSecondary" style={styles.prose}>
        <Strong color="text">{label}</Strong> {text}
      </Text>
    </View>
  );
}

export interface Art9ConsentBoxProps {
  readonly locale: Locale;
  readonly onReadMore: () => void;
  /**
   * Scroll the copy inside the box (default), which then takes the room it is given (`flex: 1`): give it a bounded
   * parent (a non-scrolling screen). `false`: the box is as tall as the copy and scrolls with the page.
   */
  readonly scrollInside?: boolean;
  /** The box's size, to tell whether the room it was given is enough to read in. */
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * The copy in its own box (onb-consent): white, a 1.5 px Ink border (private stays quiet), radius 22. By default it
 * fills the room between the title and the actions and the copy scrolls inside it, so the title above and the consent
 * box and buttons below stay in view.
 */
export function Art9ConsentBox({ locale, onReadMore, scrollInside = true, onLayout }: Art9ConsentBoxProps) {
  const p = usePalette();
  const body = <Art9ConsentBody locale={locale} onReadMore={onReadMore} onCard />;
  return (
    <View testID="art9-text" onLayout={onLayout} style={[styles.box, scrollInside ? styles.flex : null, { backgroundColor: p.privateBg, borderColor: p.privateBorder }]}>
      {scrollInside ? (
        <ScrollView testID="art9-text-scroll" style={styles.flex} contentContainerStyle={styles.boxContent} nestedScrollEnabled persistentScrollbar>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.boxContent}>{body}</View>
      )}
    </View>
  );
}

export interface Art9ConsentActionsProps {
  readonly locale: Locale;
  readonly checked: boolean;
  readonly onCheck: (checked: boolean) => void;
  readonly onAgree: (consent: ConsentPayload) => void;
  readonly onNotNow: () => void;
  readonly busy?: boolean;
  readonly error?: string | null;
}

/**
 * The explicit-consent box (unticked, a white card), "I agree" (Skov, disabled until the box is ticked) and "Not now"
 * as a quiet underlined Ink 2 action, which carries on with nothing recorded. The labels are part of the locked copy.
 */
export function Art9ConsentActions({ locale, checked, onCheck, onAgree, onNotNow, busy = false, error = null }: Art9ConsentActionsProps) {
  const { textId, copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.actions}>
      <Checkbox testID="art9-checkbox" variant="card" label={copy.checkbox} checked={checked} onChange={onCheck} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="art9-agree" label={copy.agreeButton} disabled={!checked} busy={busy} onPress={() => onAgree(consentPayload(textId))} />
      <QuietAction testID="art9-not-now" label={copy.notNowButton} disabled={busy} onPress={onNotNow} />
    </View>
  );
}

/**
 * onb-consent's "Continue without": Ink 2 15/700, underlined, centred, a 44 px target. A button (it acts: it carries on
 * without recording anything), disabled while the consent is being sent. The DS quiet link has no disabled state.
 */
function QuietAction({ label, onPress, disabled, testID }: { readonly label: string; readonly onPress: () => void; readonly disabled: boolean; readonly testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quiet, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
    >
      <Text variant="buttonSmall" color="textSecondary" style={styles.underline}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  flex: { flex: 1 },
  heading: { gap: 4 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { gap: 10 },
  // onb-consent sets the consent prose at 14/1.55.
  prose: { lineHeight: 22 },
  list: { gap: 6, paddingLeft: 6 },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { width: 8 },
  note: { borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  box: { borderWidth: BorderWidth.control, borderRadius: Radius.card, paddingVertical: 6, overflow: 'hidden' },
  boxContent: { paddingVertical: 6, paddingHorizontal: 14 },
  actions: { gap: 8 },
  quiet: { alignSelf: 'center', minHeight: Size.hitTarget, paddingHorizontal: 12, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
