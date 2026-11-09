import { ABOUT_ME_MAX } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { Button, ErrorText, Icon, Text, TextField } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { useAboutMe } from '@/features/profile/AboutMeField';
import { errorMessageKey } from '@/lib/errors';

/**
 * "About me" on Me (D4): onb-final's field ("About me (optional)", "53 / 140", the helper line), but three lines tall
 * so the whole sentence can be read back. Save appears only once the text differs from what is saved (contact details
 * and blocklisted words are refused here and again on the server; an empty field clears it), then a quiet "Saved."
 * (Ink 2 check: a calm fact, not an action).
 */
export function AboutMeCard({ initial }: { readonly initial: string }) {
  const { t } = useTranslation();
  const p = usePalette();
  const state = useAboutMe(initial);
  const save = useCallable('updateProfile');
  const { problem } = state;
  const error =
    problem === 'tooLong' ? t('aboutMe.tooLong', { max: ABOUT_ME_MAX }) : problem === 'CONTACT_INFO' || problem === 'BLOCKLIST' ? t(`aboutMe.${problem}`) : null;
  const saved = save.isSuccess && !state.changed;
  return (
    <View style={styles.column}>
      <TextField
        testID="about-me"
        label={t('aboutMe.label')}
        optional
        showCount
        size="md"
        multiline
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        maxLength={ABOUT_ME_MAX}
        value={state.value}
        onChangeText={state.setValue}
        placeholder={t('aboutMe.placeholder')}
        helper={t('aboutMe.helper')}
        error={error}
        autoCapitalize="sentences"
      />
      {save.error ? <ErrorText>{t(errorMessageKey(save.error))}</ErrorText> : null}
      {state.changed || save.isPending ? (
        <View style={styles.actions}>
          <Button
            testID="about-me-save"
            label={t('aboutMe.save')}
            size="sm"
            busy={save.isPending}
            disabled={state.problem !== null}
            onPress={() => state.text !== null && save.mutate({ aboutMe: state.text })}
          />
        </View>
      ) : saved ? (
        <View style={styles.saved} testID="about-me-saved">
          <Icon name="check" size={16} strokeWidth={2.4} color={p.textSecondary} />
          <Text variant="captionStrong" color="textSecondary">
            {t('aboutMe.saved')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
