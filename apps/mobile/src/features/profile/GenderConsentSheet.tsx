import { GENDERS, type Gender, type Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { Body, Button, Checkbox, ChipRow, ErrorText, Heading, Screen, Toggle } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { genderConsentCopy, genderConsentPayload } from './genderConsent';

export interface GenderConsentSheetProps {
  readonly visible: boolean;
  readonly locale: Locale;
  readonly onDone: (enabled: boolean) => void;
}

/**
 * Same-gender pods (§3.1 step 8, PRIVACY.md §3.6): gender picker with its own unticked consent checkbox.
 * Gender is sent only together with the consent proof.
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
      <Screen>
        <Heading>{t('gender.title')}</Heading>
        <ChipRow>
          {GENDERS.map((g) => (
            <Toggle
              key={g}
              label={t(`gender.options.${g}`)}
              value={gender === g}
              onChange={() => {
                setGender(g);
                setChecked(false);
              }}
            />
          ))}
        </ChipRow>
        {copy ? (
          <>
            <Body>{copy.sheet.body}</Body>
            {copy.sheet.nonbinaryAddendum ? <Body>{copy.sheet.nonbinaryAddendum}</Body> : null}
            {copy.fallback ? <Body muted>{t('gender.englishOnly')}</Body> : null}
            <Checkbox label={copy.sheet.checkbox} checked={checked} onChange={setChecked} />
          </>
        ) : null}
        {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
        <Button label={t('gender.confirm')} disabled={!gender || !checked} busy={update.isPending} onPress={confirm} />
        <Button label={t('common.cancel')} variant="secondary" onPress={() => onDone(false)} />
      </Screen>
    </Modal>
  );
}
