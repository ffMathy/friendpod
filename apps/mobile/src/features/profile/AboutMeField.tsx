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
 * The field as onb-final draws it (spec §6.15 textarea): "About me (optional)" in 15/700, a two-line input (radius 14,
 * 1.5 px Field border, 16/24, padding 12/14), and under it the helper (13 Muted) with the "52 / 140" counter (12/600)
 * at the right, then the refusal reason. Focused: 2 px Skov deep; refused: 2 px Danger. Line breaks are not part of
 * the text (the schema folds them), so Return closes the keyboard.
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
  const borderWidth = focused || error ? BorderWidth.strong : BorderWidth.control;
  // The text stays put when the border thickens.
  const inset = (n: number) => n - (borderWidth - BorderWidth.control);
  return (
    <View style={styles.field}>
      <Label style={styles.label}>
        {t('aboutMe.label')}
        <Text variant="heading" weight="500" color="textMuted" style={styles.label}>{` ${t('common.optional')}`}</Text>
      </Label>
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
        multiline
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        style={[
          typeStyle('body'),
          styles.input,
          {
            color: p.text,
            backgroundColor: p.surface,
            borderColor: error ? p.danger : focused ? p.link : p.field,
            borderWidth,
            paddingTop: inset(12),
            paddingBottom: inset(12),
            paddingLeft: inset(14),
            paddingRight: inset(14),
          },
        ]}
      />
      <View style={styles.under}>
        <Text variant="caption" color="textMuted" style={[styles.helper, styles.shrink]}>
          {help}
        </Text>
        <Text variant="microStrong" color={full ? 'danger' : 'textMuted'} style={styles.count}>
          {`${state.value.length} / ${ABOUT_ME_MAX}`}
        </Text>
      </View>
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
        variant="secondary"
        size="sm"
        busy={save.isPending}
        disabled={!state.changed || state.problem !== null}
        onPress={() => state.text !== null && save.mutate({ aboutMe: state.text }, { onSuccess: () => onSaved?.() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  field: { gap: 4 },
  label: { lineHeight: 20 },
  // Two lines of 16/24 inside 12 px padding and the 1.5 px border (75 px, as drawn).
  input: { minHeight: 75, borderRadius: Radius.md, textAlignVertical: 'top' },
  under: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  helper: { lineHeight: 18 },
  shrink: { flexShrink: 1 },
  count: { flexShrink: 0 },
});
