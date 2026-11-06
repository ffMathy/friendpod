import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Radius } from '@/components/theme';
import { AppText, Card } from '@/components/ui';

export interface NextStepCardProps {
  /** The amber overline ("Next step"). */
  readonly label: string;
  /** The one thing to do now ("Still coming on Sat 15 Nov, 14:00?"). */
  readonly title: string;
  /** Optional muted line under the title. */
  readonly body?: string;
  /** The card's buttons (`onDark` / `outlineOnDark`), laid out in a row. */
  readonly actions?: ReactNode;
  /** Anything under the buttons (an error, fine print). */
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * The pod page's one primary card (D13, storyboard 3.4): a dark card with an amber "NEXT STEP" label, a 22/800
 * headline and its actions. Text inside switches to the card's light colours by itself.
 */
export function NextStepCard({ label, title, body, actions, children, testID }: NextStepCardProps) {
  return (
    <Card tone="night" radius="xl" padding={20} gap={14} style={styles.card} testID={testID}>
      <AppText variant="overlineStrong" tone="amber" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.text}>
        <AppText accessibilityRole="header" variant="headline">
          {title}
        </AppText>
        {body ? (
          <AppText variant="bodySm" tone="muted">
            {body}
          </AppText>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.hero },
  label: { fontSize: 12, lineHeight: 16 },
  text: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
