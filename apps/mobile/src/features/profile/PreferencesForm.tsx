import {
  AVAILABILITY,
  LANGUAGES,
  MAX_AGE,
  MIN_AGE,
  RADII_KM,
  prefsSchema,
  type Locale,
  type Prefs,
} from '@grouper/core';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Body, Button, ChipButton, ChipRow, ErrorText, Heading, Toggle } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { errorMessageKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { GenderConsentSheet } from './GenderConsentSheet';

type AvailabilitySlot = keyof typeof AVAILABILITY;
const SLOTS = Object.keys(AVAILABILITY) as AvailabilitySlot[];

interface Props {
  readonly initial: Prefs;
  readonly locale: Locale;
  readonly submitLabel: string;
  readonly onSaved: () => void;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Body>{label}</Body>
      <ChipButton label="−" accessibilityLabel={t('prefs.decrease', { label })} onPress={() => onChange(Math.max(MIN_AGE, value - 1))} />
      <Body bold>{String(value)}</Body>
      <ChipButton label="+" accessibilityLabel={t('prefs.increase', { label })} onPress={() => onChange(Math.min(MAX_AGE, value + 1))} />
    </View>
  );
}

/**
 * Pod preferences (§3.1 step 8): age range (width ≥ 5), radius shown as "about", meetup languages,
 * availability, "open to anyone" (Q12) and same-gender pods behind their own consent (PRIVACY.md §3.6).
 */
export function PreferencesForm({ initial, locale, submitLabel, onSaved }: Props) {
  const { t } = useTranslation();
  const update = useCallable('updateProfile');
  const [genderSheet, setGenderSheet] = useState(false);
  const { control, handleSubmit, formState, setValue, watch } = useForm<Prefs>({
    resolver: zodResolver(prefsSchema),
    defaultValues: initial,
  });
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

  return (
    <View style={{ gap: 16 }}>
      <Heading>{t('prefs.ageRange')}</Heading>
      <Controller
        control={control}
        name="ageMin"
        render={({ field }) => <Stepper label={t('prefs.from')} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="ageMax"
        render={({ field }) => <Stepper label={t('prefs.to')} value={field.value} onChange={field.onChange} />}
      />
      {formState.errors.ageMax ? <ErrorText>{t('prefs.ageRangeTooNarrow')}</ErrorText> : null}

      <Heading>{t('prefs.radius')}</Heading>
      <Controller
        control={control}
        name="maxKm"
        render={({ field }) => (
          <ChipRow>
            {RADII_KM.map((km) => (
              <Toggle key={km} label={t('prefs.aboutKm', { km })} value={field.value === km} onChange={() => field.onChange(km)} />
            ))}
          </ChipRow>
        )}
      />

      <Heading>{t('prefs.languages')}</Heading>
      <Controller
        control={control}
        name="languages"
        render={({ field }) => (
          <ChipRow>
            {LANGUAGES.map((lang) => (
              <Toggle
                key={lang}
                label={t(`languages.${lang}`)}
                value={field.value.includes(lang)}
                onChange={(on) => field.onChange(on ? [...field.value, lang] : field.value.filter((l) => l !== lang))}
              />
            ))}
          </ChipRow>
        )}
      />
      {formState.errors.languages ? <ErrorText>{t('prefs.pickLanguage')}</ErrorText> : null}

      <Heading>{t('prefs.availability')}</Heading>
      <Controller
        control={control}
        name="availability"
        render={({ field }) => (
          <ChipRow>
            {SLOTS.map((slot) => {
              const bit = AVAILABILITY[slot];
              return (
                <Toggle
                  key={slot}
                  label={t(`availability.${slot}`)}
                  value={(field.value & bit) !== 0}
                  onChange={(on) => field.onChange(on ? field.value | bit : field.value & ~bit)}
                />
              );
            })}
          </ChipRow>
        )}
      />
      {formState.errors.availability ? <ErrorText>{t('prefs.pickAvailability')}</ErrorText> : null}

      <Controller
        control={control}
        name="openToAnyone"
        render={({ field }) => <Toggle label={t('prefs.openToAnyone')} value={field.value} onChange={field.onChange} />}
      />
      <Body muted>{t('prefs.openToAnyoneHint')}</Body>

      <Toggle
        label={t('prefs.sameGender')}
        value={sameGenderOnly}
        onChange={(on) => (on ? setGenderSheet(true) : turnOffSameGender())}
      />
      <Body muted>{t('prefs.sameGenderHint')}</Body>

      {update.error ? <ErrorText>{t(errorMessageKey(update.error))}</ErrorText> : null}
      <Button label={submitLabel} busy={update.isPending} onPress={() => void save()} />

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
