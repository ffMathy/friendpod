import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Body, Button, ErrorText, Field, Heading, Screen } from '@/components/ui';
import { composeDob, isAdult } from '@/features/onboarding/dob';
import { useOnboardingDraft } from '@/features/onboarding/draft';

/** §3.1 step 4: date of birth, entered on the device. Only the birth year is ever stored (server side). */
export default function DateOfBirth() {
  const { t } = useTranslation();
  const router = useRouter();
  const { update } = useOnboardingDraft();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const dob = year.length === 4 ? composeDob(year, month, day) : null;
  const underage = dob !== null && !isAdult(dob, new Date());

  return (
    <Screen>
      <Heading>{t('onboarding.dob.title')}</Heading>
      <Body muted>{t('onboarding.dob.why')}</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label={t('onboarding.dob.day')} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('onboarding.dob.month')} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={{ flex: 2 }}>
          <Field label={t('onboarding.dob.year')} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>
      {year.length === 4 && dob === null ? <ErrorText>{t('onboarding.dob.invalid')}</ErrorText> : null}
      {underage ? <ErrorText>{t('onboarding.dob.underage')}</ErrorText> : null}
      <Button
        label={t('common.continue')}
        disabled={dob === null}
        onPress={() => {
          // An under-18 date still goes to the server, which deletes the Auth user and answers UNDERAGE (§3.1).
          update({ dob });
          router.push('/name');
        }}
      />
    </Screen>
  );
}
