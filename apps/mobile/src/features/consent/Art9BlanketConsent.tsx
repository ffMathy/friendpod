import type { Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import { Button, Checkbox, ErrorText, Icon, Strong, Text, TextLink, Title } from '@/components/ui';
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
 * The blanket Art. 9 consent (D3, PRIVACY.md §3.3) in one column (Settings → Privacy): the badge and title, the
 * verbatim copy, then the actions. The onboarding step uses the same parts with the actions pinned to the bottom.
 * Saying no keeps the app usable; sensitive tags are then refused when added, so the consent stays freely given.
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
 * The "Private interests" badge and the consent's own title, 28/800 (onb-consent). The badge is drawn as the storyboard
 * draws it: 30 px, 12 px sides, a 14 px lock, 13/700 in purple on lilac (Badge is 28 px, 13/800).
 */
export function Art9ConsentHeading({ locale }: { readonly locale: Locale }) {
  const { t } = useTranslation();
  const p = usePalette();
  const { copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.heading}>
      <View style={[styles.badge, { backgroundColor: p.privateBg }]}>
        <Icon name="lock" size={14} strokeWidth={2.2} color={p.privateText} />
        <Text variant="captionBold" color="privateText">
          {t('onboarding.consent.badge')}
        </Text>
      </View>
      <Title size="compact">{copy.title}</Title>
    </View>
  );
}

/**
 * The consent text, verbatim from @grouper/core (its hash is what the server records), set as the storyboard sets
 * its own wording: 14/1.55 prose, the list intro in bold, the bullets, the note in a white box.
 */
export function Art9ConsentBody({ locale, onReadMore }: { readonly locale: Locale; readonly onReadMore: () => void }) {
  const { copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.body}>
      <Text variant="small" color="textBody" style={styles.prose}>
        {copy.intro}
      </Text>
      <Text variant="smallBold" style={styles.prose}>
        {copy.listIntro}
      </Text>
      <View style={styles.list}>
        {copy.bullets.map((bullet) => (
          <View key={bullet} style={styles.bullet}>
            <Text variant="small" color="textBody" style={[styles.prose, styles.dot]} accessibilityElementsHidden importantForAccessibility="no">
              {'•'}
            </Text>
            <Text variant="small" color="textBody" style={[styles.prose, styles.flex]}>
              {bullet}
            </Text>
          </View>
        ))}
      </View>
      <Note label={copy.note.label} text={copy.note.text} />
      <Text variant="small" color="textBody" style={styles.prose}>
        {copy.override}
      </Text>
      <Text variant="small" color="textBody" style={styles.prose}>
        {copy.withdrawal}
      </Text>
      <TextLink testID="art9-read-more" label={copy.readMore} onPress={onReadMore} />
    </View>
  );
}

function Note({ label, text }: { readonly label: string; readonly text: string }) {
  const p = usePalette();
  return (
    <View style={[styles.note, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text variant="small" color="textBody" style={styles.prose}>
        <Strong color="text">{label}</Strong> {text}
      </Text>
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
 * The explicit-consent box (unticked), "I agree" (disabled until it is ticked) and "Not now", which carries on with
 * nothing recorded. The labels are part of the locked copy.
 */
export function Art9ConsentActions({ locale, checked, onCheck, onAgree, onNotNow, busy = false, error = null }: Art9ConsentActionsProps) {
  const { textId, copy } = art9BlanketCopy(locale);
  return (
    <View style={styles.actions}>
      <Checkbox testID="art9-checkbox" variant="card" label={copy.checkbox} checked={checked} onChange={onCheck} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="art9-agree" label={copy.agreeButton} disabled={!checked} busy={busy} onPress={() => onAgree(consentPayload(textId))} />
      {/* A 44 px text action with a 15/700 label, as the storyboard's "Continue without". */}
      <Button testID="art9-not-now" label={copy.notNowButton} variant="ghost" size="md" fullWidth disabled={busy} onPress={onNotNow} style={styles.notNow} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 14 },
  flex: { flex: 1 },
  heading: { gap: 8 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15 },
  body: { gap: 10 },
  // The storyboard sets the consent prose at 14/1.55.
  prose: { lineHeight: 22 },
  list: { gap: 6, paddingLeft: 4 },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { width: 8 },
  note: { borderRadius: Radius.md, borderWidth: BorderWidth.hairline, paddingVertical: 10, paddingHorizontal: 12 },
  actions: { gap: 10 },
  notNow: { minHeight: Size.hitTarget },
});
