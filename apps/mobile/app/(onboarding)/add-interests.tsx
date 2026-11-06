import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Screen, StepHeader, Title } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';
import { InterestManager, MIN_INTERESTS } from '@/features/interests/InterestManager';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

const STEP = 4;
const STEPS = 6;

/** §3.1 step 8 (storyboard 1.5): free-text interests, minimum 3 (nudged towards 5). */
export default function AddInterests() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const ordinary = useInterests(uid).data ?? [];
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const enough = ordinary.length + sensitive.length >= MIN_INTERESTS;
  return (
    <Screen
      wide
      gap={18}
      footer={
        <Button
          testID="interests-continue"
          label={t('common.continue')}
          variant="accent"
          disabled={!enough}
          onPress={() => router.push('/pod-preferences')}
        />
      }
    >
      <StepHeader
        step={STEP}
        total={STEPS}
        stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })}
        backLabel={t('common.back')}
        // The consent step replaced itself with this one; going back reopens it (setArt9Consent is idempotent).
        onBack={() => router.replace('/sensitive-consent')}
      />
      <View style={styles.titles}>
        <Title>{t('onboarding.interests.question')}</Title>
        <AppText variant="bodyMd" tone="muted">
          {t('onboarding.interests.subtitle')}
        </AppText>
      </View>
      <InterestManager uid={uid} locale={currentLocale()} mode="onboarding" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 6 },
});
