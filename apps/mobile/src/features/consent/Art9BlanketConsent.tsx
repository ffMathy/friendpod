import type { Locale } from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Fonts, Radius, Spacing, usePalette } from '@/components/theme';
import { AppText, Button, Checkbox, ErrorText, Pill, Screen, TextLink, Title } from '@/components/ui';
import { art9BlanketCopy, consentPayload, type ConsentPayload } from './art9';

export interface Art9BlanketConsentProps {
  readonly locale: Locale;
  readonly onAgree: (consent: ConsentPayload) => void;
  readonly onNotNow: () => void;
  readonly onReadMore: () => void;
  readonly busy?: boolean;
  readonly error?: string | null;
  /**
   * 'inline' (default): a column for the caller's Screen. 'screen': its own Screen, with the checkbox and buttons
   * pinned at the bottom (storyboard 1.4) wherever the phone has the room for them.
   */
  readonly layout?: 'inline' | 'screen';
  /** Above the copy: the onboarding StepHeader, or a ScreenHeader in Settings. */
  readonly header?: ReactNode;
}

/** Below this height (in points at the user's text size) the pinned actions would crowd out the copy. */
const MIN_HEIGHT_FOR_PINNED = 700;

/**
 * The blanket Art. 9 consent (D3, PRIVACY.md §3.3), on its own screen: verbatim copy from @grouper/core, an unticked
 * checkbox, "I agree" disabled until it is ticked, and "Not now", which carries on with nothing recorded. Saying no
 * keeps the app usable; sensitive tags are then refused when added, so the consent stays freely given, and "Not now"
 * is as prominent as "I agree" (PRIVACY.md §3.9).
 */
export function Art9BlanketConsent({ locale, onAgree, onNotNow, onReadMore, busy = false, error = null, layout = 'inline', header }: Art9BlanketConsentProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const { height, fontScale } = useWindowDimensions();
  const [checked, setChecked] = useState(false);
  const { textId, copy } = art9BlanketCopy(locale);

  const body = (
    <>
      {header}
      <View style={styles.titleBlock}>
        <Pill label={t('interests.privateTitle')} tone="violet" icon="lock" size="lg" />
        <Title>{copy.title}</Title>
      </View>
      <View style={styles.copy}>
        <AppText variant="bodySm">{copy.intro}</AppText>
        <AppText variant="bodySm" style={Fonts.bold}>
          {copy.listIntro}
        </AppText>
        <View style={styles.list}>
          {copy.bullets.map((bullet) => (
            <View key={bullet} style={styles.bullet}>
              <AppText variant="bodySm" accessibilityElementsHidden importantForAccessibility="no">
                •
              </AppText>
              <AppText variant="bodySm" style={styles.flex}>
                {bullet}
              </AppText>
            </View>
          ))}
        </View>
        <View style={[styles.note, { backgroundColor: p.surface, borderColor: p.border }]}>
          <AppText variant="bodySm">
            <AppText variant="bodySm" style={Fonts.bold}>
              {copy.note.label}
            </AppText>{' '}
            {copy.note.text}
          </AppText>
        </View>
        <AppText variant="bodySm">{copy.override}</AppText>
        <AppText variant="bodySm">{copy.withdrawal}</AppText>
        <TextLink label={copy.readMore} onPress={onReadMore} size="sm" />
      </View>
    </>
  );

  const actions = (
    <View style={styles.actions}>
      <Checkbox testID="art9-checkbox" variant="card" label={copy.checkbox} checked={checked} onChange={setChecked} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        testID="art9-agree"
        label={copy.agreeButton}
        variant="accent"
        disabled={!checked}
        busy={busy}
        onPress={() => onAgree(consentPayload(textId))}
      />
      {/* Secondary, not text-only: refusing must be as easy to see as agreeing (freely given, EDPB 05/2020). */}
      <Button testID="art9-not-now" label={copy.notNowButton} variant="secondary" disabled={busy} onPress={onNotNow} />
    </View>
  );

  if (layout === 'screen') {
    const pinned = height / Math.max(1, fontScale) >= MIN_HEIGHT_FOR_PINNED;
    return (
      <Screen wide gap={14} footer={pinned ? actions : undefined}>
        {body}
        {pinned ? null : actions}
      </Screen>
    );
  }
  return (
    <View style={styles.inline}>
      {body}
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { gap: 14 },
  titleBlock: { gap: Spacing.sm },
  copy: { gap: 10 },
  list: { gap: 6, paddingLeft: 4 },
  bullet: { flexDirection: 'row', gap: 10 },
  note: { borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.ms },
  actions: { gap: 10 },
});
