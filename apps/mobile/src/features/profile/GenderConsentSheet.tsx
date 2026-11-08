import { GENDERS, type Gender, type Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';
import { Body, Button, Checkbox, ChoiceChip, CloseButton, ErrorText, Headline, Small } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { BottomSheet } from '@/features/after/parts';
import { errorMessageKey } from '@/lib/errors';
import { genderConsentCopy, genderConsentPayload } from './genderConsent';

export interface GenderConsentSheetProps {
  readonly visible: boolean;
  readonly locale: Locale;
  readonly onDone: (enabled: boolean) => void;
}

/**
 * Same-gender pods (§3.1 step 9, PRIVACY.md §3.6): gender picker with its own unticked consent checkbox. Drawn as the
 * app's other sheets are (drop-why, after-member): a content-height panel with a handle over the dimmed page, the
 * 24/800 title with the close cross, and the actions right under the consent box. The consent copy is verbatim from
 * @grouper/core; gender is sent only with the consent proof.
 */
export function GenderConsentSheet({ visible, locale, onDone }: GenderConsentSheetProps) {
  const { t } = useTranslation();
  const [gender, setGender] = useState<Gender | null>(null);
  const [checked, setChecked] = useState(false);
  const update = useCallable('updateProfile');
  const copy = gender ? genderConsentCopy(locale, gender) : null;
  const cancel = () => onDone(false);

  const confirm = () => {
    if (!gender || !copy) return;
    update.mutate({ prefs: { sameGenderOnly: true }, gender, genderConsent: genderConsentPayload(copy.textId) }, { onSuccess: () => onDone(true) });
  };

  return (
    // Transparent, so the page shows dimmed behind the panel (and no white modal surface shows round its corners in
    // dark mode); a fade, so the backdrop does not slide up with the panel.
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
      <BottomSheet onClose={cancel} testID="gender-sheet">
        <View style={styles.titleRow}>
          <Headline style={styles.title}>{t('gender.title')}</Headline>
          <CloseButton onPress={cancel} accessibilityLabel={t('common.cancel')} />
        </View>
        <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('gender.question')}>
          {GENDERS.map((g) => (
            <ChoiceChip
              key={g}
              testID={`gender-${g}`}
              fill
              label={t(`gender.options.${g}`)}
              selected={gender === g}
              onPress={() => {
                setGender(g);
                setChecked(false);
              }}
            />
          ))}
        </View>
        {copy ? (
          <View style={styles.copy}>
            <Body color="text">{copy.sheet.body}</Body>
            {copy.sheet.nonbinaryAddendum ? <Body color="text">{copy.sheet.nonbinaryAddendum}</Body> : null}
            {copy.fallback ? <Small>{t('gender.englishOnly')}</Small> : null}
            <Checkbox testID="gender-consent" variant="card" label={copy.sheet.checkbox} checked={checked} onChange={setChecked} />
          </View>
        ) : (
          <Small>{t('gender.pick')}</Small>
        )}
        {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
        <View style={styles.actions}>
          <Button testID="gender-confirm" label={t('gender.confirm')} disabled={!gender || !checked} busy={update.isPending} onPress={confirm} />
          <Button label={t('common.cancel')} variant="ghost" size="md" fullWidth onPress={cancel} />
        </View>
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  choices: { flexDirection: 'row', gap: 8 },
  copy: { gap: 12 },
  // The sheet's 18 px rhythm, minus the ghost button's own room under the primary.
  actions: { gap: 4 },
});
