import { GENDERS, type Gender, type Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';
import { Body, Button, Checkbox, ChoiceChip, ErrorText, Sheet, Small } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { genderConsentCopy, genderConsentPayload } from './genderConsent';

export interface GenderConsentSheetProps {
  readonly visible: boolean;
  readonly locale: Locale;
  readonly onDone: (enabled: boolean) => void;
}

/**
 * Same-gender pods (§3.1 step 9, PRIVACY.md §3.6): gender picker with its own unticked consent checkbox, in the
 * bottom-sheet layout. The consent copy is verbatim from @grouper/core; gender is sent only with the consent proof.
 */
export function GenderConsentSheet({ visible, locale, onDone }: GenderConsentSheetProps) {
  const { t } = useTranslation();
  const [gender, setGender] = useState<Gender | null>(null);
  const [checked, setChecked] = useState(false);
  const update = useCallable('updateProfile');
  const copy = gender ? genderConsentCopy(locale, gender) : null;

  const confirm = () => {
    if (!gender || !copy) return;
    update.mutate({ prefs: { sameGenderOnly: true }, gender, genderConsent: genderConsentPayload(copy.textId) }, { onSuccess: () => onDone(true) });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onDone(false)}>
      <Sheet
        title={t('gender.title')}
        onClose={() => onDone(false)}
        closeLabel={t('common.cancel')}
        footer={
          <>
            <Button testID="gender-confirm" label={t('gender.confirm')} disabled={!gender || !checked} busy={update.isPending} onPress={confirm} />
            <Button label={t('common.cancel')} variant="ghost" size="md" fullWidth onPress={() => onDone(false)} />
          </>
        }
      >
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
            <Body color="textBody">{copy.sheet.body}</Body>
            {copy.sheet.nonbinaryAddendum ? <Body color="textBody">{copy.sheet.nonbinaryAddendum}</Body> : null}
            {copy.fallback ? <Small>{t('gender.englishOnly')}</Small> : null}
            <Checkbox testID="gender-consent" variant="card" label={copy.sheet.checkbox} checked={checked} onChange={setChecked} />
          </View>
        ) : (
          <Small>{t('gender.pick')}</Small>
        )}
        {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
      </Sheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: 8 },
  copy: { gap: 12 },
});
