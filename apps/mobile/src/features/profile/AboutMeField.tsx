import { ABOUT_ME_MAX, aboutMeSchema, checkAboutMe } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Body, Button, ErrorText, Field } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';

/**
 * "About me" (D4): one optional sentence, shown only to people in a confirmed pod with the user and never used for
 * matching. Contact details and blocklisted words are refused outright, here for instant feedback and again on the
 * server; an empty field clears it.
 */
export function AboutMeField({ initial, onSaved }: { readonly initial: string; readonly onSaved?: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const save = useCallable('updateProfile');
  const parsed = aboutMeSchema.safeParse(value);
  const check = parsed.success && parsed.data.length > 0 ? checkAboutMe(parsed.data) : null;
  const problem = !parsed.success ? 'tooLong' : check && !check.ok ? check.code : null;
  const changed = parsed.success && parsed.data !== initial;

  return (
    <View style={{ gap: 8 }}>
      <Field
        label={t('aboutMe.label')}
        value={value}
        onChangeText={setValue}
        placeholder={t('aboutMe.placeholder')}
        multiline
        maxLength={ABOUT_ME_MAX}
        testID="about-me"
      />
      <Body muted>{t('aboutMe.hint', { count: [...value].length, max: ABOUT_ME_MAX })}</Body>
      {problem === 'tooLong' ? <ErrorText>{t('aboutMe.tooLong', { max: ABOUT_ME_MAX })}</ErrorText> : null}
      {problem === 'CONTACT_INFO' || problem === 'BLOCKLIST' ? <ErrorText>{t(`aboutMe.${problem}`)}</ErrorText> : null}
      {save.error ? <ErrorText>{t(errorMessageKey(save.error))}</ErrorText> : null}
      {save.isSuccess && !changed ? <Body muted>{t('aboutMe.saved')}</Body> : null}
      <Button
        testID="about-me-save"
        label={t('aboutMe.save')}
        variant="secondary"
        busy={save.isPending}
        disabled={!changed || problem !== null}
        onPress={() => parsed.success && save.mutate({ aboutMe: parsed.data }, { onSuccess: () => onSaved?.() })}
      />
    </View>
  );
}
