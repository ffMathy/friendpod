import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Size } from '@/components/theme';
import { BackButton, ProgressSegments, Screen, Text, Title } from '@/components/ui';

/** The storyboard's onboarding has six steps (onb-about … onb-final). */
export const ONBOARDING_STEPS = 6;

/** The onboarding steps' rhythm (onb-*): 12 px between blocks, as the storyboards' `main` sets it. */
export const STEP_GAP = 12;

/** The storyboards leave 20 px under the step's action where there is no home indicator. */
const STEP_BOTTOM = 20;

/**
 * The step's content starts flush with its scroll area: the 12 px between the segments and the title belong to the
 * fixed header (its bottom padding), so content scrolled up stops 12 px under the segments instead of touching them.
 * At rest the title sits where the storyboards draw it, 12 under the segments, as before.
 */
export const STEP_CONTENT: ViewStyle = { paddingTop: 0 };

export interface OnboardingStepProps {
  /** 1–6. */
  readonly step: number;
  readonly title: string;
  /** The paragraph under the title (15/22, Ink 2). */
  readonly lede?: string;
  /** Above the title (an eyebrow). */
  readonly above?: ReactNode;
  /** The back chevron; leave out where there is nowhere to go back to. */
  readonly onBack?: () => void;
  /**
   * The step's main action, pinned under the content so it is always in view: where the step is taller than the screen
   * (Danish copy, large text, the "Did you mean" card) the blocks scroll above it.
   */
  readonly footer?: ReactNode;
  /** Gap between the blocks (default {@link STEP_GAP}). */
  readonly gap?: number;
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * One onboarding step as drawn in onb-*.dc.html (blend spec §6.12 B): the step header, the Title (Bricolage 30/32) with
 * its 15/22 Ink 2 lede 4 px under it, the step's blocks 12 apart on Paper, and the main action (Skov, 54) pinned at the
 * bottom, 12 under the last block when the content fills the screen. Calm: no colour fields, no marks.
 */
export function OnboardingStep({ step, title, lede, above, onBack, footer, gap = STEP_GAP, children, testID }: OnboardingStepProps) {
  return (
    <Screen
      safeTop
      testID={testID}
      gap={gap}
      // The footer's own 12 px top padding is the gap to the last block, as the storyboards' 12 px rhythm has it.
      contentStyle={footer ? [STEP_CONTENT, styles.content] : STEP_CONTENT}
      header={<OnboardingHeader step={step} onBack={onBack} />}
      footer={footer ? <StepFooter>{footer}</StepFooter> : undefined}
    >
      <StepTitle title={title} lede={lede} above={above} />
      {children}
    </Screen>
  );
}

/**
 * The step's pinned actions, 20 px above the bottom edge where there is no home indicator, as the onb-* storyboards
 * draw them (Screen's footer keeps at least {@link Layout.bottom}, 32, for the other screens). With a bottom inset
 * (the home indicator) they stay just above it, as everywhere else.
 */
export function StepFooter({ children }: { readonly children: ReactNode }) {
  const inset = useSafeAreaInsets().bottom;
  const lift = Math.max(inset, Layout.bottom) - Math.max(inset, STEP_BOTTOM);
  return <View style={lift > 0 ? { marginBottom: -lift } : null}>{children}</View>;
}

/** The step's title block: an optional eyebrow, the Title, and the lede 4 px under it. */
export function StepTitle({ title, lede, above }: { readonly title: string; readonly lede?: string; readonly above?: ReactNode }) {
  return (
    <View style={styles.intro}>
      {above}
      <Title>{title}</Title>
      {lede ? (
        <Text variant="bodySmall" color="textSecondary">
          {lede}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Room above the step header where there is no status bar (tablet split view, web): the storyboards start the header
 * 28 px down (20 page padding + 8), and Screen already adds 8. On a phone the status bar inset stands in for it.
 */
export function useStoryboardTop(room = 20): number {
  return Math.max(0, room - useSafeAreaInsets().top);
}

/**
 * The step header (spec §6.12 B, onb-*): the 44 px back chevron and "Step n of 6" (13/600 Muted) in one row, the six
 * 6 px segments 8 px under it (done Skov, to do Track). Without `onBack` the row keeps its height. It ends with the
 * step's 12 px gap on Paper, so scrolled content never runs into the segments; pair it with {@link STEP_CONTENT}.
 */
export function OnboardingHeader({ step, onBack }: { readonly step: number; readonly onBack?: () => void }) {
  const { t } = useTranslation();
  const top = useStoryboardTop();
  return (
    <View style={[styles.header, { paddingTop: top }]}>
      <View style={styles.row}>
        {onBack ? <BackButton onPress={onBack} accessibilityLabel={t('common.back')} /> : <View style={styles.backSpacer} />}
        <Text variant="captionStrong" color="textMuted">
          {t('common.stepOf', { step, total: ONBOARDING_STEPS })}
        </Text>
      </View>
      <ProgressSegments total={ONBOARDING_STEPS} filled={step} />
    </View>
  );
}

/** Back to the previous step when there is one in this stack (after a resume there is none). */
export function useStepBack(): (() => void) | undefined {
  const router = useRouter();
  return router.canGoBack() ? () => router.back() : undefined;
}

const styles = StyleSheet.create({
  header: { gap: 8, paddingBottom: STEP_GAP },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backSpacer: { height: Size.hitTarget },
  intro: { gap: 4 },
  content: { paddingBottom: 0 },
});
