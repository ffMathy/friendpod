import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lede, Screen, StepHeader, Text, Title } from '@/components/ui';

/** The storyboard's onboarding has six steps (onb-about … onb-final). */
export const ONBOARDING_STEPS = 6;

export interface OnboardingStepProps {
  /** 1–6. */
  readonly step: number;
  readonly title: string;
  /** `compact` (28) for the long consent title. */
  readonly titleSize?: 'default' | 'compact';
  /** The muted paragraph under the title. */
  readonly lede?: string;
  /** `lede` 16 px (default) or `body` 15 px (the interests step). */
  readonly ledeSize?: 'lede' | 'body';
  /** Above the title (the "Private interests" badge). */
  readonly above?: ReactNode;
  /** The back chevron; leave out where there is nowhere to go back to. */
  readonly onBack?: () => void;
  /** The step's main action, at the bottom. */
  readonly footer?: ReactNode;
  /**
   * Pin the footer above the content (default). `false` puts it at the end of the scrolling content instead, pushed to
   * the bottom when the content is short, as the storyboards draw it: for a step whose last block is what the action
   * needs (the safety pledge before Finish), so a pinned button never covers it.
   */
  readonly footerPinned?: boolean;
  /** Gap between the blocks (the storyboards use 24 on the form steps and 14–18 on the denser ones). */
  readonly gap?: number;
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * One onboarding step as drawn in onb-*.dc.html: "Step n of 6" with the 6 px bar, a 30/800 title (28 on the consent
 * step) with its muted lede, the step's content, and the main action pinned to the bottom.
 */
export function OnboardingStep({
  step,
  title,
  titleSize = 'default',
  lede,
  ledeSize = 'lede',
  above,
  onBack,
  footer,
  footerPinned = true,
  gap = 24,
  children,
  testID,
}: OnboardingStepProps) {
  return (
    <Screen safeTop testID={testID} gap={gap} header={<OnboardingHeader step={step} onBack={onBack} />} footer={footerPinned ? footer : undefined}>
      <View style={[styles.intro, { gap: ledeSize === 'body' ? 6 : 8 }]}>
        {above}
        <Title size={titleSize}>{title}</Title>
        {lede ? (
          ledeSize === 'body' ? (
            <Text variant="body" color="textMuted">
              {lede}
            </Text>
          ) : (
            <Lede>{lede}</Lede>
          )
        ) : null}
      </View>
      {children}
      {footer && !footerPinned ? (
        <>
          <View style={styles.spacer} />
          {footer}
        </>
      ) : null}
    </Screen>
  );
}

/**
 * The storyboards keep 40 px above the "Step n of 6" row (24 page padding + 16). On a phone the status bar inset is
 * larger and stands in for it; where there is none (tablet split view, web) the header gets the storyboard's room.
 */
export function useStoryboardTop(): number {
  return Math.max(0, 24 - useSafeAreaInsets().top);
}

/** `StepHeader` with the storyboard's top room; also used by the consent step, which lays out its own screen. */
export function OnboardingHeader({ step, onBack }: { readonly step: number; readonly onBack?: () => void }) {
  const top = useStoryboardTop();
  return (
    <View style={{ paddingTop: top }}>
      <StepHeader step={step} total={ONBOARDING_STEPS} onBack={onBack} />
    </View>
  );
}

/** Back to the previous step when there is one in this stack (after a resume there is none). */
export function useStepBack(): (() => void) | undefined {
  const router = useRouter();
  return router.canGoBack() ? () => router.back() : undefined;
}

const styles = StyleSheet.create({
  intro: { alignItems: 'stretch' },
  spacer: { flexGrow: 1 },
});
