import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Screen, Text, Title } from '@/components/ui';

export interface AuthStepProps {
  readonly title: string;
  /** The paragraph under the title (16/24 Ink 2). */
  readonly lede: string;
  /** Announce the lede (it says what went wrong). */
  readonly ledeAlert?: boolean;
  /** The back chevron, where there is a way back. */
  readonly onBack?: () => void;
  /** Pinned at the bottom: the step's main action, and a way out under it. */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * The sign-in steps after the welcome (/email, /auth/complete), calm on Paper (blend spec §6.12 D, the plain pushed
 * header): the 44 px back chevron 32 px from the top, then the 30/32 Bricolage title and its lede; without a way back
 * the title starts 40 px down, as on a tab screen. The 24 px gutter and 24 px gaps of the onboarding steps, the main
 * action pinned at the bottom. No logo: the lockup is the welcome's alone (§7.1).
 */
export function AuthStep({ title, lede, ledeAlert = false, onBack, footer, children, testID }: AuthStepProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = Math.max(8, (onBack ? 32 : 40) - insets.top);
  return (
    <Screen testID={testID} safeTop gap={24} footer={footer} contentStyle={{ paddingTop: top }}>
      <View style={styles.head}>
        {onBack ? <BackButton onPress={onBack} accessibilityLabel={t('common.back')} /> : null}
        <View style={styles.titleBlock}>
          <Title>{title}</Title>
          <Text variant="body" color="textSecondary" accessibilityRole={ledeAlert ? 'alert' : undefined}>
            {lede}
          </Text>
        </View>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 12 },
  titleBlock: { gap: 8 },
});
