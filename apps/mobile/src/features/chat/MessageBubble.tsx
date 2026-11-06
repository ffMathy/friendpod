import type { PodMessageDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Fonts, Spacing, Type, usePalette } from '@/components/theme';

export interface MessageBubbleProps {
  readonly message: PodMessageDoc;
  /** First name from the pod roster, "You", or "Former member". */
  readonly authorName: string;
  readonly own: boolean;
  readonly time: string;
  /** Long press or the screen reader's "Report message" action; absent on the viewer's own messages. */
  readonly onReport?: () => void;
}

/**
 * One meetup-chat message (storyboard 3.5): "Name · time" above a bubble; the viewer's own in green on the right,
 * others' in white on the left.
 */
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
  const meta = [styles.meta, { color: p.inkSoft }];

  return (
    <Pressable {...a11y} style={[styles.row, own ? styles.own : styles.other]}>
      <View style={[styles.metaRow, own ? styles.metaOwn : styles.metaOther]}>
        <Text style={meta}>{authorName}</Text>
        <Text style={meta}>{` · ${time}`}</Text>
      </View>
      <View
        style={[
          styles.bubble,
          own
            ? [styles.bubbleOwn, { backgroundColor: p.primary }]
            : [styles.bubbleOther, { backgroundColor: p.surface, borderColor: p.border }],
        ]}
      >
        <Text style={[styles.text, { color: own ? p.onPrimary : p.ink }]}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '80%', gap: 3 },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  metaOwn: { paddingRight: Spacing.xs },
  metaOther: { paddingLeft: Spacing.xs },
  meta: { ...Fonts.bold, fontSize: 12, lineHeight: 16 },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleOwn: { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6, borderWidth: 1 },
  text: { ...Type.bodyMd },
});
