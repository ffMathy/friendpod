import { ABOUT_ME_MAX, aboutMeSchema, checkAboutMe } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, ErrorText, Field } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';

/** The state of an "About me" field: its text, the local check and the save mutation. */
export interface AboutMeState {
  readonly value: string;
  readonly setValue: (value: string) => void;
  /** Why it can't be saved: too long, contact details or blocklisted words; null when it can. */
  readonly problem: 'tooLong' | 'CONTACT_INFO' | 'BLOCKLIST' | null;
  /** The normalised text differs from what is saved. */
  readonly changed: boolean;
  readonly save: ReturnType<typeof useCallable<'updateProfile'>>;
  /** Saves the text when it changed and passes the check; resolves once the server has it. */
  readonly commit: () => Promise<void>;
}

/**
 * "About me" (D4): one optional sentence, shown only to people in a confirmed pod with the user and never used for
 * matching. Contact details and blocklisted words are refused outright, here for instant feedback and again on the
 * server; an empty field clears it.
 */
export function useAboutMe(initial: string): AboutMeState {
  const [value, setValue] = useState(initial);
  const save = useCallable('updateProfile');
  const parsed = aboutMeSchema.safeParse(value);
  const check = parsed.success && parsed.data.length > 0 ? checkAboutMe(parsed.data) : null;
  const problem = !parsed.success ? 'tooLong' : check && !check.ok ? check.code : null;
  const changed = parsed.success && parsed.data !== initial;
  const commit = async () => {
    if (!parsed.success || !changed || problem !== null) return;
    await save.mutateAsync({ aboutMe: parsed.data });
  };
  return { value, setValue, problem, changed, save, commit };
}

/** The labelled input of storyboard 1.7 ("About me (optional)", "52 / 140") with its errors; saving is the caller's. */
export function AboutMeInput({ state }: { readonly state: AboutMeState }) {
  const { t } = useTranslation();
  const { value, setValue, problem, changed, save } = state;
  return (
    <View style={styles.column}>
      <Field
        label={t('aboutMe.label')}
        optionalLabel={t('common.optional')}
        counter={t('aboutMe.counter', { count: [...value].length, max: ABOUT_ME_MAX })}
        hint={t('aboutMe.shownTo')}
        value={value}
        onChangeText={setValue}
        placeholder={t('aboutMe.placeholder')}
        maxLength={ABOUT_ME_MAX}
        size="md"
        returnKeyType="done"
        testID="about-me"
      />
      {problem === 'tooLong' ? <ErrorText>{t('aboutMe.tooLong', { max: ABOUT_ME_MAX })}</ErrorText> : null}
      {problem === 'CONTACT_INFO' || problem === 'BLOCKLIST' ? <ErrorText>{t(`aboutMe.${problem}`)}</ErrorText> : null}
      {save.error ? <ErrorText>{t(errorMessageKey(save.error))}</ErrorText> : null}
      {save.isSuccess && !changed ? (
        <AppText variant="caption" tone="mint">
          {t('aboutMe.saved')}
        </AppText>
      ) : null}
    </View>
  );
}

/** "About me" with its own Save button (Me tab). */
export function AboutMeField({ initial, onSaved }: { readonly initial: string; readonly onSaved?: () => void }) {
  const { t } = useTranslation();
  const state = useAboutMe(initial);
  const { problem, changed, save } = state;
  return (
    <View style={styles.column}>
      <AboutMeInput state={state} />
      <Button
        testID="about-me-save"
        label={t('aboutMe.save')}
        variant="secondary"
        size="xs"
        inline
        busy={save.isPending}
        disabled={!changed || problem !== null}
        onPress={() => void state.commit().then(() => onSaved?.(), () => undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
});
