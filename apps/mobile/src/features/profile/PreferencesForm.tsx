import {
  AVAILABILITY,
  LANGUAGES,
  MAX_AGE,
  MIN_AGE,
  MIN_AGE_RANGE_WIDTH,
  RADII_KM,
  prefsSchema,
  type Locale,
  type Prefs,
} from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { Controller, useController, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Fonts, Radius, Sizes, Spacing, usePalette } from '@/components/theme';
import { AppText, Button, Card, ErrorText, Screen, SectionTitle, Segmented, SwitchRow, type ButtonVariant } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { AgeRangeSlider } from './AgeRangeSlider';
import { GenderConsentSheet } from './GenderConsentSheet';
import { InlineCheckbox } from './InlineCheckbox';

type AvailabilitySlot = keyof typeof AVAILABILITY;

/** The availability grid of storyboard 1.6: rows are day/evening, columns weekdays/Saturday/Sunday. */
const GRID_COLUMNS = ['weekdays', 'saturday', 'sunday'] as const;
const GRID_ROWS: readonly { readonly key: 'day' | 'evening'; readonly slots: readonly AvailabilitySlot[] }[] = [
  { key: 'day', slots: ['weekdayDay', 'saturdayDay', 'sundayDay'] },
  { key: 'evening', slots: ['weekdayEvening', 'saturdayEvening', 'sundayEvening'] },
];

export interface PreferencesFormProps {
  readonly initial: Prefs;
  readonly locale: Locale;
  readonly submitLabel: string;
  readonly onSaved: () => void;
  /**
   * 'inline' (default): the fields and the save button, inside the caller's Screen. 'screen': its own Screen with the
   * button pinned at the bottom (storyboard 1.6).
   */
  readonly layout?: 'inline' | 'screen';
  /** Shown above the fields: the onboarding StepHeader and title, or a ScreenHeader. */
  readonly header?: ReactNode;
  /** The area profile's default half-width of the age range, for "Starts at your age ±7" (onboarding only). */
  readonly ageHalfWidth?: number;
  /** Default 'primary' (ink); onboarding's Continue is 'accent' (green). */
  readonly submitVariant?: ButtonVariant;
  /**
   * Show the "Open to meet anyone" switch (Q12; default true). Onboarding leaves it out, as storyboard 1.6 does: the
   * value `completeOnboarding` set is saved unchanged and stays changeable in Me → Pod preferences and on the no-pod card.
   */
  readonly showOpenToAnyone?: boolean;
}

/**
 * Pod preferences (§3.1 step 9, storyboard 1.6): age range (width ≥ 5), radius shown as "about", meetup languages,
 * availability, "open to anyone" (Q12) and same-gender pods behind their own consent (PRIVACY.md §3.6).
 */
