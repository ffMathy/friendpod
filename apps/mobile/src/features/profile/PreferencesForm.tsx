import { LANGUAGES, MAX_AGE, MIN_AGE, MIN_AGE_RANGE_WIDTH, RADII_KM, prefsSchema, type Locale, type Prefs } from '@grouper/core';
import { useState } from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BorderWidth, Size, usePalette } from '@/components/theme';
import { Button, Card, ErrorText, Heading, Icon, Label, Switch, Text } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { AgeRangeSlider } from './AgeRangeSlider';
import { AvailabilityGrid } from './AvailabilityGrid';
import { GenderConsentSheet } from './GenderConsentSheet';

interface Props {
  readonly initial: Prefs;
  readonly locale: Locale;
  readonly submitLabel: string;
  readonly onSaved: () => void;
}

export interface PreferencesController {
  readonly form: UseFormReturn<Prefs>;
  readonly update: ReturnType<typeof useCallable<'updateProfile'>>;
  /** Validates and saves everything but `sameGenderOnly` (that one changes only through its own consent flow). */
  readonly save: () => void;
  readonly saving: boolean;
}

/** The form state and its save action, so a screen can pin its own submit button (onboarding step 5). */
export function usePreferencesForm({ initial, onSaved }: { readonly initial: Prefs; readonly onSaved: () => void }): PreferencesController {
  const update = useCallable('updateProfile');
  const form = useForm<Prefs>({ resolver: zodResolver(prefsSchema), defaultValues: initial });
  const submit = form.handleSubmit((prefs) => {
    const { sameGenderOnly: _omit, ...rest } = prefs;
    update.mutate({ prefs: rest }, { onSuccess: onSaved });
  });
  return { form, update, save: () => void submit(), saving: update.isPending };
}

export interface PreferencesFieldsProps {
  readonly controller: PreferencesController;
  readonly locale: Locale;
  /**
   * Show the "Open to meeting anyone" switch (Q12; default true, Settings → Preferences). Onboarding step 5 leaves it
   * out, as onb-prefs and §3.1 step 9 do: the area's profile sets it (on by default in the alpha profile, §6.10) and
   * Continue saves it unchanged; it can be changed later in Settings.
   */
  readonly showOpenToAnyone?: boolean;
}

/**
 * Pod preferences (onb-prefs; §3.1 step 9), as the storyboard draws them: the ages in a white card (two-thumb slider,
 * width ≥ 5), how far ("about", Q: radius) as four choice pills, the meetup languages as checkable pills, the
 * availability grid, same-gender pods behind their own consent (PRIVACY.md §3.6) and, outside onboarding, "open to
 * anyone" (Q12). A selected choice is Ink with white text (spec §6.15); "on" switches and the slider are Skov.
 */
