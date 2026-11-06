import { CHAT_MESSAGE_MAX } from '@grouper/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { BorderWidth, typeStyle, usePalette } from '@/components/theme';

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

/** The meetup-chat field (pod-chat): a round grey pill, a round green send button, and a counter near 500 (A28). */
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
          variant="micro"
          color={length >= CHAT_MESSAGE_MAX ? 'dangerText' : 'textMuted'}
          align="right"
          style={styles.counter}
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
          // Muted, not faint: the hint stays readable on the grey field (about 6:1), as dark as the storyboard's.
          placeholderTextColor={p.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={1}
          maxLength={CHAT_MESSAGE_MAX}
          style={[typeStyle('body'), styles.input, { color: p.text, backgroundColor: p.page, borderColor: p.borderStrong, opacity: enabled ? 1 : 0.55 }]}
        />
        <Pressable
          testID="chat-send"
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          onPress={onSend}
          // Solid green while the chat is open (the storyboard), even with nothing to send yet; dimmed once it closes.
          style={({ pressed }) => [styles.send, { backgroundColor: pressed && canSend ? p.primaryPressed : p.primary, opacity: enabled ? 1 : 0.3 }]}
        >
          {busy ? <ActivityIndicator color={p.onPrimary} /> : <Icon name="send" size={20} color={p.onPrimary} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: 4 },
  counter: { paddingRight: 58 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    borderWidth: BorderWidth.hairline,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    textAlignVertical: 'center',
  },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
