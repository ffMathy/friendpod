import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Sizes, Spacing } from '@/components/theme';
import { Body, Button, Checkbox, ListGroup, LinkRow, Logo, Screen, Title } from '@/components/ui';
import { useOnboardingDraft } from '@/features/onboarding/draft';

/**
 * §3.1 step 3: the Terms are accepted (contract); the layered privacy notice is information, not
 * consent. Versions are sent with completeOnboarding. The storyboards fold this into the welcome screen ("By continuing
 * you accept the Terms"); it stays an explicit, unticked step before "About you", without a step number.
 */
export default function Terms() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const [accepted, setAccepted] = useState(draft.legalAccepted);
  return (
    <Screen
      wide
      gap={24}
      footer={
        <Button
          label={t('common.continue')}
          variant="accent"
          disabled={!accepted}
          onPress={() => {
            update({ legalAccepted: true });
            router.push('/name');
          }}
        />
      }
    >
      {/* Same height as the StepHeader on the next steps, so the titles line up. */}
      <View style={styles.top}>
        <Logo size={28} />
      </View>
      <View style={styles.intro}>
        <Title>{t('onboarding.terms.title')}</Title>
        <Body muted>{t('onboarding.terms.body')}</Body>
      </View>
      <ListGroup>
        <LinkRow label={t('onboarding.terms.readTerms')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } })} />
        <LinkRow label={t('onboarding.terms.readPrivacy')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } })} />
      </ListGroup>
      <Checkbox variant="card" label={t('onboarding.terms.accept')} checked={accepted} onChange={setAccepted} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: Sizes.touch + 20, justifyContent: 'center' },
  intro: { gap: Spacing.sm },
});
