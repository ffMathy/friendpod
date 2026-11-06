import { useRouter } from 'expo-router';
import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Checkbox, InlineLink, Text } from '@/components/ui';

/**
 * DESIGN §3.1 step 3, folded into "About you": the Terms are accepted (a contract, so an explicit tick that starts
 * unticked); the privacy notice is linked as information, not consent. The versions go with completeOnboarding.
 */
export function TermsAcceptance({ accepted, onChange }: { readonly accepted: boolean; readonly onChange: (accepted: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = (doc: 'terms' | 'privacy') => router.push({ pathname: '/info/legal/[doc]', params: { doc } });
  return (
    <View style={styles.block}>
      <Checkbox testID="terms-accept" label={t('onboarding.about.acceptTerms')} checked={accepted} onChange={onChange} />
      <Text variant="caption" color="textMuted" style={styles.links}>
        <Trans
          i18nKey="onboarding.about.legalLinks"
          components={{ terms: <InlineLink onPress={() => open('terms')}>{''}</InlineLink>, privacy: <InlineLink onPress={() => open('privacy')}>{''}</InlineLink> }}
        />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 0 },
  // Lines the links up with the checkbox label (24 px box + 12 px gap).
  links: { paddingLeft: 36, marginTop: -8 },
});
