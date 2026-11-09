import { CHAT_MESSAGE_MAX } from '@grouper/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { BorderWidth, Radius, Size, typeStyle, usePalette } from '@/components/theme';

/** The counter appears from here on, so the limit is clear before it is reached (A28: 500 characters). */
const COUNTER_FROM = Math.floor(CHAT_MESSAGE_MAX * 0.8);

export interface ComposerProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  /** False outside the window: the field and Send are disabled, existing messages stay readable. */
  readonly enabled: boolean;
  readonly busy: boolean;
  /** While the contact-details warning offers "Send anyway" / "Edit" instead, the plain send waits. */
  readonly holdSend?: boolean;
  readonly inputRef?: Ref<TextInputInstance>;
}

/**
 * The meetup-chat field (pod-chat), the app's one input + button pattern (decision 7): a 52 px white input with the
 * 1.5 px Field border (2 px Skov deep when focused) and a separate 52 px Skov "Send →", both radius 14, gap 8; a
 * counter appears near 500 (A28).
 */
export function Composer({ value, onChangeText, onSend, enabled, busy, holdSend = false, inputRef }: ComposerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const length = value.length;
  const trimmed = value.trim().length;
  const canSend = enabled && !holdSend && !busy && trimmed > 0 && trimmed <= CHAT_MESSAGE_MAX;
  return (
    <View style={styles.composer}>
      {length >= COUNTER_FROM ? (
        <Text
          accessibilityLabel={t('chat.counterLabel', { length, max: CHAT_MESSAGE_MAX })}
          variant="microStrong"
          color={length >= CHAT_MESSAGE_MAX ? 'danger' : 'textMuted'}
          align="right"
        >
          {t('chat.counter', { length, max: CHAT_MESSAGE_MAX })}
        </Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          testID="chat-input"
          accessibilityLabel={t('chat.inputLabel')}
          accessibilityState={{ disabled: !enabled }}
          editable={enabled}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={p.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={1}
          maxLength={CHAT_MESSAGE_MAX}
          style={[typeStyle('bodySmall'), styles.input, { color: p.text, backgroundColor: p.surface, borderColor: p.field, opacity: enabled ? 1 : 0.55 }]}
        />
        <Pressable
          testID="chat-send"
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          onPress={onSend}
          // Solid Skov while the chat is open (the storyboard), even with nothing to send yet; dimmed once it closes.
          style={({ pressed }) => [styles.send, { backgroundColor: pressed && canSend ? p.primaryPressed : p.primary, opacity: enabled ? 1 : 0.4 }]}
        >
          {busy ? (
            <ActivityIndicator color={p.onPrimary} />
          ) : (
            <>
              <Text variant="button" color="onPrimary">
                {t('chat.send')}
              </Text>
              <Icon name="send" size={18} strokeWidth={2.4} color={p.onPrimary} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: Size.inputCompact,
    maxHeight: 120,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.control,
    paddingHorizontal: 12,
    // 14 a side: the empty one-line field is 52, as tall as Send (15 a side made it 54); minHeight keeps 52 at least.
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'center',
  },
  send: { height: Size.inputCompact, borderRadius: Radius.md, paddingLeft: 18, paddingRight: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
