import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Checkbox, Heading, LinkRow, Screen } from '@/components/ui';
import { useOnboardingDraft } from '@/features/onboarding/draft';

/**
 * §3.1 step 3: the Terms are accepted (contract); the layered privacy notice is information, not
 * consent. Versions are sent with completeOnboarding.
 */
export default function Terms() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const [accepted, setAccepted] = useState(draft.legalAccepted);
  return (
    <Screen>
      <Heading>{t('onboarding.terms.title')}</Heading>
      <Body>{t('onboarding.terms.body')}</Body>
      <LinkRow label={t('onboarding.terms.readTerms')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } })} />
      <LinkRow label={t('onboarding.terms.readPrivacy')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } })} />
      <Checkbox label={t('onboarding.terms.accept')} checked={accepted} onChange={setAccepted} />
      <Button
        label={t('common.continue')}
        disabled={!accepted}
        onPress={() => {
          update({ legalAccepted: true });
          router.push('/dob');
        }}
      />
    </Screen>
  );
}
