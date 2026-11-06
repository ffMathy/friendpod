import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BackButton, Logo } from '@/components/ui';

/**
 * The header of the sign-in steps after the welcome screen (/email, /auth/complete): the welcome screen's pod-dots
 * logo, with the back chevron in front of it where there is a way back, laid out like the onboarding `StepHeader`
 * ("‹ Step 1 of 6"). One look from the welcome screen to the first onboarding step.
 */
export function AuthHeader({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {onBack ? <BackButton onPress={onBack} accessibilityLabel={t('common.back')} /> : null}
      <Logo size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  // 44 px tall either way, so the title below starts at the same height with and without the chevron.
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
});