export function PreferencesForm({
  initial,
  locale,
  submitLabel,
  onSaved,
  layout = 'inline',
  header,
  ageHalfWidth,
  submitVariant = 'primary',
  showOpenToAnyone = true,
}: PreferencesFormProps) {
  const { t } = useTranslation();
  const update = useCallable('updateProfile');
  const [genderSheet, setGenderSheet] = useState(false);
  const { control, handleSubmit, formState, setValue, watch } = useForm<Prefs>({
    resolver: zodResolver(prefsSchema),
    defaultValues: initial,
  });
  const ageMin = useController({ control, name: 'ageMin' }).field;
  const ageMax = useController({ control, name: 'ageMax' }).field;
  const sameGenderOnly = watch('sameGenderOnly');

  const save = handleSubmit((prefs) => {
    // sameGenderOnly is changed only through the gender sheet or the explicit opt-out below.
    const { sameGenderOnly: _omit, ...rest } = prefs;
    update.mutate({ prefs: rest }, { onSuccess: onSaved });
  });

  const turnOffSameGender = () =>
    Alert.alert(t('prefs.sameGenderOffTitle'), t('prefs.sameGenderOffBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('prefs.turnOff'),
        style: 'destructive',
        onPress: () =>
          update.mutate({ prefs: { sameGenderOnly: false } }, { onSuccess: () => setValue('sameGenderOnly', false) }),
      },
    ]);

  const agesCaption = [ageHalfWidth !== undefined ? t('prefs.agesDefault', { n: ageHalfWidth }) : null, t('prefs.agesMutual')]
    .filter(Boolean)
    .join(' ');

  const fields = (
    <>
      {header}

      <Card gap={Spacing.ms}>
        <View style={styles.agesHead}>
          <AppText accessibilityRole="header" variant="section">
            {t('prefs.ages')}
          </AppText>
          <AppText variant="headingSm">{`${ageMin.value}–${ageMax.value}`}</AppText>
        </View>
        <AgeRangeSlider
          testID="prefs-ages"
          min={MIN_AGE}
          max={MAX_AGE}
          low={ageMin.value}
          high={ageMax.value}
          minGap={MIN_AGE_RANGE_WIDTH}
          lowLabel={t('prefs.youngest')}
          highLabel={t('prefs.oldest')}
          onChange={(low, high) => {
            ageMin.onChange(low);
            ageMax.onChange(high);
          }}
        />
        <AppText variant="caption" tone="muted">
          {agesCaption}
        </AppText>
        {formState.errors.ageMax ? <ErrorText>{t('prefs.ageRangeTooNarrow')}</ErrorText> : null}
      </Card>

      <View style={styles.section}>
        <SectionTitle title={t('prefs.travel')} />
        <Controller
          control={control}
          name="maxKm"
          render={({ field }) => (
            <Segmented
              options={RADII_KM.map((km) => ({ value: String(km), label: t('prefs.km', { km }), accessibilityLabel: t('prefs.aboutKm', { km }) }))}
              value={String(field.value)}
              onChange={(v) => field.onChange(RADII_KM.find((km) => String(km) === v) ?? field.value)}
            />
          )}
        />
        {/* §3.1 step 9: the radius is shown as "about" (the area is a rough map cell). */}
        <AppText variant="caption" tone="muted">
          {t('prefs.radiusApprox')}
        </AppText>
      </View>

      <View style={styles.section}>
        <SectionTitle title={t('prefs.languages')} />
        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            // Side by side, each only as wide as its label (storyboard 1.6: "[x] Dansk  [x] English").
            <View style={styles.languages}>
              {LANGUAGES.map((lang) => (
                <InlineCheckbox
                  key={lang}
                  testID={`prefs-language-${lang}`}
                  label={t(`languages.${lang}`)}
                  checked={field.value.includes(lang)}
                  onChange={(on) => field.onChange(on ? [...field.value, lang] : field.value.filter((l) => l !== lang))}
                />
              ))}
            </View>
          )}
        />
        {formState.errors.languages ? <ErrorText>{t('prefs.pickLanguage')}</ErrorText> : null}
      </View>

      <View style={styles.section}>
        <SectionTitle title={t('prefs.whenFree')} />
        <Controller
          control={control}
          name="availability"
          render={({ field }) => (
            <View style={styles.grid}>
              {/* The column and row labels are visual only: every cell is named "Weekdays, daytime" etc. */}
              <View style={styles.gridRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.gridLabel} />
                {GRID_COLUMNS.map((col) => (
                  <AppText key={col} variant="caption" tone="muted" align="center" style={[styles.gridCell, Fonts.semibold]}>
                    {t(`prefs.grid.${col}`)}
                  </AppText>
                ))}
              </View>
              {GRID_ROWS.map((row) => (
                <View key={row.key} style={styles.gridRow}>
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={[styles.gridLabel, Fonts.semibold]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {t(`prefs.grid.${row.key}`)}
                  </AppText>
                  {row.slots.map((slot) => {
                    const bit = AVAILABILITY[slot];
                    return (
                      <SlotCell
                        key={slot}
                        testID={`prefs-slot-${slot}`}
                        label={t(`availability.${slot}`)}
                        value={(field.value & bit) !== 0}
                        onChange={(on) => field.onChange(on ? field.value | bit : field.value & ~bit)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        />
        {formState.errors.availability ? <ErrorText>{t('prefs.pickAvailability')}</ErrorText> : null}
      </View>

      {showOpenToAnyone ? (
        <Controller
          control={control}
          name="openToAnyone"
          render={({ field }) => (
            <SwitchRow
              testID="prefs-open-to-anyone"
              label={t('prefs.openToAnyone')}
              description={t('prefs.openToAnyoneHint')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      <SwitchRow
        testID="prefs-same-gender"
        label={t('prefs.sameGender')}
        description={sameGenderOnly ? t('settings.privacy.genderOn') : t('prefs.sameGenderAsk')}
        value={sameGenderOnly}
        onChange={(on) => (on ? setGenderSheet(true) : turnOffSameGender())}
      />
    </>
  );

  const submit = (
    <>
      {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
      <Button testID="prefs-save" label={submitLabel} variant={submitVariant} busy={update.isPending} onPress={() => void save()} />
    </>
  );

  const sheet = (
    <GenderConsentSheet
      visible={genderSheet}
      locale={locale}
      onDone={(enabled) => {
        setGenderSheet(false);
        if (enabled) setValue('sameGenderOnly', true);
      }}
    />
  );

  if (layout === 'screen') {
    return (
      <>
        <Screen wide gap={18} footer={submit}>
          {fields}
        </Screen>
        {sheet}
      </>
    );
  }
  return (
    <View style={styles.inline}>
      {fields}
      {submit}
      {sheet}
    </View>
  );
}

/** Grid cells are 36 pt tall and 6 apart; the slop gives each a 44-pt touch target without changing the layout. */
const SLOT_HEIGHT = 36;
const SLOT_SLOP = { top: (Sizes.touch - SLOT_HEIGHT) / 2, bottom: (Sizes.touch - SLOT_HEIGHT) / 2, left: 3, right: 3 } as const;

/**
 * One cell of the availability grid (storyboard 1.6): a flat 36-pt tile with 10-pt corners, green when on, white with a
 * border when off. A switch named "Weekdays, daytime" etc.
 */
function SlotCell({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (on: boolean) => void; testID: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={SLOT_SLOP}
      style={({ pressed }) => [
        styles.slot,
        { backgroundColor: value ? p.primary : p.surface, borderColor: value ? p.primary : p.borderStrong },
        pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  inline: { gap: 18 },
  section: { gap: 10 },
  agesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  languages: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 },
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gridLabel: { width: 76 },
  gridCell: { flex: 1 },
  slot: { flex: 1, height: SLOT_HEIGHT, borderRadius: Radius.sm, borderWidth: 1 },
  pressed: { opacity: 0.75 },
});
