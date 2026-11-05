import { firstNameSchema } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ErrorText, Field, Heading, Screen } from '@/components/ui';
import { useOnboardingDraft } from '@/features/onboarding/draft';

/** §3.1 step 5: first name, visible only to confirmed pod members. */
export default function FirstName() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const [name, setName] = useState(draft.firstName ?? '');
  const parsed = firstNameSchema.safeParse(name);
  return (
    <Screen>
      <Heading>{t('onboarding.name.title')}</Heading>
      <Body muted>{t('onboarding.name.who')}</Body>
      <Field label={t('onboarding.name.label')} value={name} onChangeText={setName} autoComplete="given-name" maxLength={30} />
      {name.length > 0 && !parsed.success ? <ErrorText>{t('onboarding.name.invalid')}</ErrorText> : null}
      <Button
        label={t('common.continue')}
        disabled={!parsed.success}
        onPress={() => {
          if (!parsed.success) return;
          update({ firstName: parsed.data });
          router.push('/area');
        }}
      />
    </Screen>
  );
}
