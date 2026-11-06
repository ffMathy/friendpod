import type { PodMessageDoc } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Text } from '@/components/ui';
import { BorderWidth, usePalette } from '@/components/theme';

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
 * One meetup-chat message (pod-chat): "Mette · Fri 15:02" over a white bubble on the left, or "You · 19:05" over a
 * green one on the right.
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

  return (
    <Pressable {...a11y} style={[styles.row, own ? styles.own : styles.other]}>
      {/* One run of text: a nested Text brings its own line height and makes the line 1 px taller than the storyboard's. */}
      <Text variant="microBold" color="textSecondary" style={own ? styles.ownMeta : styles.otherMeta}>
        {`${authorName} · ${time}`}
      </Text>
      <View style={[styles.bubble, own ? [styles.ownBubble, { backgroundColor: p.primary }] : [styles.otherBubble, { backgroundColor: p.surface, borderColor: p.border }]]}>
        <Text variant="body" color={own ? 'onPrimary' : 'text'} style={styles.text}>
          {body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: 280, gap: 3 },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  // 12/700 author line and 15 px text at line height 1.45, as on the storyboard.
  ownMeta: { paddingRight: 4, lineHeight: 15 },
  otherMeta: { paddingLeft: 4, lineHeight: 15 },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  ownBubble: { borderBottomRightRadius: 6 },
  otherBubble: { borderBottomLeftRadius: 6, borderWidth: BorderWidth.hairline },
  text: { lineHeight: 21.75 },
});
