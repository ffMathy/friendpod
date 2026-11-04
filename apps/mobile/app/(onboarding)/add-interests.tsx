import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Heading, Screen } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';
import { InterestManager } from '@/features/interests/InterestManager';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

const MIN_INTERESTS = 3;

/** §3.1 step 7: free-text interests, minimum 3 (nudged towards 5). */
export default function AddInterests() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useUid();
  const ordinary = useInterests(uid).data ?? [];
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const enough = ordinary.length + sensitive.length >= MIN_INTERESTS;
  return (
    <Screen>
      <Heading>{t('onboarding.interests.title')}</Heading>
      <InterestManager uid={uid} locale={currentLocale()} mode="onboarding" />
      <Button label={t('common.continue')} disabled={!enough} onPress={() => router.push('/pod-preferences')} />
    </Screen>
  );
}
