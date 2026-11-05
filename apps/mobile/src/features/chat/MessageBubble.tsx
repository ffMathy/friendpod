import type { PodMessageDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Spacing, usePalette } from '@/components/theme';

export interface MessageBubbleProps {
  readonly message: PodMessageDoc;
  /** First name from the pod roster, "You", or "Former member". */
  readonly authorName: string;
  readonly own: boolean;
  readonly time: string;
  /** Long press or the screen reader's "Report message" action; absent on the viewer's own messages. */
  readonly onReport?: () => void;
}

/** One meetup-chat message: own text right-aligned, others' with the author's first name. */
export function MessageBubble({ message, authorName, own, time, onReport }: MessageBubbleProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const body = message.text;
  const a11y = {
    accessible: true,
    accessibilityLabel: t('chat.messageLabel', { name: authorName, time, text: body }),
    accessibilityActions: onReport ? [{ name: 'report', label: t('chat.report') }] : undefined,
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'report') onReport?.();
    },
    onLongPress: onReport,
  };

  return (
    <Pressable {...a11y} style={[styles.row, own ? styles.own : styles.other]}>
      {own ? null : <Text style={[styles.name, { color: p.textSecondary }]}>{authorName}</Text>}
      <View style={[styles.bubble, { backgroundColor: own ? p.primary : p.surface }]}>
        <Text style={[styles.text, { color: own ? p.onPrimary : p.text }]}>{body}</Text>
      </View>
      <Text style={[styles.time, { color: p.textSecondary }]}>{time}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '85%', gap: 2 },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  name: { fontSize: 13, fontWeight: '600' },
  bubble: { borderRadius: 16, paddingVertical: Spacing.sm, paddingHorizontal: 12 },
  text: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 11 },
});
