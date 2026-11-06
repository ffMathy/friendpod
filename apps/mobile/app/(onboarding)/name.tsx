import { firstNameSchema } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/components/theme';
import { AppText, Body, Button, ErrorText, Field, Screen, StepHeader, Title } from '@/components/ui';
import { composeDob, isAdult } from '@/features/onboarding/dob';
import { useOnboardingDraft } from '@/features/onboarding/draft';

/** Storyboards 1.2–1.7 number six steps; this is the first (the Terms step before it has no number). */
const STEP = 1;
const STEPS = 6;

/**
 * Storyboard 1.2 "About you", §3.1 steps 4–5 on one screen: the first name (visible only to confirmed pod members) and
 * the date of birth, entered on the device. Only the birth year is ever stored (server side).
 */
export default function AboutYou() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const [name, setName] = useState(draft.firstName ?? '');
  // Coming back from the area step shows what was entered; the draft holds the date as YYYY-MM-DD.
  const [initialYear = '', initialMonth = '', initialDay = ''] = draft.dob?.split('-') ?? [];
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const parsed = firstNameSchema.safeParse(name);
  const dob = year.length === 4 ? composeDob(year, month, day) : null;
  const underage = dob !== null && !isAdult(dob, new Date());

  const dateField = (label: string, value: string, onChange: (v: string) => void, maxLength: number) => (
    <View style={styles.dateCell}>
      {/* The input itself carries the label for screen readers. */}
      <AppText variant="caption" tone="muted" accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </AppText>
      <Field label={label} hideLabel value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={maxLength} />
    </View>
  );

  return (
    <Screen
      wide
      gap={24}
      footer={
        <Button
          label={t('common.continue')}
          variant="accent"
          disabled={!parsed.success || dob === null}
          onPress={() => {
            if (!parsed.success || dob === null) return;
            // An under-18 date still goes to the server, which deletes the Auth user and answers UNDERAGE (§3.1).
            update({ firstName: parsed.data, dob });
            router.push('/area');
          }}
        />
      }
    >
      <StepHeader
        step={STEP}
        total={STEPS}
        stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })}
        backLabel={t('common.back')}
        onBack={() => router.back()}
      />
      <View style={styles.intro}>
        <Title>{t('onboarding.about.title')}</Title>
        <Body muted>{t('onboarding.about.lead')}</Body>
      </View>
      <Field
        label={t('onboarding.name.label')}
        value={name}
        onChangeText={setName}
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        maxLength={30}
        hint={t('onboarding.name.who')}
        error={name.length > 0 && !parsed.success ? t('onboarding.name.invalid') : null}
      />
      <View style={styles.group}>
        <AppText variant="section">{t('onboarding.about.dob')}</AppText>
        <View style={styles.dateRow}>
          {dateField(t('onboarding.dob.day'), day, setDay, 2)}
          {dateField(t('onboarding.dob.month'), month, setMonth, 2)}
          {dateField(t('onboarding.dob.year'), year, setYear, 4)}
        </View>
        <AppText variant="caption" tone="muted">
          {t('onboarding.about.dobHint')}
        </AppText>
        {year.length === 4 && dob === null ? <ErrorText>{t('onboarding.dob.invalid')}</ErrorText> : null}
        {underage ? <ErrorText>{t('onboarding.dob.underage')}</ErrorText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: Spacing.sm },
  group: { gap: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCell: { flex: 1, gap: Spacing.xs },
});
