import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Screen } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { Art9ConsentActions, Art9ConsentBox, Art9ConsentHeading } from '@/features/consent/Art9BlanketConsent';
import { OnboardingHeader, STEP_CONTENT, STEP_GAP, StepFooter, useStepBack } from '@/features/onboarding/OnboardingStep';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/** Below this the copy box is too short to read in (a small phone, large text): the page then scrolls as one column. */
const MIN_BOX = 160;

/**
 * Step 3 of 6, the blanket Art. 9 consent (onb-consent; D3, DESIGN §3.1 step 7), after `completeOnboarding`
 * (setArt9Consent needs the onboarding claim) and before the interests. The text is the locked copy from
 * @grouper/core; the storyboard's look, not its wording: the "Private interests" eyebrow and the title stay put, the
 * copy scrolls in its own white box with the 1.5 px Ink border (private stays quiet), and the consent box, "I agree"
 * and "Not now" are pinned under it. "Not now" records nothing and carries on; the consent can be given later in
 * Settings → Privacy. Opened from the interests step (a refused sensitive interest), it returns there.
 */
export default function SensitiveConsent() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useStepBack();
  const locale = currentLocale();
  const [checked, setChecked] = useState(false);
  const give = useCallable('setArt9Consent');
  const { boxed, onBoxLayout } = useBoxFits();
  const next = () => (router.canGoBack() ? router.back() : router.push('/add-interests'));
  const readMore = () => router.push('/info/sensitive-interests');
  const actions = (
    <Art9ConsentActions
      locale={locale}
      checked={checked}
      onCheck={setChecked}
      busy={give.isPending}
      error={give.error ? t(errorMessageKey(give.error)) : null}
      onAgree={(consent) => give.mutate({ consent }, { onSuccess: next })}
      onNotNow={next}
    />
  );
  const header = <OnboardingHeader step={3} onBack={back} />;
  if (!boxed) {
    // Too little room for the box: the copy runs at its full height and the actions follow it, all in one scroll.
    return (
      <Screen safeTop gap={STEP_GAP} contentStyle={STEP_CONTENT} header={header}>
        <Art9ConsentHeading locale={locale} />
        <Art9ConsentBox locale={locale} onReadMore={readMore} scrollInside={false} />
        {actions}
      </Screen>
    );
  }
  return (
    // The page does not scroll: the box takes the room between the title and the actions, its rounded bottom 12 above
    // the consent box (the footer's own top padding), and the copy scrolls inside it.
    <Screen safeTop scroll={false} gap={STEP_GAP} contentStyle={[STEP_CONTENT, styles.content]} header={header} footer={<StepFooter>{actions}</StepFooter>}>
      <Art9ConsentHeading locale={locale} />
      <Art9ConsentBox locale={locale} onReadMore={readMore} onLayout={onBoxLayout} />
    </Screen>
  );
}

/**
 * Whether the box gets enough room to read in. It is measured where it is laid out; once too short it stays in the
 * one-column layout until the window or the text size changes, when it is measured again.
 */
function useBoxFits(): { readonly boxed: boolean; readonly onBoxLayout: (event: LayoutChangeEvent) => void } {
  const { height, fontScale } = useWindowDimensions();
  const room = `${height}:${fontScale}`;
  const [tooShortIn, setTooShortIn] = useState<string | null>(null);
  return {
    boxed: tooShortIn !== room,
    onBoxLayout: (event) => {
      if (event.nativeEvent.layout.height < MIN_BOX) setTooShortIn(room);
    },
  };
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0 },
});
