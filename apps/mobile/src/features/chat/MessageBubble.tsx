import type { PodMessageDoc } from '@friendpod/core';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Text } from '@/components/ui';
import { BorderWidth, usePalette, usePodColors } from '@/components/theme';
import type { PodColor } from '@/lib/podColor';

export interface MessageBubbleProps {
  readonly message: PodMessageDoc;
  /** First name from the pod roster, "You", or "Former member". */
  readonly authorName: string;
  readonly own: boolean;
  readonly time: string;
  /** The pod's colour: the viewer's own bubbles are its tint. `null` (a private pod): Paper with a Line border. */
  readonly color: PodColor | null;
  /** Long press or the screen reader's "Report message" action; absent on the viewer's own messages. */
  readonly onReport?: () => void;
}

/**
 * One meetup-chat message (pod-chat): "Mette · Fri 15:02" over a white bubble with a Line border on the left, or
 * "You · 19:05" over the viewer's own on the right, in the pod's tint with its base-@-40% border (dark mode: the deep
 * tone with white text). In a pod about a private interest nothing is coloured: the viewer's bubbles are Paper.
 */
export function MessageBubble({ message, authorName, own, time, color, onReport }: MessageBubbleProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const c = usePodColors(color);
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
  const look = !own
    ? { backgroundColor: p.surface, borderColor: p.border, color: p.text }
    : color
      ? { backgroundColor: c.surface, borderColor: c.surfaceBorder, color: c.onSurface }
      : { backgroundColor: p.inset, borderColor: p.border, color: p.text };

  return (
    <Pressable {...a11y} style={[styles.row, own ? styles.own : styles.other]}>
      {/* One run of text: a nested Text brings its own line height and makes the line taller than the storyboard's. */}
      <Text variant="microBold" color="textMuted" style={own ? styles.ownMeta : styles.otherMeta}>
        {`${authorName} · ${time}`}
      </Text>
      <View style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
        <Text variant="bodySmall" style={[styles.text, { color: look.color }]}>
          {body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: 280, gap: 4 },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  ownMeta: { paddingRight: 4 },
  otherMeta: { paddingLeft: 4 },
  bubble: { borderRadius: 18, borderWidth: BorderWidth.hairline, paddingVertical: 10, paddingHorizontal: 14 },
  ownBubble: { borderBottomRightRadius: 6 },
  otherBubble: { borderBottomLeftRadius: 6 },
  // 15 px at line height 1.45, as on the storyboard.
  text: { lineHeight: 21.75 },
});
