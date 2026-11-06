import { ABOUT_ME_MAX, aboutMeSchema, checkAboutMe } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { BorderWidth, Radius, typeStyle, usePalette } from '@/components/theme';
import { Button, ErrorText, Label, Small, Text } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';

export type AboutMeProblem = 'tooLong' | 'CONTACT_INFO' | 'BLOCKLIST';

export interface AboutMeState {
  readonly value: string;
  readonly setValue: (value: string) => void;
  /** The trimmed text to save, or null while it does not parse (too long). */
  readonly text: string | null;
  readonly problem: AboutMeProblem | null;
  /** Differs from what is saved. */
  readonly changed: boolean;
}

/**
 * "About me" (D4): one optional sentence, shown only to people in a confirmed pod with the user and never used for
 * matching. Contact details and blocklisted words are refused outright, here for instant feedback and again on the
 * server; an empty field clears it.
 */
export function useAboutMe(initial: string): AboutMeState {
  const [value, setValue] = useState(initial);
  const parsed = aboutMeSchema.safeParse(value);
  const check = parsed.success && parsed.data.length > 0 ? checkAboutMe(parsed.data) : null;
  const problem: AboutMeProblem | null = !parsed.success ? 'tooLong' : check && !check.ok ? check.code : null;
  return { value, setValue, text: parsed.success ? parsed.data : null, problem, changed: parsed.success && parsed.data !== initial };
}

/**
 * The field as onb-final draws it: "About me (optional)" with the "52 / 140" counter at the right, a 50 px input in
 * 15 px, 6 px apart, the helper line and the refusal reason. Its own metrics (TextField is 52–54 px in 16–17 px, 8 px
 * apart), with TextField's colours, focus ring and error border.
 */
export function AboutMeInput({ state, helper }: { readonly state: AboutMeState; readonly helper?: string }) {
  const { t } = useTranslation();
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const { problem } = state;
  const error =
    problem === 'tooLong' ? t('aboutMe.tooLong', { max: ABOUT_ME_MAX }) : problem === 'CONTACT_INFO' || problem === 'BLOCKLIST' ? t(`aboutMe.${problem}`) : null;
  const help = helper ?? t('aboutMe.helper');
  const full = state.value.length >= ABOUT_ME_MAX;
  const borderWidth = focused || error ? BorderWidth.strong : BorderWidth.hairline;
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Label style={[styles.normal15, styles.shrink]}>
          {t('aboutMe.label')}
          <Text variant="heading" weight="500" color="textMuted" style={styles.normal15}>{` ${t('common.optional')}`}</Text>
        </Label>
        <Text variant="caption" color={full ? 'dangerText' : 'textMuted'} style={styles.normal13}>
          {`${state.value.length} / ${ABOUT_ME_MAX}`}
        </Text>
      </View>
      <TextInput
        testID="about-me"
        accessibilityLabel={`${t('aboutMe.label')} ${t('common.optional')}`}
        accessibilityHint={help}
        value={state.value}
        onChangeText={state.setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={ABOUT_ME_MAX}
        placeholder={t('aboutMe.placeholder')}
        placeholderTextColor={p.textMuted}
        autoCapitalize="sentences"
        style={[
          typeStyle('body'),
          styles.input,
          {
            color: p.text,
            backgroundColor: p.surface,
            borderColor: error ? p.dangerText : focused ? p.primary : p.borderStrong,
            borderWidth,
            paddingHorizontal: 14 - (borderWidth - 1),
            lineHeight: undefined,
          },
        ]}
      />
      <Text variant="caption" color="textMuted" style={styles.normal13}>
        {help}
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

/** The field with its own Save button (Me). */
export function AboutMeField({ initial, onSaved }: { readonly initial: string; readonly onSaved?: () => void }) {
  const { t } = useTranslation();
  const state = useAboutMe(initial);
  const save = useCallable('updateProfile');
  return (
    <View style={styles.column}>
      <AboutMeInput state={state} />
      {save.error ? <ErrorText>{t(errorMessageKey(save.error))}</ErrorText> : null}
      {save.isSuccess && !state.changed ? <Small>{t('aboutMe.saved')}</Small> : null}
      <Button
        testID="about-me-save"
        label={t('aboutMe.save')}
        variant="outline"
        size="xs"
        busy={save.isPending}
        disabled={!state.changed || state.problem !== null}
        onPress={() => state.text !== null && save.mutate({ aboutMe: state.text }, { onSuccess: () => onSaved?.() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  shrink: { flexShrink: 1 },
  // onb-final sets the label, the counter and the helper at the font's normal line height.
  normal15: { lineHeight: 19 },
  normal13: { lineHeight: 16 },
  input: { height: 50, borderRadius: Radius.md },
});
