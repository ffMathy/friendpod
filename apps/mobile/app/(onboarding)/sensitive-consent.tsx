import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9ConsentActions, Art9ConsentBody, Art9ConsentHeading } from '@/features/consent/Art9BlanketConsent';
import { OnboardingHeader, useStepBack } from '@/features/onboarding/OnboardingStep';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Step 3 of 6, the blanket Art. 9 consent (onb-consent; D3, DESIGN §3.1 step 7), after `completeOnboarding`
 * (setArt9Consent needs the onboarding claim) and before the interests. The text is the locked copy from
 * @grouper/core; the storyboard's look, not its wording. "Not now" records nothing and carries on; the consent can be
 * given later in Settings → Privacy. Opened from the interests step (a refused sensitive interest), it returns there.
 */
export default function SensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useStepBack();
  const locale = currentLocale();
  const [checked, setChecked] = useState(false);
  const give = useCallable('setArt9Consent');
  const next = () => (router.canGoBack() ? router.back() : router.push('/add-interests'));
  return (
    <Screen
      safeTop
      gap={14}
      header={<OnboardingHeader step={3} onBack={back} />}
      footer={
        // onb-consent keeps 28 px under "Continue without" where the other steps keep 32.
        <View style={styles.footer}>
          <Art9ConsentActions
            locale={locale}
            checked={checked}
            onCheck={setChecked}
            busy={give.isPending}
            error={give.error ? t(errorMessageKey(give.error)) : null}
            onAgree={(consent) => give.mutate({ consent }, { onSuccess: next })}
            onNotNow={next}
          />
        </View>
      }
    >
      <Art9ConsentHeading locale={locale} />
      <Art9ConsentBody locale={locale} onReadMore={() => router.push('/info/sensitive-interests')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginBottom: -4 },
});