export function PreferencesFields({ controller, locale, showOpenToAnyone = true }: PreferencesFieldsProps) {
  const { t } = useTranslation();
  const { form, update } = controller;
  const { control, formState, setValue } = form;
  const [genderSheet, setGenderSheet] = useState(false);
  const [ageMin, ageMax, sameGenderOnly] = useWatch({ control, name: ['ageMin', 'ageMax', 'sameGenderOnly'] });

  const turnOffSameGender = () =>
    Alert.alert(t('prefs.sameGenderOffTitle'), t('prefs.sameGenderOffBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('prefs.turnOff'),
        style: 'destructive',
        onPress: () => update.mutate({ prefs: { sameGenderOnly: false } }, { onSuccess: () => setValue('sameGenderOnly', false) }),
      },
    ]);

  return (
    <View style={styles.fields}>
      <Card gap={10} style={AGES_CARD_PADDING}>
        <View style={styles.agesTop}>
          <Heading>{t('prefs.ages')}</Heading>
          <Text variant="cardTitle" accessibilityLabel={t('prefs.agesValue', { min: ageMin, max: ageMax })}>{`${ageMin}–${ageMax}`}</Text>
        </View>
        <AgeRangeSlider
          testID="age-range"
          min={MIN_AGE}
          max={MAX_AGE}
          low={ageMin}
          high={ageMax}
          minGap={MIN_AGE_RANGE_WIDTH}
          lowLabel={t('prefs.youngest')}
          highLabel={t('prefs.oldest')}
          onChange={(low, high) => {
            setValue('ageMin', low, { shouldDirty: true });
            setValue('ageMax', high, { shouldDirty: true });
          }}
        />
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {t('prefs.agesHint')}
        </Text>
        {formState.errors.ageMax ? <ErrorText>{t('prefs.ageRangeTooNarrow')}</ErrorText> : null}
      </Card>

      <View style={styles.fieldset}>
        <Label style={styles.legend}>{t('prefs.travel')}</Label>
        <Controller
          control={control}
          name="maxKm"
          render={({ field }) => (
            <View style={styles.radii} accessibilityRole="radiogroup" accessibilityLabel={t('prefs.travel')}>
              {RADII_KM.map((km) => (
                <ChoicePill
                  key={km}
                  testID={`radius-${km}`}
                  label={t('prefs.km', { km })}
                  accessibilityLabel={t('prefs.aboutKm', { km })}
                  selected={field.value === km}
                  onPress={() => field.onChange(km)}
                />
              ))}
            </View>
          )}
        />
      </View>

      <View style={styles.fieldset}>
        <Label style={styles.legend}>{t('prefs.languages')}</Label>
        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            <View style={styles.languages}>
              {LANGUAGES.map((lang) => (
                <CheckPill
                  key={lang}
                  testID={`language-${lang}`}
                  // The language's name in the reader's language ("Engelsk"), not the app-language picker's endonym.
                  label={t(`prefs.language.${lang}`)}
                  checked={field.value.includes(lang)}
                  onChange={(on) => field.onChange(on ? [...field.value, lang] : field.value.filter((l) => l !== lang))}
                />
              ))}
            </View>
          )}
        />
        {formState.errors.languages ? <ErrorText>{t('prefs.pickLanguage')}</ErrorText> : null}
      </View>

      <View style={styles.fieldset}>
        <Label style={styles.legend}>{t('prefs.availability')}</Label>
        <Controller control={control} name="availability" render={({ field }) => <AvailabilityGrid value={field.value} onChange={field.onChange} />} />
        {formState.errors.availability ? <ErrorText>{t('prefs.pickAvailability')}</ErrorText> : null}
      </View>

      <Switch
        testID="same-gender"
        label={t('prefs.sameGender')}
        description={t('prefs.sameGenderHint')}
        value={sameGenderOnly}
        onChange={(on) => (on ? setGenderSheet(true) : turnOffSameGender())}
      />

      {showOpenToAnyone ? (
        <Controller
          control={control}
          name="openToAnyone"
          render={({ field }) => (
            <Switch testID="open-to-anyone" label={t('prefs.openToAnyone')} description={t('prefs.openToAnyoneHint')} value={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}

      <GenderConsentSheet
        visible={genderSheet}
        locale={locale}
        onDone={(enabled) => {
          setGenderSheet(false);
          if (enabled) setValue('sameGenderOnly', true);
        }}
      />
    </View>
  );
}

/**
 * One of the distances (onb-prefs): a 44 px pill sharing the row evenly, 15/700; selected = Ink with white text and a
 * check (spec §6.15), unselected = white with the 1.5 px Outline border. A radio in its group.
 */
function ChoicePill({
  label,
  selected,
  onPress,
  accessibilityLabel,
  testID,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        styles.fill,
        selected ? { backgroundColor: p.ink } : { backgroundColor: p.surface, borderWidth: BorderWidth.control, borderColor: p.borderStrong },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {selected ? <Icon name="check" size={14} strokeWidth={2.6} color={p.onInk} /> : null}
      <Text variant="buttonSmall" color={selected ? 'onInk' : 'text'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A meetup language (onb-prefs): a 44 px pill with its own 20 px box. Checked = Ink pill, white text, a white box with
 * an Ink check; unchecked = white pill with the Outline border and an empty Field-bordered box. A checkbox.
 */
function CheckPill({ label, checked, onChange, testID }: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void; readonly testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.pill,
        styles.checkPill,
        checked ? { backgroundColor: p.ink } : { backgroundColor: p.surface, borderWidth: BorderWidth.control, borderColor: p.borderStrong },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.box, checked ? { backgroundColor: p.onInk, borderColor: p.onInk } : { backgroundColor: p.surface, borderColor: p.field }]}>
        {/* A heavy check, as onb-prefs' native boxes draw it (about 2.5 px at this size). */}
        {checked ? <Icon name="check" size={17} strokeWidth={3.6} color={p.ink} /> : null}
      </View>
      <Text variant="buttonSmall" color={checked ? 'onInk' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The fields with their own submit button underneath (Settings → Preferences). */
export function PreferencesForm({ initial, locale, submitLabel, onSaved }: Props) {
  const controller = usePreferencesForm({ initial, onSaved });
  return (
    <View style={styles.fields}>
      <PreferencesFields controller={controller} locale={locale} />
      <Button testID="prefs-save" label={submitLabel} busy={controller.saving} onPress={controller.save} />
    </View>
  );
}

/**
 * onb-prefs' ages card: 14 / 16 padding. A plain object, not a StyleSheet entry: Card sets its padding inline, and on
 * web only another inline style wins over it.
 */
const AGES_CARD_PADDING: ViewStyle = { paddingVertical: 14 };

const styles = StyleSheet.create({
  // onb-prefs spaces its blocks 12 apart; a legend (15/20) sits 8 above its controls.
  fields: { gap: 12 },
  legend: { lineHeight: 20 },
  agesTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  hint: { lineHeight: 18 },
  fieldset: { gap: 8 },
  radii: { flexDirection: 'row', gap: 8 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: Size.hitTarget, borderRadius: Size.hitTarget / 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  fill: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 6 },
  checkPill: { paddingLeft: 12, paddingRight: 16, gap: 8 },
  // A square box with a small radius (onb-prefs draws the native checkbox), not the 24 px Checkbox's rounder 7.
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: BorderWidth.control, alignItems: 'center', justifyContent: 'center' },
});
