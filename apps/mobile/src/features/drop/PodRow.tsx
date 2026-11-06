import type { PodCardDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '@/components/theme';
import { AppText, AvatarStack, Card, Icon } from '@/components/ui';
import { usePodSummary } from './podSummary';

export interface PodRowProps {
  readonly uid: string;
  readonly podId: string;
  readonly card: PodCardDoc;
  readonly onPress: () => void;
  /** Defaults to `pod-row-{podId}`. */
  readonly testID?: string;
}

/**
 * A pod in a list (storyboard 2.1 "Your pods" row, on This week and the Pods tab): the other members' initials in their
 * pod colours (the same as on the pod page), the theme (a lock for a private interest) and the plan or state, opening
 * the pod page.
 */
export function PodRow({ uid, podId, card, onPress, testID }: PodRowProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const { members, detail } = usePodSummary(uid, podId, card);
  const theme = card.themeLabel ?? t('pods.openToAnyone');
  const name = card.themeSensitive ? t('interests.privateLabel', { name: theme }) : theme;
  const others = members.filter((m) => !m.you);

  return (
    <Card onPress={onPress} accessibilityLabel={`${name}, ${detail}`} padding={0} testID={testID ?? `pod-row-${podId}`}>
      <View style={styles.row}>
        {others.length > 0 ? (
          <AvatarStack members={others} size={32} max={3} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: card.themeSensitive ? p.violetBg : p.mint }]}>
            <Icon name={card.themeSensitive ? 'lock' : 'people'} size={18} color={card.themeSensitive ? p.violet : p.primary} />
          </View>
        )}
        <View style={styles.text}>
          <View style={styles.titleRow}>
            {card.themeSensitive && others.length > 0 ? <Icon name="lock" size={14} color={p.violet} /> : null}
            <AppText variant="section" style={styles.flexShrink} numberOfLines={1}>
              {theme}
            </AppText>
          </View>
          <AppText variant="caption" tone="muted">
            {detail}
          </AppText>
        </View>
        <Icon name="chevronRight" size={20} color={p.muted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  placeholder: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexShrink: { flexShrink: 1 },
});
