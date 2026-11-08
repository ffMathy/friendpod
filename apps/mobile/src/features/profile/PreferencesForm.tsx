import { LANGUAGES, MAX_AGE, MIN_AGE, MIN_AGE_RANGE_WIDTH, RADII_KM, prefsSchema, type Locale, type Prefs } from '@grouper/core';
import { useState } from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Button, Card, Checkbox, ChoiceChip, ErrorText, Heading, Label, Small, Switch, Text } from '@/components/ui';
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
 * Pod preferences (onb-prefs; §3.1 step 9): the age range (two-thumb slider, width ≥ 5), how far ("about", Q: radius),
 * meetup languages, the availability grid, same-gender pods behind their own consent (PRIVACY.md §3.6) and, outside
 * onboarding, "open to anyone" (Q12).
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
      <Card gap={12}>
        <View style={styles.agesTop}>
          <Heading style={styles.normal15}>{t('prefs.ages')}</Heading>
          <Text variant="numeral" accessibilityLabel={t('prefs.agesValue', { min: ageMin, max: ageMax })}>{`${ageMin}–${ageMax}`}</Text>
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
        <Small style={styles.normal13}>{t('prefs.agesHint')}</Small>
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
                <ChoiceChip
                  key={km}
                  testID={`radius-${km}`}
                  fill
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
                <Checkbox
                  key={lang}
                  testID={`language-${lang}`}
                  variant="inline"
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

      <SwitchCard
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
 * "Same-gender pods only" as onb-prefs draws it: a white r20 card (14/16 padding), the title and its two-line 13/1.45
 * hint, and the switch at the top right beside the title (not centred on the card).
 */
function SwitchCard({
  label,
  description,
  value,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly description: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.switchCard, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.switchText}>
        <Text variant="heading" style={styles.normal15}>
          {label}
        </Text>
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {description}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: value ? p.primary : p.borderStrong }]}>
        <View style={[styles.thumb, { backgroundColor: p.switchThumb }, value ? styles.thumbOn : null]} />
      </View>
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

const styles = StyleSheet.create({
  fields: { gap: 18 },
  agesTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  // onb-prefs sets its legends, titles and the ages hint at the font's normal line height (~1.26).
  normal13: { lineHeight: 16 },
  normal15: { lineHeight: 19 },
  legend: { lineHeight: 19 },
  fieldset: { gap: 10 },
  radii: { flexDirection: 'row', gap: 8 },
  languages: { flexDirection: 'row', gap: 18 },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: BorderWidth.hairline,
    borderRadius: Radius.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  switchText: { flex: 1, gap: 4 },
  // 13/1.45, as the storyboard's hint.
  hint: { lineHeight: 19 },
  // The switch sits 2 px down, level with the title.
  track: { width: 44, height: 26, borderRadius: 13, padding: 2, marginTop: 2, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOn: { alignSelf: 'flex-end' },
});
