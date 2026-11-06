import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader } from '@/components/ui';
import { SignInOptions } from '@/features/auth/SignInOptions';

/**
 * §3.1 step 2 on its own page: Apple (iOS), Google or an email link; no SMS (F10). The welcome screen now shows the
 * same options itself (storyboard 1.1), so nothing in the app links here any more; the route stays for old links.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen wide gap={24}>
      <ScreenHeader title={t('auth.signIn.title')} subtitle={t('auth.signIn.intro')} backLabel={t('common.back')} onBack={() => router.back()} />
      <SignInOptions onEmail={() => router.push('/email')} />
    </Screen>
  );
}
