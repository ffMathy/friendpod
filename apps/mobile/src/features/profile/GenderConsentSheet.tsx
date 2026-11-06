import { GENDERS, type Gender, type Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Checkbox, ChoiceRow, ErrorText, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { genderConsentCopy, genderConsentPayload } from './genderConsent';

export interface GenderConsentSheetProps {
  readonly visible: boolean;
  readonly locale: Locale;
  readonly onDone: (enabled: boolean) => void;
}

/**
 * Same-gender pods (§3.1 step 9, PRIVACY.md §3.6): gender picker with its own unticked consent checkbox, in the look of
 * the consent screen (storyboard 1.4). The copy is verbatim from @grouper/core. Gender is sent only together with the
 * consent proof.
 */
export function GenderConsentSheet({ visible, locale, onDone }: GenderConsentSheetProps) {
  const { t } = useTranslation();
  const [gender, setGender] = useState<Gender | null>(null);
  const [checked, setChecked] = useState(false);
  const update = useCallable('updateProfile');
  const copy = gender ? genderConsentCopy(locale, gender) : null;

  const confirm = () => {
    if (!gender || !copy) return;
    update.mutate(
      { prefs: { sameGenderOnly: true }, gender, genderConsent: genderConsentPayload(copy.textId) },
      { onSuccess: () => onDone(true) },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onDone(false)}>
      <Screen
        footer={
          <>
            {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
            <Button
              testID="gender-confirm"
              label={t('gender.confirm')}
              variant="accent"
              disabled={!gender || !checked}
              busy={update.isPending}
              onPress={confirm}
            />
            {/* As prominent as the consent button: saying no is free (PRIVACY.md §3.6). */}
            <Button testID="gender-cancel" label={t('common.cancel')} variant="secondary" onPress={() => onDone(false)} />
          </>
        }
      >
        <ScreenHeader title={t('gender.title')} size="md" closeLabel={t('common.close')} onClose={() => onDone(false)} />
        <View style={styles.group} accessibilityRole="radiogroup">
          <SectionTitle title={t('gender.yourGender')} />
          {GENDERS.map((g) => (
            <ChoiceRow
              key={g}
              testID={`gender-${g}`}
              label={t(`gender.options.${g}`)}
              selected={gender === g}
              onPress={() => {
                setGender(g);
                // A different gender means a different text (the non-binary addendum): tick it again.
                setChecked(false);
              }}
            />
          ))}
        </View>
        {copy ? (
          <>
            <Card gap={10}>
              <AppText variant="bodySm">{copy.sheet.body}</AppText>
              {copy.sheet.nonbinaryAddendum ? <AppText variant="bodySm">{copy.sheet.nonbinaryAddendum}</AppText> : null}
            </Card>
            {copy.fallback ? (
              <AppText variant="caption" tone="muted">
                {t('gender.englishOnly')}
              </AppText>
            ) : null}
            <Checkbox testID="gender-consent" variant="card" label={copy.sheet.checkbox} checked={checked} onChange={setChecked} />
          </>
        ) : null}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
});
