import { firstNameSchema } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorText, Label, Small, Text, TextField } from '@/components/ui';
import { signOut } from '@/features/account/account';
import { composeDob, isAdult, splitDob } from '@/features/onboarding/dob';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { TermsAcceptance } from '@/features/onboarding/TermsAcceptance';

/**
 * Step 1 of 6, "About you" (onb-about; DESIGN §3.1 steps 3–5): first name (seen only by confirmed pod members), date of
 * birth entered on the device (the server keeps only the birth year), and the Terms. Nothing is sent yet: the answers
 * wait in the in-memory draft until completeOnboarding on the next step. As onb-about draws it: 52 px inputs with 15/700
 * labels, Day / Month / Year sub-labels, the Terms tick (§3.1 step 3: explicit, unticked at first) with the Terms and
 * privacy notice links under it, Continue (Skov) at the bottom.
 */
export default function AboutYou() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const initialDob = splitDob(draft.dob);
  const [name, setName] = useState(draft.firstName ?? '');
  const [day, setDay] = useState(initialDob.day);
  const [month, setMonth] = useState(initialDob.month);
  const [year, setYear] = useState(initialDob.year);
  const [accepted, setAccepted] = useState(draft.legalAccepted);

  const parsedName = firstNameSchema.safeParse(name);
  const dob = year.length === 4 && day.length > 0 && month.length > 0 ? composeDob(year, month, day) : null;
  const dobInvalid = year.length === 4 && day.length > 0 && month.length > 0 && dob === null;
  const underage = dob !== null && !isAdult(dob, new Date());
  const ready = parsedName.success && dob !== null && accepted;

  const next = () => {
    if (!parsedName.success || dob === null || !accepted) return;
    // An under-18 date still goes to the server, which deletes the Auth user and answers UNDERAGE (§3.1).
    update({ firstName: parsedName.data, dob, legalAccepted: true });
    router.push('/area');
  };

  // The first step: "back" returns to the welcome screen, which means signing out (nothing has been saved yet).
  const back = router.canGoBack() ? () => router.back() : () => void signOut().catch(() => undefined);
  const dobLabel = t('onboarding.about.dob');
  const dobParts = [
    { key: 'day', value: day, onChange: setDay, maxLength: 2 },
    { key: 'month', value: month, onChange: setMonth, maxLength: 2 },
    { key: 'year', value: year, onChange: setYear, maxLength: 4 },
  ] as const;

  return (
    <OnboardingStep
      step={1}
      title={t('onboarding.about.title')}
      lede={t('onboarding.about.lede')}
      onBack={back}
      footer={<Button testID="about-continue" label={t('common.continue')} disabled={!ready} onPress={next} />}
    >
      <View style={styles.block}>
        <TextField
          testID="first-name"
          size="md"
          label={t('onboarding.about.firstName')}
          helper={t('onboarding.about.firstNameHelp')}
          error={name.length > 0 && !parsedName.success ? t('onboarding.about.firstNameInvalid') : null}
          value={name}
          onChangeText={setName}
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          maxLength={30}
        />
      </View>

      <View style={styles.fieldset} accessibilityRole="none">
        <Label style={styles.legend}>{dobLabel}</Label>
        <View style={styles.dobRow}>
          {dobParts.map(({ key, value, onChange, maxLength }) => (
            <View key={key} style={styles.dobPart}>
              {/* onb-about's 13/600 sub-labels, 6 px over their inputs; each input's own label names both. */}
              <Text variant="captionStrong" color="textMuted" importantForAccessibility="no" accessibilityElementsHidden>
                {t(`onboarding.about.${key}`)}
              </Text>
              <TextField
                testID={`dob-${key}`}
                size="md"
                labelHidden
                label={`${dobLabel}, ${t(`onboarding.about.${key}`)}`}
                value={value}
                onChangeText={onChange}
                keyboardType="number-pad"
                maxLength={maxLength}
              />
            </View>
          ))}
        </View>
        <Small>{t('onboarding.about.dobHelp')}</Small>
        {dobInvalid ? <ErrorText>{t('onboarding.about.dobInvalid')}</ErrorText> : null}
        {underage ? <ErrorText>{t('onboarding.about.underage')}</ErrorText> : null}
      </View>

      <View style={styles.terms}>
        <TermsAcceptance accepted={accepted} onChange={setAccepted} />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  // onb-about adds 4 px above the first-name block (16 under the lede with the step's 12) and sets its label 15/20;
  // TextField's label line is 22, so 2 px here put the input, and everything under it, where the storyboard has them.
  block: { paddingTop: 2 },
  terms: { paddingTop: 4 },
  // The date of birth is a fieldset there: its legend (15/20) sits 12 under the first-name block and 12 above Day /
  // Month / Year.
  fieldset: { gap: 8 },
  legend: { lineHeight: 20, marginBottom: 4 },
  dobRow: { flexDirection: 'row', gap: 10 },
  dobPart: { flex: 1, gap: 6 },
});
