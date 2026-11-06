import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/components/navigation';

/** Welcome, sign-in and email link. Each screen draws its own header (storyboard 1.1, ScreenHeader), so no native bar. */
export default function AuthLayout() {
  const stackOptions = useStackScreenOptions();
  return <Stack screenOptions={{ ...stackOptions, headerShown: false }} />;
}
